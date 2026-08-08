function parseRetryAfterMs(response) {
  const retryAfter = response.headers?.get?.('retry-after');
  if (retryAfter) {
    const asSeconds = Number(retryAfter);
    if (!Number.isNaN(asSeconds)) {
      return Math.max(0, asSeconds * 1000);
    }
    const asDate = new Date(retryAfter);
    if (!Number.isNaN(asDate.getTime())) {
      return Math.max(0, asDate.getTime() - Date.now());
    }
  }

  const rateLimitReset = response.headers?.get?.('x-ratelimit-reset');
  if (rateLimitReset) {
    const resetUnixSeconds = Number(rateLimitReset);
    if (!Number.isNaN(resetUnixSeconds)) {
      return Math.max(0, resetUnixSeconds * 1000 - Date.now());
    }
  }

  return null;
}

module.exports = { parseRetryAfterMs };
