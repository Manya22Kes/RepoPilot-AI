const pool = require('./pool');

async function recordDeadLetterJob({ queueName, jobName, jobId, data, failedReason, attemptsMade }) {
  await pool.query(
    `INSERT INTO dead_letter_jobs (queue_name, job_name, job_id, data, failed_reason, attempts_made)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [queueName, jobName, jobId, data, failedReason, attemptsMade]
  );
}

async function countDeadLettersSince(days = 7) {
  const { rows } = await pool.query(
    `SELECT count(*) FROM dead_letter_jobs WHERE failed_at > now() - ($1 || ' days')::interval`,
    [days]
  );
  return Number(rows[0].count);
}

module.exports = { recordDeadLetterJob, countDeadLettersSince };
