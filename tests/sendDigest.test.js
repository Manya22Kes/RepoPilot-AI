jest.mock('../src/digest/buildDigest');
jest.mock('../src/utils/alerting');
jest.mock('../src/db/digestSnapshots');

const { buildDigestData, formatDigestText } = require('../src/digest/buildDigest');
const { postToSlack } = require('../src/utils/alerting');
const { recordDigestSnapshot } = require('../src/db/digestSnapshots');
const { sendWeeklyDigest } = require('../src/digest/sendDigest');

describe('sendWeeklyDigest', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    buildDigestData.mockResolvedValue({ days: 7, runStats: {}, pendingApprovals: 0, deadLetters: 0, costs: {} });
    formatDigestText.mockReturnValue('formatted digest text');
    recordDigestSnapshot.mockResolvedValue(42);
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

  it('saves a snapshot after building the digest, and includes its id in the result', async () => {
    postToSlack.mockResolvedValue(true);
    const result = await sendWeeklyDigest();

    expect(recordDigestSnapshot).toHaveBeenCalledWith(expect.objectContaining({ days: 7 }), true);
    expect(result.snapshotId).toBe(42);
    expect(result.postedToSlack).toBe(true);
  });
});
