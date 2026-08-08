function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry(fn, options = {}) {
  const { attempts = 3, baseDelayMs = 300, maxDelayMs = 60_000, isRetryable = () => true } = options;

  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fn(attempt);
    } catch (err) {
      lastError = err;

      const isLastAttempt = attempt === attempts;
      if (isLastAttempt || !isRetryable(err)) {
        throw err;
      }

      const delay =
        typeof err.retryAfterMs === 'number'
          ? err.retryAfterMs
          : baseDelayMs * 2 ** (attempt - 1) + Math.floor(Math.random() * baseDelayMs);

      await sleep(Math.min(delay, maxDelayMs));
    }
  }

  throw lastError;
}

module.exports = { withRetry, sleep };
