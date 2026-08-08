const pool = require('./pool');

async function getLastNudgedAt(repoFullName, prNumber) {
  const { rows } = await pool.query(
    'SELECT last_nudged_at FROM stale_pr_nudges WHERE repo_full_name = $1 AND pr_number = $2',
    [repoFullName, prNumber]
  );
  return rows[0]?.last_nudged_at ?? null;
}

async function recordNudge(repoFullName, prNumber) {
  await pool.query(
    `INSERT INTO stale_pr_nudges (repo_full_name, pr_number, last_nudged_at)
     VALUES ($1, $2, now())
     ON CONFLICT (repo_full_name, pr_number)
     DO UPDATE SET last_nudged_at = now()`,
    [repoFullName, prNumber]
  );
}

module.exports = { getLastNudgedAt, recordNudge };
