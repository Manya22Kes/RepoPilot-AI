const config = require('../src/config');
const { triageQueue } = require('../src/queue/triageQueue');
const { registerScheduledJobs } = require('../src/queue/scheduler');

describe('registerScheduledJobs (integration, real Redis)', () => {
  const originalDigestCron = config.digest.cron;

  afterEach(async () => {
    config.digest.cron = originalDigestCron;
    const existing = await triageQueue.getRepeatableJobs();
    for (const job of existing) {
      if (job.name === 'weekly-digest') await triageQueue.removeRepeatableByKey(job.key);
    }
  });

  afterAll(async () => {
    await triageQueue.close();
  });

  it('does not leave a stale repeatable job behind when the cron pattern changes', async () => {
    config.digest.cron = '*/2 * * * *';
    await registerScheduledJobs();

    config.digest.cron = '0 9 * * 1';
    await registerScheduledJobs();

    const jobs = await triageQueue.getRepeatableJobs();
    const digestJobs = jobs.filter((j) => j.name === 'weekly-digest');

    expect(digestJobs).toHaveLength(1);
    expect(digestJobs[0].pattern).toBe('0 9 * * 1');
  });
});
