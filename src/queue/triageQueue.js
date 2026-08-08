const { Queue } = require('bullmq');
const connection = require('./connection');

const TRIAGE_QUEUE_NAME = 'triage';

const triageQueue = new Queue(TRIAGE_QUEUE_NAME, {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: { age: 60 * 60, count: 1000 },
    removeOnFail: { age: 24 * 60 * 60 },
  },
});

async function enqueueTriageJob(jobName, data, opts = {}) {
  return triageQueue.add(jobName, data, opts);
}

module.exports = { triageQueue, enqueueTriageJob, TRIAGE_QUEUE_NAME };
