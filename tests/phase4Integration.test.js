const crypto = require('crypto');

const { privateKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
  publicKeyEncoding: { type: 'pkcs1', format: 'pem' },
});
process.env.GITHUB_PRIVATE_KEY_BASE64 = Buffer.from(privateKey).toString('base64');

const { runStalePrScan } = require('../src/triage/staleProcessing');
const { processTagPush } = require('../src/triage/releaseNotes');
const { processPullRequestMerged } = require('../src/triage/docsSync');
const { createLLMClient } = require('../src/llm/LLMClient');
const { createGeminiAdapter } = require('../src/llm/providers/geminiAdapter');
const { upsertRepoSettings } = require('../src/db/repoSettings');
const pool = require('../src/db/pool');

const REPO_A = 'acme/repo-a';
const REPO_B = 'acme/repo-b';

function fakeHttpResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

function geminiTextPayload(text) {
  return { candidates: [{ content: { parts: [{ text }] }, finishReason: 'STOP' }] };
}

const llmClient = createLLMClient({
  providers: [createGeminiAdapter({ apiKey: 'dummy', model: 'gemini-1.5-flash' })],
});

function daysAgoIso(n) {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();
}

describe('Phase 4: scheduled stale-PR scan (integration)', () => {
  let commentRequests;

  beforeEach(() => {
    commentRequests = [];

    global.fetch = jest.fn(async (url, options = {}) => {
      const method = options.method || 'GET';
      const body = options.body ? JSON.parse(options.body) : null;

      if (url.includes('/access_tokens')) {
        return fakeHttpResponse({ token: 'fake-token', expires_at: new Date(Date.now() + 3600000).toISOString() });
      }
      if (url.includes('/app/installations')) {
        return fakeHttpResponse([{ id: 111 }, { id: 222 }]);
      }
      if (url.includes('/installation/repositories')) {
        // Distinguish by which installation's token was used isn't
        // possible at this mock layer, so key off call order instead:
        // first repositories call -> repo-a, second -> repo-b.
        const isFirstCall = !global.__reposCallMade;
        global.__reposCallMade = true;
        return fakeHttpResponse({ repositories: [{ full_name: isFirstCall ? REPO_A : REPO_B }] });
      }
      if (method === 'GET' && url.includes(`/repos/${REPO_A}/pulls?state=open`)) {
        return fakeHttpResponse([
          { number: 1, title: 'Stale PR', updated_at: daysAgoIso(10), draft: false },
          { number: 2, title: 'Fresh PR', updated_at: daysAgoIso(1), draft: false },
        ]);
      }
      if (method === 'GET' && url.includes(`/repos/${REPO_B}/pulls?state=open`)) {
        return fakeHttpResponse([{ number: 5, title: 'Stale draft PR', updated_at: daysAgoIso(20), draft: true }]);
      }
      if (method === 'POST' && url.endsWith('/comments')) {
        commentRequests.push({ url, body: body.body });
        return fakeHttpResponse({});
      }

      throw new Error(`Unhandled fake fetch call: ${method} ${url}`);
    });

    delete global.__reposCallMade;
  });

  afterEach(async () => {
    await pool.query('DELETE FROM stale_pr_nudges WHERE repo_full_name IN ($1, $2)', [REPO_A, REPO_B]);
    await pool.query('DELETE FROM repo_settings WHERE repo_full_name IN ($1, $2)', [REPO_A, REPO_B]);
  });

  it('nudges the stale, non-draft PR only, across multiple installations/repos', async () => {
    const summary = await runStalePrScan();

    expect(summary.installationsScanned).toBe(2);
    expect(summary.reposScanned).toBe(2);
    expect(summary.prsChecked).toBe(3);
    expect(summary.prsNudged).toEqual([{ repoFullName: REPO_A, number: 1 }]);

    expect(commentRequests).toHaveLength(1);
    expect(commentRequests[0].url).toContain(`/repos/${REPO_A}/issues/1/comments`);
    expect(commentRequests[0].body).toMatch(/no activity/i);
  });

  it('skips a repo entirely (no PR-listing call, no nudges) when stale-PR scanning is disabled for it', async () => {
    await upsertRepoSettings(REPO_A, 111, { stalePrScanEnabled: false });

    const summary = await runStalePrScan();

    expect(summary.reposSkippedDisabled).toBe(1);
    expect(summary.reposScanned).toBe(1); // only repo-b
    expect(summary.prsNudged).toEqual([]);
    expect(commentRequests).toHaveLength(0);
  });

  it('does not re-nudge the same PR on a second scan within the cooldown window', async () => {
    await runStalePrScan();
    delete global.__reposCallMade;
    commentRequests = [];

    const secondSummary = await runStalePrScan();

    expect(secondSummary.prsNudged).toEqual([]);
    expect(commentRequests).toHaveLength(0);
  });
});

