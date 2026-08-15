const config = require('../config');
const { enqueueTriageJob, triageQueue } = require('./triageQueue');
const logger = require('../utils/logger');

const STALE_PR_SCAN_JOB_ID = 'stale-pr-scan-repeat';

/**
 * BullMQ keys repeatable jobs by name+pattern+jobId, not just jobId — so
 * changing a cron env var between deploys doesn't replace the old
 * schedule, it silently adds a second one alongside it (discovered the
 * hard way: a temporary fast cron used to test the digest locally kept
 * firing every 2 minutes indefinitely, even after the env var was
 * reverted, because the stale pattern's repeatable job was never
 * removed). Clearing out anything under this job name that doesn't match
 * the current pattern before re-registering keeps this self-healing.
 */
async function removeStaleRepeatables(jobName, currentPattern) {
  const existing = await triageQueue.getRepeatableJobs();
  const stale = existing.filter((job) => job.name === jobName && job.pattern !== currentPattern);

  for (const job of stale) {
    await triageQueue.removeRepeatableByKey(job.key);
    logger.info('Removed stale repeatable job', { jobName, staleCron: job.pattern, currentCron: currentPattern });
  }
}

async function registerScheduledJobs() {
  await removeStaleRepeatables('stale-pr-scan', config.stalePrScan.cron);
  await enqueueTriageJob(
    'stale-pr-scan',
    {},
    {
      jobId: STALE_PR_SCAN_JOB_ID,
      repeat: { pattern: config.stalePrScan.cron },
    }
  );
  logger.info('Registered scheduled stale-PR scan', { cron: config.stalePrScan.cron });

  await removeStaleRepeatables('db-backup', config.backup.cron);
  await enqueueTriageJob(
    'db-backup',
    {},
    { jobId: 'db-backup-repeat', repeat: { pattern: config.backup.cron } }
  );
  logger.info('Registered scheduled database backup', { cron: config.backup.cron });

  await removeStaleRepeatables('weekly-digest', config.digest.cron);
  await enqueueTriageJob(
    'weekly-digest',
    {},
    { jobId: 'weekly-digest-repeat', repeat: { pattern: config.digest.cron } }
  );
  logger.info('Registered weekly digest', { cron: config.digest.cron });
}

module.exports = { registerScheduledJobs, STALE_PR_SCAN_JOB_ID };
