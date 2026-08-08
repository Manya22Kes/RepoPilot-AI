jest.mock('../src/db/deadLetterJobs');
jest.mock('../src/utils/alerting');
const { recordDeadLetterJob } = require('../src/db/deadLetterJobs');
const { sendAlert } = require('../src/utils/alerting');
const { handlePermanentFailure } = require('../src/queue/deadLetterHandler');

describe('handlePermanentFailure', () => {
  beforeEach(() => {
    recordDeadLetterJob.mockReset().mockResolvedValue(undefined);
    sendAlert.mockReset().mockResolvedValue(undefined);
  });

  it('does nothing if there is no job (defensive null-check)', async () => {
    const result = await handlePermanentFailure(null, new Error('x'));
    expect(result).toEqual({ recorded: false });
    expect(recordDeadLetterJob).not.toHaveBeenCalled();
  });

  it('does not record or alert when the job still has retries left', async () => {
    const job = { id: '1', name: 'issues', data: {}, attemptsMade: 1, opts: { attempts: 3 } };
    const result = await handlePermanentFailure(job, new Error('transient'));

    expect(result).toEqual({ recorded: false });
    expect(recordDeadLetterJob).not.toHaveBeenCalled();
    expect(sendAlert).not.toHaveBeenCalled();
  });

  it('records and alerts once attemptsMade reaches the configured max', async () => {
    const job = {
      id: '42',
      name: 'issues',
      data: { repoFullName: 'acme/widgets' },
      attemptsMade: 3,
      opts: { attempts: 3 },
    };
    const err = new Error('permanently broken');

    const result = await handlePermanentFailure(job, err);

    expect(result).toEqual({ recorded: true });
    expect(recordDeadLetterJob).toHaveBeenCalledWith({
      queueName: 'triage',
      jobName: 'issues',
      jobId: '42',
      data: { repoFullName: 'acme/widgets' },
      failedReason: 'permanently broken',
      attemptsMade: 3,
    });
    expect(sendAlert).toHaveBeenCalledWith(
      expect.stringContaining('issues'),
      expect.objectContaining({ jobId: '42', repoFullName: 'acme/widgets' })
    );
  });

  it('treats a missing opts.attempts as max attempts = 1', async () => {
    const job = { id: '1', name: 'installation', data: {}, attemptsMade: 1, opts: {} };
    const result = await handlePermanentFailure(job, new Error('x'));
    expect(result).toEqual({ recorded: true });
  });

  it('still returns recorded:true even if the DB write itself fails (logged, not thrown)', async () => {
    recordDeadLetterJob.mockRejectedValue(new Error('db unreachable'));
    const job = { id: '1', name: 'issues', data: {}, attemptsMade: 3, opts: { attempts: 3 } };

    await expect(handlePermanentFailure(job, new Error('x'))).resolves.toEqual({ recorded: true });
  });
});
