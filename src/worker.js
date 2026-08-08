const { Worker } = require('bullmq');
const connection = require('./queue/connection');
const { TRIAGE_QUEUE_NAME } = require('./queue/triageQueue');
const { registerScheduledJobs } = require('./queue/scheduler');
const { handlePermanentFailure } = require('./queue/deadLetterHandler');
const { runWithContext } = require('./utils/context');
const logger = require('./utils/logger');
const { startTriageRun, completeTriageRun, failTriageRun } = require('./db/triageRuns');
const { processEvent, subjectTypeForEvent } = require('./triage/processEvent');
const { createDefaultLLMClient } = require('./llm');
const { createDefaultEmbeddingClient } = require('./embeddings');
const { withLLMCostTracking, withEmbeddingCostTracking } = require('./llm/costTracking');

function createWorker({
  llmClient = createDefaultLLMClient(),
  embeddingClient = createDefaultEmbeddingClient(),
} = {}) {
  const worker = new Worker(
    TRIAGE_QUEUE_NAME,
    async (job) => {
      const { installationId, repoFullName, number, eventAction } = job.data;

      const runId = await startTriageRun({
        installationId: installationId ?? null,
        repoFullName: repoFullName || null,
        eventName: job.name,
        eventAction: eventAction || null,
        deliveryId: job.id,
        subjectType: subjectTypeForEvent(job.name),
        subjectNumber: number ?? null,
      });

      return runWithContext({ runId, deliveryId: job.id, eventName: job.name, repoFullName }, async () => {
        const trackedLlmClient = withLLMCostTracking(llmClient, { triageRunId: runId });
        const trackedEmbeddingClient = withEmbeddingCostTracking(embeddingClient, { triageRunId: runId });

        try {
          const result = await processEvent(
            { name: job.name, data: job.data },
            { llmClient: trackedLlmClient, embeddingClient: trackedEmbeddingClient, triageRunId: runId }
          );
          await completeTriageRun(runId, result);
          return result;
        } catch (err) {
          await failTriageRun(runId, err.message);
          throw err; // rethrow so BullMQ applies its own job-level retry/backoff
        }
      });
    },
    { connection, concurrency: 5 }
  );

  worker.on('failed', (job, err) => {
    logger.error('Triage job failed', { jobId: job?.id, name: job?.name, error: err.message, attemptsMade: job?.attemptsMade });
    handlePermanentFailure(job, err).catch((handlerErr) => {
      logger.error('Dead-letter handling itself failed', { jobId: job?.id, error: handlerErr.message });
    });
  });

  worker.on('ready', () => {
    logger.info('Worker connected and ready', { queue: TRIAGE_QUEUE_NAME });
  });

  return worker;
}

/* istanbul ignore next -- exercised via integration/manual testing, not unit tests */
if (require.main === module) {
  const worker = createWorker();
  registerScheduledJobs().catch((err) => {
    logger.error('Failed to register scheduled jobs', { error: err.message });
  });

  const shutdown = async (signal) => {
    logger.info(`Worker shutting down (${signal})`);
    await worker.close();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

module.exports = { createWorker };
