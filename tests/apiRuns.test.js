const request = require('supertest');
const app = require('../src/index');
const { triageQueue } = require('../src/queue/triageQueue');
const { startTriageRun, completeTriageRun, failTriageRun } = require('../src/db/triageRuns');
const { recordLlmCall } = require('../src/db/llmCalls');
const { createPendingAction } = require('../src/db/pendingActions');
const pool = require('../src/db/pool');
const { createUser } = require('../src/db/users');
const { hashPassword } = require('../src/utils/passwords');

const TEST_EMAIL = 'apiruns-test@example.com';
const TEST_PASSWORD = 'test-admin-password';
const REPO = 'acme/api-runs-test-repo';

async function getToken() {
  const res = await request(app).post('/api/auth/login').send({ email: TEST_EMAIL, password: TEST_PASSWORD });
  return res.body.token;
}

describe('runs API (integration: real Postgres)', () => {
  let token;

  beforeAll(async () => {
    const hash = await hashPassword(TEST_PASSWORD);
    await createUser(TEST_EMAIL, hash, 'admin');
    token = await getToken();
  });

  afterAll(async () => {
    await pool.query(
      'DELETE FROM pending_actions WHERE triage_run_id IN (SELECT id FROM triage_runs WHERE repo_full_name = $1)',
      [REPO]
    );
    await pool.query(
      'DELETE FROM llm_calls WHERE triage_run_id IN (SELECT id FROM triage_runs WHERE repo_full_name = $1)',
      [REPO]
    );
    await pool.query('DELETE FROM triage_runs WHERE repo_full_name = $1', [REPO]);
    await pool.query('DELETE FROM users WHERE email = $1', [TEST_EMAIL]);
    await triageQueue.close();
    await pool.end();
  });

  describe('GET /api/runs', () => {
    it('lists runs for a repo, most recent first, with pagination metadata', async () => {
      const id1 = await startTriageRun({
        installationId: 1,
        repoFullName: REPO,
        eventName: 'issues',
        eventAction: 'opened',
        deliveryId: 'runs-api-1',
        subjectType: 'issue',
        subjectNumber: 1,
      });
      await completeTriageRun(id1, { labels: ['bug'] });

      const id2 = await startTriageRun({
        installationId: 1,
        repoFullName: REPO,
        eventName: 'issues',
        eventAction: 'opened',
        deliveryId: 'runs-api-2',
        subjectType: 'issue',
        subjectNumber: 2,
      });
      await failTriageRun(id2, 'boom');

      const res = await request(app).get(`/api/runs?repo=${REPO}`).set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.total).toBe(2);
      expect(res.body.runs.map((r) => r.id)).toEqual([id2, id1]); // most recent first
      expect(res.body.runs[0].status).toBe('failed');
      expect(res.body.runs[1].status).toBe('success');
    });

    it('matches a partial repo name without the owner prefix', async () => {
      const res = await request(app).get('/api/runs?repo=api-runs-test-repo').set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.runs.every((r) => r.repo_full_name === REPO)).toBe(true);
      expect(res.body.total).toBeGreaterThan(0);
    });

    it('filters by status', async () => {
      const res = await request(app)
        .get(`/api/runs?repo=${REPO}&status=failed`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.runs.every((r) => r.status === 'failed')).toBe(true);
    });

    it('requires auth', async () => {
      const res = await request(app).get('/api/runs');
      expect(res.status).toBe(401);
    });

    it('finds a run by exact numeric run ID', async () => {
      const id = await startTriageRun({
        installationId: 1,
        repoFullName: REPO,
        eventName: 'issues',
        eventAction: 'opened',
        deliveryId: 'search-test-numeric',
        subjectType: 'issue',
        subjectNumber: 5,
      });

      const res = await request(app).get(`/api/runs?search=${id}`).set('Authorization', `Bearer ${token}`);
      expect(res.body.runs.map((r) => r.id)).toContain(id);
    });

    it('finds a run by partial delivery ID', async () => {
      await startTriageRun({
        installationId: 1,
        repoFullName: REPO,
        eventName: 'issues',
        eventAction: 'opened',
        deliveryId: 'unique-searchable-delivery-abc123',
        subjectType: 'issue',
        subjectNumber: 6,
      });

      const res = await request(app)
        .get(`/api/runs?repo=${REPO}&search=searchable-delivery`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.body.runs.some((r) => r.delivery_id === 'unique-searchable-delivery-abc123')).toBe(true);
    });
  });

  describe('GET /api/runs/:id', () => {
    it('returns a run with its associated llm_calls and pending_actions', async () => {
      const runId = await startTriageRun({
        installationId: 1,
        repoFullName: REPO,
        eventName: 'issues',
        eventAction: 'opened',
        deliveryId: 'runs-api-detail',
        subjectType: 'issue',
        subjectNumber: 3,
      });
      await recordLlmCall({
        triageRunId: runId,
        purpose: 'issue_classification',
        provider: 'gemini',
        model: 'gemini-1.5-flash',
        promptTokens: 100,
        completionTokens: 20,
        estimatedCostUsd: 0.00001,
      });
      await createPendingAction({
        triageRunId: runId,
        installationId: 1,
        repoFullName: REPO,
        issueNumber: 3,
        actionType: 'close_as_duplicate',
        payload: { matchedIssueNumber: 1, confidence: 0.9, reasoning: 'x' },
      });
      await completeTriageRun(runId, { labels: ['bug'] });

      const res = await request(app).get(`/api/runs/${runId}`).set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.run.id).toBe(runId);
      expect(res.body.llmCalls).toHaveLength(1);
      expect(res.body.llmCalls[0].purpose).toBe('issue_classification');
      expect(res.body.pendingActions).toHaveLength(1);
      expect(res.body.pendingActions[0].action_type).toBe('close_as_duplicate');
    });

    it('returns 404 for a nonexistent run', async () => {
      const res = await request(app).get('/api/runs/999999999').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/runs/:id', () => {
    it('deletes a run along with its llm_calls and pending_actions', async () => {
      const runId = await startTriageRun({
        installationId: 1,
        repoFullName: REPO,
        eventName: 'issues',
        eventAction: 'opened',
        deliveryId: 'runs-api-delete',
        subjectType: 'issue',
        subjectNumber: 4,
      });
      await recordLlmCall({
        triageRunId: runId,
        purpose: 'issue_classification',
        provider: 'gemini',
        model: 'gemini-1.5-flash',
        promptTokens: 10,
        completionTokens: 5,
        estimatedCostUsd: 0.000001,
      });
      await createPendingAction({
        triageRunId: runId,
        installationId: 1,
        repoFullName: REPO,
        issueNumber: 4,
        actionType: 'close_as_duplicate',
        payload: {},
      });

      const res = await request(app).delete(`/api/runs/${runId}`).set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.deleted).toBe(true);

      const getRes = await request(app).get(`/api/runs/${runId}`).set('Authorization', `Bearer ${token}`);
      expect(getRes.status).toBe(404);

      const llmRows = await pool.query('SELECT 1 FROM llm_calls WHERE triage_run_id = $1', [runId]);
      const pendingRows = await pool.query('SELECT 1 FROM pending_actions WHERE triage_run_id = $1', [runId]);
      expect(llmRows.rowCount).toBe(0);
      expect(pendingRows.rowCount).toBe(0);
    });

    it('rejects a non-admin member', async () => {
      const memberHash = await hashPassword('member-password-123');
      await createUser('apiruns-member@example.com', memberHash, 'member');
      const memberLogin = await request(app)
        .post('/api/auth/login')
        .send({ email: 'apiruns-member@example.com', password: 'member-password-123' });

      const runId = await startTriageRun({
        installationId: 1,
        repoFullName: REPO,
        eventName: 'issues',
        eventAction: 'opened',
        deliveryId: 'runs-api-delete-forbidden',
        subjectType: 'issue',
        subjectNumber: 4,
      });

      const res = await request(app)
        .delete(`/api/runs/${runId}`)
        .set('Authorization', `Bearer ${memberLogin.body.token}`);
      expect(res.status).toBe(403);

      await pool.query('DELETE FROM users WHERE email = $1', ['apiruns-member@example.com']);
    });

    it('returns 404 when deleting a nonexistent run', async () => {
      const res = await request(app).delete('/api/runs/999999999').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
    });
  });
});
