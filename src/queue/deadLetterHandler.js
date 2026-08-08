const { recordDeadLetterJob } = require('../db/deadLetterJobs');
const { sendAlert } = require('../utils/alerting');
const { TRIAGE_QUEUE_NAME } = require('./triageQueue');
const logger = require('../utils/logger');

async function handlePermanentFailure(job, err) {
  if (!job) return { recorded: false };

  const maxAttempts = job.opts?.attempts ?? 1;
  const isPermanentlyFailed = job.attemptsMade >= maxAttempts;
  if (!isPermanentlyFailed) return { recorded: false };

  await recordDeadLetterJob({
    queueName: TRIAGE_QUEUE_NAME,
    jobName: job.name,
    jobId: job.id,
    data: job.data,
    failedReason: err.message,
    attemptsMade: job.attemptsMade,
  }).catch((dbErr) => {
    logger.error('Failed to record dead-letter job', { jobId: job.id, error: dbErr.message });
  });

  await sendAlert(`Triage job permanently failed after ${job.attemptsMade} attempt(s): ${job.name}`, {
    jobId: job.id,
    jobName: job.name,
    repoFullName: job.data?.repoFullName,
    error: err.message,
  });

  return { recorded: true };
}

module.exports = { handlePermanentFailure };
