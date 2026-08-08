const { parseRetryAfterMs } = require('../src/utils/rateLimitHeaders');

function fakeResponseWithHeaders(headers) {
  const map = new Map(Object.entries(headers));
  return { headers: { get: (key) => map.get(key.toLowerCase()) ?? null } };
}

describe('parseRetryAfterMs', () => {
  it('parses a numeric Retry-After (seconds) into milliseconds', () => {
    const response = fakeResponseWithHeaders({ 'retry-after': '30' });
    expect(parseRetryAfterMs(response)).toBe(30000);
  });

  it('parses an HTTP-date Retry-After into milliseconds until then', () => {
    const future = new Date(Date.now() + 45000);
    const response = fakeResponseWithHeaders({ 'retry-after': future.toUTCString() });
    const result = parseRetryAfterMs(response);
    expect(result).toBeGreaterThan(40000);
    expect(result).toBeLessThanOrEqual(45000);
  });

  it('falls back to X-RateLimit-Reset (unix seconds) when Retry-After is absent', () => {
    const resetUnixSeconds = Math.floor((Date.now() + 60000) / 1000);
    const response = fakeResponseWithHeaders({ 'x-ratelimit-reset': String(resetUnixSeconds) });
    const result = parseRetryAfterMs(response);
    expect(result).toBeGreaterThan(55000);
    expect(result).toBeLessThanOrEqual(60000);
  });

  it('prefers Retry-After over X-RateLimit-Reset when both are present', () => {
    const response = fakeResponseWithHeaders({
      'retry-after': '10',
      'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 999),
    });
    expect(parseRetryAfterMs(response)).toBe(10000);
  });

  it('returns null when neither header is present', () => {
    const response = fakeResponseWithHeaders({});
    expect(parseRetryAfterMs(response)).toBeNull();
  });

  it('returns null when headers are missing entirely (no .headers.get)', () => {
    expect(parseRetryAfterMs({})).toBeNull();
  });

  it('never returns a negative delay for a reset time in the past', () => {
    const pastUnixSeconds = Math.floor((Date.now() - 60000) / 1000);
    const response = fakeResponseWithHeaders({ 'x-ratelimit-reset': String(pastUnixSeconds) });
    expect(parseRetryAfterMs(response)).toBe(0);
  });
});
