const crypto = require('crypto');

// Real (throwaway) RSA keypair so the GitHub App JWT-signing code path
// actually runs, without checking any key material into the repo. Must
// happen before requiring src/config.
const { privateKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
  publicKeyEncoding: { type: 'pkcs1', format: 'pem' },
});
process.env.GITHUB_PRIVATE_KEY_BASE64 = Buffer.from(privateKey).toString('base64');

const { processEvent } = require('../src/triage/processEvent');
const { createLLMClient } = require('../src/llm/LLMClient');
const { createGeminiAdapter } = require('../src/llm/providers/geminiAdapter');
const { createEmbeddingClient } = require('../src/embeddings/EmbeddingClient');
const { createGeminiEmbeddingAdapter } = require('../src/embeddings/providers/geminiEmbeddingAdapter');
const pool = require('../src/db/pool');
const { startTriageRun } = require('../src/db/triageRuns');

const INSTALLATION_ID = 55555;
const REPO = 'acme/widgets';
const EMBEDDING_MODEL = 'text-embedding-004';
const DIM = 768;

function unitVector(activeIndex) {
  const v = new Array(DIM).fill(0);
  v[activeIndex] = 1;
  return v;
}

function nearParallel(activeIndex, noise) {
  const v = unitVector(activeIndex);
  v[(activeIndex + 1) % DIM] = noise;
  return v;
}

function fakeHttpResponse(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body, text: async () => JSON.stringify(body) };
}

function geminiTextPayload(text) {
  return { candidates: [{ content: { parts: [{ text }] }, finishReason: 'STOP' }] };
}

// Real components, wired together exactly as worker.js would, but with
// dummy keys — every actual network call goes through the mocked
// global.fetch below instead of hitting Gemini or GitHub for real.
const llmClient = createLLMClient({
  providers: [createGeminiAdapter({ apiKey: 'dummy', model: 'gemini-1.5-flash' })],
});
const embeddingClient = createEmbeddingClient({
  provider: createGeminiEmbeddingAdapter({ apiKey: 'dummy', model: EMBEDDING_MODEL }),
});

async function createTestTriageRun({ number, eventName = 'issues' }) {
  return startTriageRun({
    installationId: INSTALLATION_ID,
    repoFullName: REPO,
    eventName,
    eventAction: 'opened',
    deliveryId: `test-delivery-${eventName}-${number}-${Date.now()}-${Math.random()}`,
    subjectType: eventName === 'pull_request' ? 'pull_request' : 'issue',
    subjectNumber: number,
  });
}

const ISSUES_BY_NUMBER = {
  1: {
    number: 1,
    title: 'ISSUE_ONE_MARKER: Login crashes on submit',
    body: 'Steps: click submit. It throws an exception immediately.',
  },
  2: {
    number: 2,
    title: 'ISSUE_TWO_MARKER: Login crashes on submit too',
    body: 'Same crash happens when submitting the login form.',
  },
};

