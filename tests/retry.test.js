const { withRetry } = require('../src/utils/retry');

describe('withRetry', () => {
  it('returns the result immediately on first success without retrying', async () => {
    const fn = jest.fn().mockResolvedValue('ok');
    const result = await withRetry(fn, { baseDelayMs: 1 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on failure and eventually succeeds', async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockRejectedValueOnce(new Error('fail 2'))
      .mockResolvedValueOnce('ok');

    const result = await withRetry(fn, { attempts: 3, baseDelayMs: 1 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('throws the last error once attempts are exhausted', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('always fails'));

    await expect(withRetry(fn, { attempts: 3, baseDelayMs: 1 })).rejects.toThrow('always fails');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('stops immediately when isRetryable returns false, without exhausting attempts', async () => {
    const err = new Error('not retryable');
    const fn = jest.fn().mockRejectedValue(err);

    await expect(
      withRetry(fn, { attempts: 5, baseDelayMs: 1, isRetryable: () => false })
    ).rejects.toThrow('not retryable');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('passes the 1-indexed attempt number to the function', async () => {
    const seenAttempts = [];
    const fn = jest.fn(async (attempt) => {
      seenAttempts.push(attempt);
      if (attempt < 3) throw new Error('retry me');
      return 'done';
    });

    await withRetry(fn, { attempts: 3, baseDelayMs: 1 });
    expect(seenAttempts).toEqual([1, 2, 3]);
  });
});
