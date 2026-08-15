const pool = require('./pool');

async function startTriageRun({
  installationId,
  repoFullName,
  eventName,
  eventAction,
  deliveryId,
  subjectType,
  subjectNumber,
}) {
  const { rows } = await pool.query(
    `INSERT INTO triage_runs
       (installation_id, repo_full_name, event_name, event_action, delivery_id, subject_type, subject_number)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [installationId, repoFullName, eventName, eventAction, deliveryId, subjectType, subjectNumber]
  );
  return rows[0].id;
}

async function completeTriageRun(id, result) {
  await pool.query(
    `UPDATE triage_runs SET status = 'success', result = $2, finished_at = now() WHERE id = $1`,
    [id, result]
  );
}

async function failTriageRun(id, errorMessage) {
  await pool.query(
    `UPDATE triage_runs SET status = 'failed', error = $2, finished_at = now() WHERE id = $1`,
    [id, errorMessage]
  );
}

async function getTriageRun(id) {
  const { rows } = await pool.query('SELECT * FROM triage_runs WHERE id = $1', [id]);
  return rows[0] || null;
}

async function listTriageRuns({ repoFullName, status, search, limit = 50, offset = 0 } = {}) {
  const conditions = [];
  const params = [];

  if (repoFullName) {
    params.push(`%${repoFullName.trim()}%`);
    conditions.push(`repo_full_name ILIKE $${params.length}`);
  }
  if (status) {
    params.push(status);
    conditions.push(`status = $${params.length}`);
  }
  if (search) {
    const trimmed = search.trim();
    if (/^\d+$/.test(trimmed)) {
      params.push(Number(trimmed));
      conditions.push(`id = $${params.length}`);
    } else {
      params.push(`%${trimmed}%`);
      conditions.push(`delivery_id ILIKE $${params.length}`);
    }
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  params.push(limit);
  const limitParam = `$${params.length}`;
  params.push(offset);
  const offsetParam = `$${params.length}`;

  const { rows } = await pool.query(
    `SELECT * FROM triage_runs ${whereClause} ORDER BY id DESC LIMIT ${limitParam} OFFSET ${offsetParam}`,
    params
  );

  const countResult = await pool.query(`SELECT count(*) FROM triage_runs ${whereClause}`, params.slice(0, conditions.length));

  return { runs: rows, total: Number(countResult.rows[0].count) };
}

async function getRunStatsSince(days = 7) {
  const [statusResult, repoResult] = await Promise.all([
    pool.query(
      `SELECT status, count(*) FROM triage_runs WHERE started_at > now() - ($1 || ' days')::interval GROUP BY status`,
      [days]
    ),
    pool.query(
      `SELECT repo_full_name, count(*) AS count FROM triage_runs
       WHERE started_at > now() - ($1 || ' days')::interval AND repo_full_name IS NOT NULL
       GROUP BY repo_full_name ORDER BY count DESC LIMIT 5`,
      [days]
    ),
  ]);

  const byStatus = {};
  for (const row of statusResult.rows) byStatus[row.status] = Number(row.count);

  return {
    total: Object.values(byStatus).reduce((a, b) => a + b, 0),
    success: byStatus.success || 0,
    failed: byStatus.failed || 0,
    running: byStatus.running || 0,
    topRepos: repoResult.rows.map((r) => ({ repo: r.repo_full_name, count: Number(r.count) })),
  };
}

async function deleteTriageRun(id) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // No ON DELETE CASCADE on these FKs, so child rows must go first.
    await client.query('DELETE FROM pending_actions WHERE triage_run_id = $1', [id]);
    await client.query('DELETE FROM llm_calls WHERE triage_run_id = $1', [id]);
    const { rowCount } = await client.query('DELETE FROM triage_runs WHERE id = $1', [id]);
    await client.query('COMMIT');
    return rowCount > 0;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function hasSuccessfulRun(deliveryId) {
  if (!deliveryId) return false;
  const { rows } = await pool.query(
    `SELECT 1 FROM triage_runs WHERE delivery_id = $1 AND status = 'success' LIMIT 1`,
    [deliveryId]
  );
  return rows.length > 0;
}

module.exports = {
  startTriageRun,
  completeTriageRun,
  failTriageRun,
  getTriageRun,
  hasSuccessfulRun,
  listTriageRuns,
  getRunStatsSince,
  deleteTriageRun,
};
