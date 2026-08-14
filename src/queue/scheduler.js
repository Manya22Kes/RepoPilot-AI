const config = require('../config');
const { enqueueTriageJob } = require('./triageQueue');
const logger = require('../utils/logger');

const STALE_PR_SCAN_JOB_ID = 'stale-pr-scan-repeat';

async function registerScheduledJobs() {
  await enqueueTriageJob(
    'stale-pr-scan',
    {},
    {
      jobId: STALE_PR_SCAN_JOB_ID,
      repeat: { pattern: config.stalePrScan.cron },
    }
  );

  logger.info('Registered scheduled stale-PR scan', { cron: config.stalePrScan.cron });

  await enqueueTriageJob(
    'db-backup',
    {},
    { jobId: 'db-backup-repeat', repeat: { pattern: config.backup.cron } }
  );
  logger.info('Registered scheduled database backup', { cron: config.backup.cron });

  await enqueueTriageJob(
    'weekly-digest',
    {},
    { jobId: 'weekly-digest-repeat', repeat: { pattern: config.digest.cron } }
  );
  logger.info('Registered weekly digest', { cron: config.digest.cron });
}

module.exports = { registerScheduledJobs, STALE_PR_SCAN_JOB_ID };