describe('Phase 3 processEvent pipeline (integration: real JWT + real LLMClient/EmbeddingClient wiring, mocked HTTP, real Postgres)', () => {
  let labelRequests;
  let commentRequests;

  beforeEach(() => {
    labelRequests = [];
    commentRequests = [];

    global.fetch = jest.fn(async (url, options = {}) => {
      const method = options.method || 'GET';
      const body = options.body ? JSON.parse(options.body) : null;

      // --- GitHub App auth ---
      if (url.includes('/access_tokens')) {
        return fakeHttpResponse({
          token: 'fake-installation-token',
          expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        });
      }

      // --- Gemini embeddings ---
      if (url.includes(':embedContent')) {
        const text = body.content.parts[0].text;
        if (text.includes('ISSUE_ONE_MARKER')) return fakeHttpResponse({ embedding: { values: nearParallel(0, 0.02) } });
        if (text.includes('ISSUE_TWO_MARKER')) return fakeHttpResponse({ embedding: { values: nearParallel(0, 0.05) } });
        return fakeHttpResponse({ embedding: { values: unitVector(700) } });
      }

      // --- Gemini chat completions ---
      if (url.includes(':generateContent')) {
        const prompt = body.contents[0].parts[0].text;

        if (prompt.includes('issue triage assistant')) {
          return fakeHttpResponse(
            geminiTextPayload(JSON.stringify({ labels: ['bug'], priority: 'medium', reasoning: 'Crash on submit.' }))
          );
        }
        if (prompt.includes('reviewing whether a newly opened GitHub issue is a duplicate')) {
          return fakeHttpResponse(
            geminiTextPayload(
              JSON.stringify({ isDuplicate: true, matchedIssueNumber: 1, confidence: 0.9, reasoning: 'Same root cause.' })
            )
          );
        }
        if (prompt.includes('summarizing a pull request')) {
          return fakeHttpResponse(geminiTextPayload('Adds dark mode support to the settings page.'));
        }
        throw new Error(`Unhandled Gemini prompt in test: ${prompt.slice(0, 80)}`);
      }

      // --- GitHub: issues ---
      if (method === 'GET' && /\/issues\/(\d+)$/.test(url)) {
        const number = Number(url.match(/\/issues\/(\d+)$/)[1]);
        return fakeHttpResponse(ISSUES_BY_NUMBER[number]);
      }
      if (method === 'POST' && url.endsWith('/labels')) {
        labelRequests.push({ url, body: body.labels });
        return fakeHttpResponse({});
      }
      if (method === 'POST' && url.endsWith('/comments')) {
        commentRequests.push({ url, body: body.body });
        return fakeHttpResponse({});
      }

      // --- GitHub: pull requests ---
      if (method === 'GET' && /\/pulls\/\d+$/.test(url)) {
        return fakeHttpResponse({ number: 50, title: 'Add dark mode', body: 'Implements a dark theme toggle.' });
      }
      if (method === 'GET' && url.includes('/pulls/50/files')) {
        return fakeHttpResponse([
          { filename: 'src/theme.js', status: 'added', additions: 40, deletions: 0, patch: '+ export const darkTheme = {...}' },
        ]);
      }

      throw new Error(`Unhandled fake fetch call in test: ${method} ${url}`);
    });
  });

  afterEach(async () => {
    await pool.query('DELETE FROM issue_embeddings WHERE repo_full_name = $1', [REPO]);
    await pool.query('DELETE FROM pending_actions WHERE repo_full_name = $1', [REPO]);
    await pool.query('DELETE FROM triage_runs WHERE repo_full_name = $1', [REPO]);
  });

  afterAll(async () => {
    await pool.end();
  });

  it('classifies a first issue and finds no duplicates (nothing stored yet for this repo)', async () => {
    const triageRunId = await createTestTriageRun({ number: 1 });

    const result = await processEvent(
      { name: 'issues', data: { installationId: INSTALLATION_ID, repoFullName: REPO, number: 1 } },
      { llmClient, embeddingClient, triageRunId }
    );

    expect(result.labels).toEqual(expect.arrayContaining(['bug', 'priority:medium']));
    expect(result.labels).not.toContain('possible-duplicate');
    expect(result.duplicateCandidates).toEqual([]);
    expect(result.pendingActionId).toBeNull();
    expect(commentRequests).toHaveLength(0);

    const { rows } = await pool.query(
      'SELECT issue_number FROM issue_embeddings WHERE repo_full_name = $1',
      [REPO]
    );
    expect(rows.map((r) => r.issue_number)).toEqual([1]);
  });

  it('flags and confirms a duplicate against a previously processed issue: labels, comments, and records a pending_action — but does not close anything', async () => {
    // Process issue #1 first so it exists in issue_embeddings for #2 to match against.
    const triageRunId1 = await createTestTriageRun({ number: 1 });
    await processEvent(
      { name: 'issues', data: { installationId: INSTALLATION_ID, repoFullName: REPO, number: 1 } },
      { llmClient, embeddingClient, triageRunId: triageRunId1 }
    );

    const triageRunId2 = await createTestTriageRun({ number: 2 });
    const result = await processEvent(
      { name: 'issues', data: { installationId: INSTALLATION_ID, repoFullName: REPO, number: 2 } },
      { llmClient, embeddingClient, triageRunId: triageRunId2 }
    );

    expect(result.labels).toEqual(expect.arrayContaining(['bug', 'priority:medium', 'possible-duplicate']));
    expect(result.duplicateCandidates.some((c) => c.number === 1)).toBe(true);
    expect(result.duplicateVerification).toEqual({
      isDuplicate: true,
      matchedIssueNumber: 1,
      confidence: 0.9,
      reasoning: 'Same root cause.',
      source: 'ai',
    });
    expect(result.pendingActionId).not.toBeNull();

    // A comment was posted linking the match — informational, not a close action.
    expect(commentRequests).toHaveLength(1);
    expect(commentRequests[0].body).toMatch(/#1/);

    // The label was applied via the real GitHub API call path.
    const issue2LabelCall = labelRequests.find((r) => r.url.includes('/issues/2/labels'));
    expect(issue2LabelCall.body).toEqual(result.labels);

    // The pending action is recorded as pending_approval — never auto-resolved.
    const { rows } = await pool.query('SELECT * FROM pending_actions WHERE repo_full_name = $1', [REPO]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      action_type: 'close_as_duplicate',
      status: 'pending_approval',
      issue_number: 2,
      triage_run_id: String(triageRunId2),
    });
    expect(rows[0].payload).toEqual({ matchedIssueNumber: 1, confidence: 0.9, reasoning: 'Same root cause.' });
  });

  it('summarizes a pull request and posts the summary as a bot comment', async () => {
    const triageRunId = await createTestTriageRun({ number: 50, eventName: 'pull_request' });

    const result = await processEvent(
      { name: 'pull_request', data: { installationId: INSTALLATION_ID, repoFullName: REPO, number: 50 } },
      { llmClient, embeddingClient, triageRunId }
    );

    expect(result).toEqual({ filesChanged: 1, summaryPosted: true });
    expect(commentRequests).toHaveLength(1);
    expect(commentRequests[0].body).toContain('Adds dark mode support');
    expect(commentRequests[0].url).toContain('/issues/50/comments'); // PRs use the issues comments endpoint
  });
});
