const { checkHealth } = require('../src/utils/healthCheck');

function fakePool(shouldSucceed) {
  return { query: () => (shouldSucceed ? Promise.resolve() : Promise.reject(new Error('down'))) };
}
function fakeRedis(shouldSucceed) {
  return { ping: () => (shouldSucceed ? Promise.resolve('PONG') : Promise.reject(new Error('down'))) };
}

describe('checkHealth', () => {
  it('reports healthy when both postgres and redis respond', async () => {
    const result = await checkHealth({ pool: fakePool(true), redisConnection: fakeRedis(true) });
    expect(result).toEqual({ healthy: true, postgres: 'ok', redis: 'ok' });
  });

  it('reports unhealthy when postgres fails', async () => {
    const result = await checkHealth({ pool: fakePool(false), redisConnection: fakeRedis(true) });
    expect(result.healthy).toBe(false);
    expect(result.postgres).toBe('error');
  });

  it('reports unhealthy when redis fails', async () => {
    const result = await checkHealth({ pool: fakePool(true), redisConnection: fakeRedis(false) });
    expect(result.healthy).toBe(false);
    expect(result.redis).toBe('error');
  });

  it('treats a slow dependency as failed once it exceeds the timeout', async () => {
    const slowPool = { query: () => new Promise((resolve) => setTimeout(resolve, 100)) };
    const result = await checkHealth({ pool: slowPool, redisConnection: fakeRedis(true), timeoutMs: 20 });
    expect(result.postgres).toBe('error');
  });
});
