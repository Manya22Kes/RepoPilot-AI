const { recordDigestSnapshot, listDigestSnapshots } = require('../src/db/digestSnapshots');
const pool = require('../src/db/pool');

describe('digest_snapshots (integration, real Postgres)', () => {
  afterEach(async () => {
    await pool.query('DELETE FROM digest_snapshots WHERE days = 999');
  });

  afterAll(async () => {
    await pool.end();
  });

  it('records a snapshot and lists it back, most recent first', async () => {
    const sampleData = {
      days: 999,
      runStats: { total: 5, success: 4, failed: 1, running: 0, topRepos: [] },
      pendingApprovals: 2,
      deadLetters: 0,
      costs: { totalCostUsd: 0.05, totalCalls: 10 },
    };

    const id = await recordDigestSnapshot(sampleData, true);
    expect(id).toBeGreaterThan(0);

    const snapshots = await listDigestSnapshots(5);
    const saved = snapshots.find((s) => s.id === id);
    expect(saved).toBeDefined();
    expect(saved.pending_approvals).toBe(2);
    expect(saved.posted_to_slack).toBe(true);
    expect(saved.run_stats.total).toBe(5);
  });
});