describe('Phase 4: release notes on tag push (integration)', () => {
  beforeEach(() => {
    global.fetch = jest.fn(async (url, options = {}) => {
      const method = options.method || 'GET';
      const body = options.body ? JSON.parse(options.body) : null;

      if (url.includes('/access_tokens')) {
        return fakeHttpResponse({ token: 'fake-token', expires_at: new Date(Date.now() + 3600000).toISOString() });
      }
      if (url.includes(':generateContent')) {
        return fakeHttpResponse(geminiTextPayload('## Features\n- Added dark mode\n\n## Fixes\n- Fixed crash on empty input'));
      }
      if (method === 'GET' && url.includes(`/repos/${REPO_A}/releases`)) {
        return fakeHttpResponse([{ tag_name: 'v1.0.0', draft: false, published_at: '2026-01-01T00:00:00Z' }]);
      }
      if (method === 'GET' && url.includes('/compare/v1.0.0...v1.1.0')) {
        return fakeHttpResponse({
          commits: [
            { sha: 'a1', commit: { message: 'Add dark mode', author: { name: 'alice' } } },
            { sha: 'b2', commit: { message: 'Fix crash on empty input', author: { name: 'bob' } } },
          ],
        });
      }
      if (method === 'POST' && url.endsWith(`/repos/${REPO_A}/releases`)) {
        global.__createdRelease = body;
        return fakeHttpResponse({});
      }

      throw new Error(`Unhandled fake fetch call: ${method} ${url}`);
    });
  });

  it('diffs against the previous release and creates a draft release with categorized notes', async () => {
    const result = await processTagPush(
      { installationId: 999, repoFullName: REPO_A, tagName: 'v1.1.0' },
      { llmClient }
    );

    expect(result).toEqual({ tagName: 'v1.1.0', previousTag: 'v1.0.0', commitCount: 2, draftCreated: true });
    expect(global.__createdRelease).toEqual({
      tag_name: 'v1.1.0',
      name: 'v1.1.0',
      body: '## Features\n- Added dark mode\n\n## Fixes\n- Fixed crash on empty input',
      draft: true, // never auto-published
    });
  });

  it('falls back to recent commits (not a compare) when there is no previous release', async () => {
    global.fetch = jest.fn(async (url, options = {}) => {
      const method = options.method || 'GET';
      const body = options.body ? JSON.parse(options.body) : null;

      if (url.includes('/access_tokens')) {
        return fakeHttpResponse({ token: 'fake-token', expires_at: new Date(Date.now() + 3600000).toISOString() });
      }
      if (url.includes(':generateContent')) {
        return fakeHttpResponse(geminiTextPayload('## Features\n- Initial release'));
      }
      if (method === 'GET' && url.includes(`/repos/${REPO_A}/releases`)) {
        return fakeHttpResponse([]); // no previous releases
      }
      if (method === 'GET' && url.includes(`/repos/${REPO_A}/commits?sha=v1.0.0`)) {
        return fakeHttpResponse([{ sha: 'a1', commit: { message: 'Initial commit', author: { name: 'alice' } } }]);
      }
      if (method === 'POST' && url.endsWith(`/repos/${REPO_A}/releases`)) {
        global.__createdRelease = body;
        return fakeHttpResponse({});
      }

      throw new Error(`Unhandled fake fetch call: ${method} ${url}`);
    });

    const result = await processTagPush(
      { installationId: 999, repoFullName: REPO_A, tagName: 'v1.0.0' },
      { llmClient }
    );

    expect(result.previousTag).toBeNull();
    expect(result.commitCount).toBe(1);
    expect(global.__createdRelease.draft).toBe(true);
  });
});

