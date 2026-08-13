async function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ]);
}

async function checkPostgres(pool, timeoutMs) {
  try {
    await withTimeout(pool.query('SELECT 1'), timeoutMs);
    return 'ok';
  } catch {
    return 'error';
  }
}

async function checkRedis(redisConnection, timeoutMs) {
  try {
    await withTimeout(redisConnection.ping(), timeoutMs);
    return 'ok';
  } catch {
    return 'error';
  }
}

async function checkHealth({ pool, redisConnection, timeoutMs = 3000 }) {
  const [postgres, redis] = await Promise.all([
    checkPostgres(pool, timeoutMs),
    checkRedis(redisConnection, timeoutMs),
  ]);

  return { healthy: postgres === 'ok' && redis === 'ok', postgres, redis };
}

module.exports = { checkHealth };
