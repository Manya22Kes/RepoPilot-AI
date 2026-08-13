const request = require('supertest');
const app = require('../src/index');
const { triageQueue } = require('../src/queue/triageQueue');
const pool = require('../src/db/pool');

describe('GET /health', () => {
  it('returns 200 ok when dependencies are reachable', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', postgres: 'ok', redis: 'ok' });
  });

  afterAll(async () => {
    // This test file is the one that transitively imports the queue (via
    // src/index.js -> routes/webhooks.js), which opens a real Redis
    // connection. We close what's cleanly closeable (the queue itself,
    // the Postgres pool); we deliberately do NOT call .quit() on the
    // shared ioredis connection here — BullMQ's internal connection
    // wrapper doesn't expect an external force-quit of a connection it
    // also manages, and doing so emits a stray async error after this
    // hook resolves. jest.config.js's forceExit covers the resulting
    // open handle.
    await triageQueue.close();
    await pool.end();
  });
});
