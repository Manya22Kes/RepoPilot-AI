const request = require('supertest');
const app = require('../src/index');
const { triageQueue } = require('../src/queue/triageQueue');
const { recordDigestSnapshot } = require('../src/db/digestSnapshots');
const pool = require('../src/db/pool');
const { createUser } = require('../src/db/users');
const { hashPassword } = require('../src/utils/passwords');

const TEST_EMAIL = 'apidigests-test@example.com';
const TEST_PASSWORD = 'test-admin-password';

async function getToken() {
  const res = await request(app).post('/api/auth/login').send({ email: TEST_EMAIL, password: TEST_PASSWORD });
  return res.body.token;
}

describe('digests API (integration: real Postgres)', () => {
  let token;

  beforeAll(async () => {
    const hash = await hashPassword(TEST_PASSWORD);
    await createUser(TEST_EMAIL, hash, 'admin');
    token = await getToken();

    await recordDigestSnapshot(
      { days: 998, runStats: { total: 1, success: 1, failed: 0, running: 0, topRepos: [] }, pendingApprovals: 0, deadLetters: 0, costs: { totalCostUsd: 0, totalCalls: 0 } },
      false
    );
  });

  afterAll(async () => {
    await pool.query('DELETE FROM digest_snapshots WHERE days = 998');
    await pool.query('DELETE FROM users WHERE email = $1', [TEST_EMAIL]);
    await triageQueue.close();
    await pool.end();
  });

  it('lists digest snapshots, most recent first', async () => {
    const res = await request(app).get('/api/digests').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.digests.some((d) => d.days === 998)).toBe(true);
  });

  it('requires auth', async () => {
    const res = await request(app).get('/api/digests');
    expect(res.status).toBe(401);
  });
});
