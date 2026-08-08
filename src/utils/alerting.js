const logger = require('./logger');

const SLACK_WEBHOOK_URL = process.env.ALERT_SLACK_WEBHOOK_URL || null;

async function sendAlert(message, context = {}) {
  logger.error(message, { ...context, alert: true });

  if (!SLACK_WEBHOOK_URL) return;

  try {
    const response = await fetch(SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: `:rotating_light: ${message}\n\`\`\`${JSON.stringify(context, null, 2)}\`\`\`` }),
    });

    if (!response.ok) {
      logger.warn('Slack alert webhook returned a non-OK status', { status: response.status });
    }
  } catch (err) {
    logger.warn('Failed to send Slack alert (alert was still logged above)', { error: err.message });
  }
}

module.exports = { sendAlert };
