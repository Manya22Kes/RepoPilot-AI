const express = require('express');
const { verifyWebhookSignature } = require('../middleware/verifyWebhookSignature');
const { enqueueTriageJob } = require('../queue/triageQueue');
const { hasSuccessfulRun } = require('../db/triageRuns');
const { runWithContext } = require('../utils/context');
const config = require('../config');
const logger = require('../utils/logger');

const router = express.Router();

router.post(
  '/github',
  express.raw({ type: 'application/json' }),
  verifyWebhookSignature(config.github.webhookSecret),
  async (req, res) => {
    res.status(202).json({ received: true });

    const eventName = req.headers['x-github-event'];
    const deliveryId = req.headers['x-github-delivery'];

    await runWithContext({ deliveryId, eventName }, () => handleWebhook(req, eventName, deliveryId));
  }
);

async function handleWebhook(req, eventName, deliveryId) {
  let payload;
  try {
    payload = JSON.parse(req.body.toString('utf8'));
  } catch (err) {
    logger.error('Failed to parse webhook payload as JSON', { error: err.message });
    return;
  }

  logger.info('Webhook received', { action: payload.action });

  const jobData = buildJobData(eventName, payload);
  if (!jobData) {
    logger.info('Ignoring event/action outside current scope', { action: payload.action });
    return;
  }

  if (await hasSuccessfulRun(deliveryId)) {
    logger.info('Ignoring duplicate delivery — already processed successfully', { action: payload.action });
    return;
  }

  try {
    await enqueueTriageJob(eventName, jobData, { jobId: deliveryId });
  } catch (err) {
    logger.error('Failed to enqueue triage job', { error: err.message });
  }
}

function buildJobData(eventName, payload) {
  const installationId = payload.installation?.id;

  switch (eventName) {
    case 'installation':
      return {
        installationId,
        action: payload.action,
        account: payload.installation?.account?.login,
      };

    case 'issues':
      if (payload.action !== 'opened') return null;
      return {
        installationId,
        repoFullName: payload.repository.full_name,
        number: payload.issue.number,
        eventAction: payload.action,
      };

    case 'pull_request': {
      if (payload.action === 'opened') {
        return {
          installationId,
          repoFullName: payload.repository.full_name,
          number: payload.pull_request.number,
          eventAction: payload.action,
        };
      }
      if (payload.action === 'closed' && payload.pull_request.merged === true) {
        return {
          installationId,
          repoFullName: payload.repository.full_name,
          number: payload.pull_request.number,
          eventAction: 'closed',
        };
      }
      return null;
    }

    case 'push': {
      if (!payload.ref?.startsWith('refs/tags/')) return null;
      return {
        installationId,
        repoFullName: payload.repository.full_name,
        tagName: payload.ref.replace('refs/tags/', ''),
        eventAction: 'tag_push',
      };
    }

    default:
      return null;
  }
}

module.exports = router;
