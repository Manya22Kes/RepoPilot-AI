const pool = require('./pool');

async function createPendingAction({
  triageRunId,
  installationId,
  repoFullName,
  issueNumber,
  actionType,
  payload,
}) {
  const { rows } = await pool.query(
    `INSERT INTO pending_actions
       (triage_run_id, installation_id, repo_full_name, issue_number, action_type, payload)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [triageRunId, installationId, repoFullName, issueNumber, actionType, payload]
  );
  return rows[0].id;
}

async function resolvePendingAction(id, status) {
  if (!['approved', 'rejected'].includes(status)) {
    throw new Error(`Invalid pending action status: ${status}`);
  }
  await pool.query(`UPDATE pending_actions SET status = $2, resolved_at = now() WHERE id = $1`, [
    id,
    status,
  ]);
}

async function getPendingActionById(id) {
  const { rows } = await pool.query('SELECT * FROM pending_actions WHERE id = $1', [id]);
  return rows[0] || null;
}

async function listPendingActions({ status = 'pending_approval', limit = 50 } = {}) {
  const { rows } = await pool.query(
    'SELECT * FROM pending_actions WHERE status = $1 ORDER BY id DESC LIMIT $2',
    [status, limit]
  );
  return rows;
}

async function listPendingActionsForRun(triageRunId) {
  const { rows } = await pool.query('SELECT * FROM pending_actions WHERE triage_run_id = $1 ORDER BY id', [
    triageRunId,
  ]);
  return rows;
}

module.exports = {
  createPendingAction,
  resolvePendingAction,
  getPendingActionById,
  listPendingActions,
  listPendingActionsForRun,
};
