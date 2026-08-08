const crypto = require('crypto');

jest.mock('../src/queue/triageQueue', () => ({
  enqueueTriageJob: jest.fn().mockResolvedValue(undefined),
}));

const request = require('supertest');
const app = require('../src/index');
const { enqueueTriageJob } = require('../src/queue/triageQueue');
const { startTriageRun, completeTriageRun, failTriageRun } = require('../src/db/triageRuns');
const pool = require('../src/db/pool');

const WEBHOOK_SECRET = 'test-secret'; // matches tests/setupEnv.js's GITHUB_WEBHOOK_SECRET fallback

function sign(body) {
  return 'sha256=' + crypto.createHmac('sha256', WEBHOOK_SECRET).update(body).digest('hex');
}

function issueOpenedPayload(deliveryOverrides = {}) {
  return JSON.stringify({
    action: 'opened',
    installation: { id: 1 },
    repository: { full_name: 'acme/widgets' },
    issue: { number: 1, title: 'Something broke', ...deliveryOverrides },
  });
}

async function sendWebhook(deliveryId, body) {
  return request(app)
    .post('/webhooks/github')
    .set('Content-Type', 'application/json')
    .set('X-GitHub-Event', 'issues')
    .set('X-GitHub-Delivery', deliveryId)
    .set('X-Hub-Signature-256', sign(body))
    .send(body);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('webhook idempotency (integration: real Postgres, mocked queue)', () => {
  beforeEach(() => {
    enqueueTriageJob.mockClear();
  });

  afterAll(async () => {
    await pool.query(
      `DELETE FROM triage_runs WHERE delivery_id LIKE 'dup-test-%' OR delivery_id LIKE 'fresh-test-%' OR delivery_id LIKE 'failed-prior-test-%'`
    );
    await pool.end();
  });

  it('does not re-enqueue a delivery that already has a successful triage_runs row', async () => {
    const deliveryId = `dup-test-${Date.now()}`;
    const runId = await startTriageRun({
      installationId: 1,
      repoFullName: 'acme/widgets',
      eventName: 'issues',
      eventAction: 'opened',
      deliveryId,
      subjectType: 'issue',
      subjectNumber: 1,
    });
    await completeTriageRun(runId, { labels: ['bug'] });

    const res = await sendWebhook(deliveryId, issueOpenedPayload());
    expect(res.status).toBe(202); // still acknowledges GitHub either way

    await wait(100); // let the async post-response handling run

    expect(enqueueTriageJob).not.toHaveBeenCalled();
  });

  it('does enqueue a fresh delivery that has no prior successful run', async () => {
    const deliveryId = `fresh-test-${Date.now()}`;

    const res = await sendWebhook(deliveryId, issueOpenedPayload());
    expect(res.status).toBe(202);

    await wait(100);

    expect(enqueueTriageJob).toHaveBeenCalledWith(
      'issues',
      expect.objectContaining({ repoFullName: 'acme/widgets', number: 1 }),
      { jobId: deliveryId }
    );
  });

  it('does enqueue a delivery whose prior run failed (only success counts)', async () => {
    const deliveryId = `failed-prior-test-${Date.now()}`;
    const runId = await startTriageRun({
      installationId: 1,
      repoFullName: 'acme/widgets',
      eventName: 'issues',
      eventAction: 'opened',
      deliveryId,
      subjectType: 'issue',
      subjectNumber: 1,
    });
    await failTriageRun(runId, 'transient error');

    const res = await sendWebhook(deliveryId, issueOpenedPayload());
    expect(res.status).toBe(202);

    await wait(100);

    expect(enqueueTriageJob).toHaveBeenCalledWith('issues', expect.any(Object), { jobId: deliveryId });
  });
});
