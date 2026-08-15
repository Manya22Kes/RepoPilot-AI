const crypto = require('crypto');

const { privateKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
  publicKeyEncoding: { type: 'pkcs1', format: 'pem' },
});
process.env.GITHUB_PRIVATE_KEY_BASE64 = Buffer.from(privateKey).toString('base64');

const request = require('supertest');
const app = require('../src/index');
const { triageQueue } = require('../src/queue/triageQueue');
const { startTriageRun } = require('../src/db/triageRuns');
const { createPendingAction } = require('../src/db/pendingActions');
const pool = require('../src/db/pool');
const { createUser } = require('../src/db/users');
const { hashPassword } = require('../src/utils/passwords');

const TEST_EMAIL = 'apipendingactions-test@example.com';
const TEST_PASSWORD = 'test-admin-password';
const REPO = 'acme/api-pending-actions-test';

function fakeHttpResponse(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body, text: async () => JSON.stringify(body) };
}

async function getToken() {
  const res = await request(app).post('/api/auth/login').send({ email: TEST_EMAIL, password: TEST_PASSWORD });
  return res.body.token;
}

async function makePendingAction(actionType, payload = {}) {
  const runId = await startTriageRun({
    installationId: 555,
    repoFullName: REPO,
    eventName: 'issues',
    eventAction: 'opened',
    deliveryId: `pending-action-test-${Date.now()}-${Math.random()}`,
    subjectType: 'issue',
    subjectNumber: 10,
  });

  return createPendingAction({
    triageRunId: runId,
    installationId: 555,
    repoFullName: REPO,
    issueNumber: 10,
    actionType,
    payload,
  });
}

describe('pending-actions API (integration: real Postgres, mocked GitHub)', () => {
  let token;
  let requests;

  beforeAll(async () => {
    const hash = await hashPassword(TEST_PASSWORD);
    await createUser(TEST_EMAIL, hash, 'admin');
    token = await getToken();
  });

  beforeEach(() => {
    requests = [];
    global.fetch = jest.fn(async (url, options = {}) => {
      const method = options.method || 'GET';
      const body = options.body ? JSON.parse(options.body) : null;

      if (url.includes('/access_tokens')) {
        return fakeHttpResponse({ token: 'fake', expires_at: new Date(Date.now() + 3600000).toISOString() });
      }
      if (method === 'POST' && url.endsWith('/comments')) {
        requests.push({ type: 'comment', url, body });
        return fakeHttpResponse({});
      }
      if (method === 'PATCH' && /\/issues\/\d+$/.test(url)) {
        requests.push({ type: 'patch', url, body });
        return fakeHttpResponse({});
      }

      throw new Error(`Unhandled fetch: ${method} ${url}`);
    });
  });

  afterAll(async () => {
    await pool.query(
      'DELETE FROM pending_actions WHERE triage_run_id IN (SELECT id FROM triage_runs WHERE repo_full_name = $1)',
      [REPO]
    );
    await pool.query('DELETE FROM triage_runs WHERE repo_full_name = $1', [REPO]);
    await pool.query('DELETE FROM users WHERE email = $1', [TEST_EMAIL]);
    await triageQueue.close();
    await pool.end();
  });

  describe('GET /api/pending-actions', () => {
    it('lists pending_approval actions by default', async () => {
      const id = await makePendingAction('close_as_duplicate', { matchedIssueNumber: 1, confidence: 0.9 });

      const res = await request(app).get('/api/pending-actions').set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.actions.some((a) => a.id === id)).toBe(true);
    });
  });

  describe('POST /api/pending-actions/:id/approve', () => {
    it('approving close_as_duplicate posts a comment AND closes the issue', async () => {
      const id = await makePendingAction('close_as_duplicate', {
        matchedIssueNumber: 7,
        confidence: 0.95,
        reasoning: 'Same bug.',
      });

      const res = await request(app)
        .post(`/api/pending-actions/${id}/approve`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ id, status: 'approved', executed: true });

      const comment = requests.find((r) => r.type === 'comment');
      expect(comment.body.body).toMatch(/#7/);

      const patch = requests.find((r) => r.type === 'patch');
      expect(patch.body).toEqual({ state: 'closed', state_reason: 'not_planned' });

      const { rows } = await pool.query('SELECT status FROM pending_actions WHERE id = $1', [id]);
      expect(rows[0].status).toBe('approved');
    });

    it('approving docs_update_suggestion marks it approved but executes nothing (no automated doc edits)', async () => {
      const id = await makePendingAction('docs_update_suggestion', {
        reasoning: 'x',
        suggestedUpdates: ['Update README'],
      });

      const res = await request(app)
        .post(`/api/pending-actions/${id}/approve`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.executed).toBe(false);
      expect(requests).toHaveLength(0); // no GitHub calls at all
    });

    it('returns 404 for a nonexistent action', async () => {
      const res = await request(app)
        .post('/api/pending-actions/999999999/approve')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
    });

    it('returns 409 when approving an already-resolved action', async () => {
      const id = await makePendingAction('close_as_duplicate', { matchedIssueNumber: 1, confidence: 0.9 });
      await request(app).post(`/api/pending-actions/${id}/approve`).set('Authorization', `Bearer ${token}`);

      const secondAttempt = await request(app)
        .post(`/api/pending-actions/${id}/approve`)
        .set('Authorization', `Bearer ${token}`);

      expect(secondAttempt.status).toBe(409);
    });

    it('requires auth', async () => {
      const id = await makePendingAction('close_as_duplicate', { matchedIssueNumber: 1, confidence: 0.9 });
      const res = await request(app).post(`/api/pending-actions/${id}/approve`);
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/pending-actions/:id/reject', () => {
    it('marks the action rejected without calling GitHub at all', async () => {
      const id = await makePendingAction('close_as_duplicate', { matchedIssueNumber: 1, confidence: 0.9 });

      const res = await request(app)
        .post(`/api/pending-actions/${id}/reject`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ id, status: 'rejected' });
      expect(requests).toHaveLength(0);

      const { rows } = await pool.query('SELECT status FROM pending_actions WHERE id = $1', [id]);
      expect(rows[0].status).toBe('rejected');
    });
  });
});
