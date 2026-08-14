const { buildDigestData, formatDigestText } = require('../src/digest/buildDigest');
const { startTriageRun, completeTriageRun, failTriageRun } = require('../src/db/triageRuns');
const { recordDeadLetterJob } = require('../src/db/deadLetterJobs');
const pool = require('../src/db/pool');

const REPO = 'acme/digest-test-repo';

describe('formatDigestText', () => {
  it('formats a summary readable as plain text/Slack markdown', () => {
    const text = formatDigestText({
      days: 7,
      runStats: { total: 10, success: 8, failed: 2, running: 0, topRepos: [{ repo: 'acme/x', count: 5 }] },
      pendingApprovals: 3,
      deadLetters: 1,
      costs: { totalCostUsd: 0.1234, totalCalls: 20 },
    });

    expect(text).toContain('10 total (8 succeeded, 2 failed)');
    expect(text).toContain('$0.1234');
    expect(text).toContain('Pending approvals waiting right now: 3');
    expect(text).toContain('acme/x: 5 run(s)');
  });

  it('handles an unknown cost total without crashing', () => {
    const text = formatDigestText({
      days: 7,
      runStats: { total: 0, success: 0, failed: 0, running: 0, topRepos: [] },
      pendingApprovals: 0,
      deadLetters: 0,
      costs: { totalCostUsd: null, totalCalls: 0 },
    });
    expect(text).toContain('unknown');
  });
});

describe('buildDigestData (integration, real Postgres)', () => {
  afterEach(async () => {
    await pool.query('DELETE FROM triage_runs WHERE repo_full_name = $1', [REPO]);
    await pool.query("DELETE FROM dead_letter_jobs WHERE job_name = 'digest-test'");
  });

  afterAll(async () => {
    await pool.end();
  });

  it('aggregates run counts and dead letters within the window', async () => {
    const id1 = await startTriageRun({
      installationId: 1,
      repoFullName: REPO,
      eventName: 'issues',
      eventAction: 'opened',
      deliveryId: 'digest-test-1',
      subjectType: 'issue',
      subjectNumber: 1,
    });
    await completeTriageRun(id1, {});

    const id2 = await startTriageRun({
      installationId: 1,
      repoFullName: REPO,
      eventName: 'issues',
      eventAction: 'opened',
      deliveryId: 'digest-test-2',
      subjectType: 'issue',
      subjectNumber: 2,
    });
    await failTriageRun(id2, 'boom');

    await recordDeadLetterJob({
      queueName: 'triage',
      jobName: 'digest-test',
      jobId: 'x',
      data: {},
      failedReason: 'boom',
      attemptsMade: 3,
    });

    const data = await buildDigestData(7);

    expect(data.runStats.total).toBeGreaterThanOrEqual(2);
    expect(data.runStats.topRepos.some((r) => r.repo === REPO)).toBe(true);
    expect(data.deadLetters).toBeGreaterThanOrEqual(1);
    expect(typeof data.pendingApprovals).toBe('number');
  });
});
