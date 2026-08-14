const logger = require('./logger');

const SLACK_WEBHOOK_URL = process.env.ALERT_SLACK_WEBHOOK_URL || null;

/**
 * Shared low-level Slack post, used by both alerts and the weekly digest.
 * Returns whether it actually posted (false if no webhook is configured,
 * or the post failed) — callers use that to decide whether to fall back
 * to just logging.
 */
async function postToSlack(text) {
  if (!SLACK_WEBHOOK_URL) return false;

  try {
    const response = await fetch(SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      logger.warn('Slack webhook returned a non-OK status', { status: response.status });
      return false;
    }
    return true;
  } catch (err) {
    logger.warn('Failed to post to Slack', { error: err.message });
    return false;
  }
}

async function sendAlert(message, context = {}) {
  logger.error(message, { ...context, alert: true });
  await postToSlack(`:rotating_light: ${message}\n\`\`\`${JSON.stringify(context, null, 2)}\`\`\``);
}

module.exports = { sendAlert, postToSlack };