describe('Phase 4: docs-sync on PR merge (integration)', () => {
  let commentRequests;
  let pendingActionsBefore;

  beforeEach(async () => {
    commentRequests = [];
    pendingActionsBefore = (await pool.query('SELECT count(*) FROM pending_actions WHERE repo_full_name = $1', [REPO_A])).rows[0].count;

    global.fetch = jest.fn(async (url, options = {}) => {
      const method = options.method || 'GET';
      const body = options.body ? JSON.parse(options.body) : null;

      if (url.includes('/access_tokens')) {
        return fakeHttpResponse({ token: 'fake-token', expires_at: new Date(Date.now() + 3600000).toISOString() });
      }
      if (url.includes(':generateContent')) {
        return fakeHttpResponse(
          geminiTextPayload(
            JSON.stringify({
              docsLikelyStale: true,
              reasoning: 'Changes the public API signature of foo().',
              suggestedUpdates: ['Update the API reference for foo()'],
            })
          )
        );
      }
      if (method === 'GET' && /\/pulls\/(\d+)$/.test(url) && !url.includes('/files')) {
        const number = Number(url.match(/\/pulls\/(\d+)$/)[1]);
        return fakeHttpResponse({
          number,
          title: number === 77 ? 'Change foo() signature' : 'Update README',
          body: '',
        });
      }
      if (method === 'GET' && url.includes('/pulls/77/files')) {
        return fakeHttpResponse([{ filename: 'src/api.js', status: 'modified', additions: 10, deletions: 2, patch: 'x' }]);
      }
      if (method === 'GET' && url.includes('/pulls/88/files')) {
        return fakeHttpResponse([{ filename: 'README.md', status: 'modified', additions: 3, deletions: 1, patch: 'x' }]);
      }
      if (method === 'POST' && url.endsWith('/comments')) {
        commentRequests.push({ url, body: body.body });
        return fakeHttpResponse({});
      }

      throw new Error(`Unhandled fake fetch call: ${method} ${url}`);
    });
  });

  afterEach(async () => {
    await pool.query('DELETE FROM pending_actions WHERE repo_full_name = $1', [REPO_A]);
  });

  it('flags a merged PR that likely made docs stale: comments and records a pending_action', async () => {
    const result = await processPullRequestMerged(
      { installationId: 999, repoFullName: REPO_A, number: 77, triageRunId: null },
      { llmClient }
    );

    expect(result.docsChecked).toBe(true);
    expect(result.docsLikelyStale).toBe(true);
    expect(result.pendingActionId).not.toBeNull();

    expect(commentRequests).toHaveLength(1);
    expect(commentRequests[0].body).toMatch(/foo\(\)/);

    const { rows } = await pool.query('SELECT * FROM pending_actions WHERE repo_full_name = $1', [REPO_A]);
    expect(rows).toHaveLength(1);
    expect(rows[0].action_type).toBe('docs_update_suggestion');
    expect(rows[0].status).toBe('pending_approval');
  });

  it('skips the LLM call entirely when the PR already touched docs', async () => {
    const result = await processPullRequestMerged(
      { installationId: 999, repoFullName: REPO_A, number: 88, triageRunId: null },
      { llmClient }
    );

    expect(result).toEqual({ docsChecked: false, reason: 'PR already touched docs', docsLikelyStale: false });
    expect(commentRequests).toHaveLength(0);

    const { rows } = await pool.query('SELECT count(*) FROM pending_actions WHERE repo_full_name = $1', [REPO_A]);
    expect(Number(rows[0].count)).toBe(Number(pendingActionsBefore));
  });
});

afterAll(async () => {
  await pool.end();
});
