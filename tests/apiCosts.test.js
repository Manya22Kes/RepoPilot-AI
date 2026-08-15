const request = require('supertest');
const app = require('../src/index');
const { triageQueue } = require('../src/queue/triageQueue');
const { startTriageRun } = require('../src/db/triageRuns');
const { recordLlmCall } = require('../src/db/llmCalls');
const pool = require('../src/db/pool');
const { createUser } = require('../src/db/users');
const { hashPassword } = require('../src/utils/passwords');

const TEST_EMAIL = 'apicosts-test@example.com';
const TEST_PASSWORD = 'test-admin-password';
const REPO = 'acme/api-costs-test-repo';

async function getToken() {
  const res = await request(app).post('/api/auth/login').send({ email: TEST_EMAIL, password: TEST_PASSWORD });
  return res.body.token;
}

describe('costs API (integration: real Postgres)', () => {
  let token;
  let runId;

  beforeAll(async () => {
    const hash = await hashPassword(TEST_PASSWORD);
    await createUser(TEST_EMAIL, hash, 'admin');
    token = await getToken();
    runId = await startTriageRun({
      installationId: 1,
      repoFullName: REPO,
      eventName: 'issues',
      eventAction: 'opened',
      deliveryId: 'costs-api-test',
      subjectType: 'issue',
      subjectNumber: 1,
    });

    await recordLlmCall({
      triageRunId: runId,
      purpose: 'issue_classification',
      provider: 'gemini',
      model: 'gemini-1.5-flash',
      promptTokens: 1000,
      completionTokens: 100,
      estimatedCostUsd: 0.0001,
    });
    await recordLlmCall({
      triageRunId: runId,
      purpose: 'pr_summary',
      provider: 'openai',
      model: 'gpt-4o-mini',
      promptTokens: 2000,
      completionTokens: 300,
      estimatedCostUsd: 0.0005,
    });
    await recordLlmCall({
      triageRunId: runId,
      purpose: 'duplicate_detection_embedding',
      provider: 'gemini',
      model: 'text-embedding-004',
      promptTokens: null,
      completionTokens: null,
      estimatedCostUsd: null, // unlisted/no-cost model — should not crash the sum
    });
  });

  afterAll(async () => {
    await pool.query(
      'DELETE FROM llm_calls WHERE triage_run_id IN (SELECT id FROM triage_runs WHERE repo_full_name = $1)',
      [REPO]
    );
    await pool.query('DELETE FROM triage_runs WHERE repo_full_name = $1', [REPO]);
    await pool.query('DELETE FROM users WHERE email = $1', [TEST_EMAIL]);
    await triageQueue.close();
    await pool.end();
  });

  it('returns a total cost, broken down by purpose and provider', async () => {
    const res = await request(app).get('/api/costs/summary').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.totalCalls).toBeGreaterThanOrEqual(3);
    expect(res.body.totalCostUsd).toBeGreaterThan(0);

    const classificationEntry = res.body.byPurpose.find((p) => p.purpose === 'issue_classification');
    expect(classificationEntry.calls).toBeGreaterThanOrEqual(1);

    const geminiEntry = res.body.byProvider.find((p) => p.provider === 'gemini');
    expect(geminiEntry.calls).toBeGreaterThanOrEqual(2); // classification + embedding
  });

  it('respects the days query param', async () => {
    const res = await request(app).get('/api/costs/summary?days=1').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.totalCalls).toBeGreaterThanOrEqual(3); // all just inserted, within 1 day
  });

  it('requires auth', async () => {
    const res = await request(app).get('/api/costs/summary');
    expect(res.status).toBe(401);
  });
});
