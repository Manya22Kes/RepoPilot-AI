const { buildDigestData, formatDigestText } = require('./buildDigest');
const { postToSlack } = require('../utils/alerting');
const { recordDigestSnapshot } = require('../db/digestSnapshots');
const logger = require('../utils/logger');

async function sendWeeklyDigest() {
  const data = await buildDigestData(7);
  const text = formatDigestText(data);

  const posted = await postToSlack(text);
  if (!posted) {
    logger.info('Weekly digest (no Slack webhook configured — logging instead)', data);
  }

  const snapshotId = await recordDigestSnapshot(data, posted);
  logger.info('Digest snapshot saved', { snapshotId, postedToSlack: posted });

  return { ...data, snapshotId, postedToSlack: posted };
}

module.exports = { sendWeeklyDigest };
