const pool = require('./pool');

async function recordDigestSnapshot(data, postedToSlack) {
  const { rows } = await pool.query(
    `INSERT INTO digest_snapshots (days, run_stats, pending_approvals, dead_letters, costs, posted_to_slack)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [data.days, data.runStats, data.pendingApprovals, data.deadLetters, data.costs, postedToSlack]
  );
  // BIGSERIAL columns come back as strings from pg (avoids precision loss
  // outside JS's safe integer range) — normalize here so callers get a
  // real Number, same fix as db/users.js.
  return Number(rows[0].id);
}

async function listDigestSnapshots(limit = 20) {
  const { rows } = await pool.query('SELECT * FROM digest_snapshots ORDER BY sent_at DESC LIMIT $1', [limit]);
  return rows.map((row) => ({ ...row, id: Number(row.id) }));
}

module.exports = { recordDigestSnapshot, listDigestSnapshots };
