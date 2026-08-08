jest.mock('../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

function freshAlertingModule(slackWebhookUrl) {
  jest.resetModules();
  if (slackWebhookUrl) {
    process.env.ALERT_SLACK_WEBHOOK_URL = slackWebhookUrl;
  } else {
    delete process.env.ALERT_SLACK_WEBHOOK_URL;
  }
  // Required together, right after resetModules, so alerting.js's internal
  // `require('./logger')` resolves to this exact same mocked instance —
  // requiring logger separately/later would get a different module
  // instance and silently observe zero calls.
  const logger = require('../src/utils/logger');
  const alerting = require('../src/utils/alerting');
  return { alerting, logger };
}

describe('sendAlert without a Slack webhook configured', () => {
  let sendAlert;
  let logger;

  beforeEach(() => {
    ({ alerting: { sendAlert }, logger } = freshAlertingModule(null));
    logger.error.mockClear();
  });

  it('always logs at error level with alert: true', async () => {
    await sendAlert('something broke', { jobId: '1' });
    expect(logger.error).toHaveBeenCalledWith('something broke', { jobId: '1', alert: true });
  });

  it('does not attempt any network call', async () => {
    global.fetch = jest.fn();
    await sendAlert('something broke', {});
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe('sendAlert with a Slack webhook configured', () => {
  let sendAlert;
  let logger;

  beforeEach(() => {
    ({ alerting: { sendAlert }, logger } = freshAlertingModule('https://hooks.slack.example/test'));
    logger.error.mockClear();
    logger.warn.mockClear();
  });

  it('posts to the configured webhook with the message and context', async () => {
    global.fetch = jest.fn(async () => ({ ok: true, status: 200 }));

    await sendAlert('job failed', { jobId: '99' });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toBe('https://hooks.slack.example/test');
    const body = JSON.parse(options.body);
    expect(body.text).toContain('job failed');
    expect(body.text).toContain('99');
  });

  it('logs a warning (does not throw) if the webhook returns a non-OK status', async () => {
    global.fetch = jest.fn(async () => ({ ok: false, status: 500 }));

    await expect(sendAlert('x', {})).resolves.toBeUndefined();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('non-OK'),
      expect.objectContaining({ status: 500 })
    );
  });

  it('logs a warning (does not throw) if the network request itself fails', async () => {
    global.fetch = jest.fn(async () => {
      throw new Error('network down');
    });

    await expect(sendAlert('x', {})).resolves.toBeUndefined();
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Failed to send Slack alert'), expect.any(Object));
  });
});
