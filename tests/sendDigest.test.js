jest.mock('../src/digest/buildDigest');
jest.mock('../src/utils/alerting');

const { buildDigestData, formatDigestText } = require('../src/digest/buildDigest');
const { postToSlack } = require('../src/utils/alerting');
const { sendWeeklyDigest } = require('../src/digest/sendDigest');

describe('sendWeeklyDigest', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    buildDigestData.mockResolvedValue({ days: 7, runStats: {}, pendingApprovals: 0, deadLetters: 0, costs: {} });
    formatDigestText.mockReturnValue('formatted digest text');
  });

  it('posts the formatted digest to Slack when a webhook is configured', async () => {
    postToSlack.mockResolvedValue(true);

    await sendWeeklyDigest();

    expect(postToSlack).toHaveBeenCalledWith('formatted digest text');
  });

  it('returns the digest data regardless of whether posting succeeded', async () => {
    postToSlack.mockResolvedValue(false);
    const result = await sendWeeklyDigest();
    expect(result.days).toBe(7);
  });
});
