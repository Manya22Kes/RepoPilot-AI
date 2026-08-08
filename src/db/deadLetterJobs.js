const pool = require('./pool');

async function recordDeadLetterJob({ queueName, jobName, jobId, data, failedReason, attemptsMade }) {
  await pool.query(
    `INSERT INTO dead_letter_jobs (queue_name, job_name, job_id, data, failed_reason, attempts_made)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [queueName, jobName, jobId, data, failedReason, attemptsMade]
  );
}

module.exports = { recordDeadLetterJob };
