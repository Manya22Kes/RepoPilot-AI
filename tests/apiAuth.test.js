const crypto = require('crypto');

const { privateKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
  publicKeyEncoding: { type: 'pkcs1', format: 'pem' },
});
process.env.GITHUB_PRIVATE_KEY_BASE64 = Buffer.from(privateKey).toString('base64');

const request = require('supertest');
const app = require('../src/index');
const { triageQueue } = require('../src/queue/triageQueue');
const pool = require('../src/db/pool');
const { createUser } = require('../src/db/users');
const { hashPassword } = require('../src/utils/passwords');

const TEST_EMAIL = 'apiauth-test@example.com';
const TEST_PASSWORD = 'correct-password-123';

describe('dashboard auth', () => {
  let validToken;

  beforeAll(async () => {
    const hash = await hashPassword(TEST_PASSWORD);
    await createUser(TEST_EMAIL, hash, 'admin');

    // Grab a token up front, before the deliberately-failing login tests
    // below exercise the rate limiter — those failures would otherwise
    // also end up blocking this legitimate login.
    const loginRes = await request(app).post('/api/auth/login').send({ email: TEST_EMAIL, password: TEST_PASSWORD });
    validToken = loginRes.body.token;
  });

  afterAll(async () => {
    await pool.query('DELETE FROM users WHERE email = $1', [TEST_EMAIL]);
    await triageQueue.close();
    await pool.end();
  });

  describe('POST /api/auth/login', () => {
    it('returns a JWT and user info for correct credentials', async () => {
      const res = await request(app).post('/api/auth/login').send({ email: TEST_EMAIL, password: TEST_PASSWORD });

      expect(res.status).toBe(200);
      expect(typeof res.body.token).toBe('string');
      expect(res.body.user).toEqual({ id: expect.any(Number), email: TEST_EMAIL, role: 'admin' });
    });

    it('rejects an incorrect password', async () => {
      const res = await request(app).post('/api/auth/login').send({ email: TEST_EMAIL, password: 'wrong' });
      expect(res.status).toBe(401);
      expect(res.body.token).toBeUndefined();
    });

    it('rejects a nonexistent email with the same generic error', async () => {
      const res = await request(app).post('/api/auth/login').send({ email: 'nobody@example.com', password: 'x' });
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid email or password');
    });

    it('rejects a missing password', async () => {
      const res = await request(app).post('/api/auth/login').send({ email: TEST_EMAIL });
      expect(res.status).toBe(400);
    });

    it('blocks further attempts after 5 failed logins from the same IP', async () => {
      for (let i = 0; i < 5; i += 1) {
        await request(app).post('/api/auth/login').send({ email: TEST_EMAIL, password: 'wrong' });
      }
      const res = await request(app).post('/api/auth/login').send({ email: TEST_EMAIL, password: 'wrong' });
      expect(res.status).toBe(429);
    });
  });

  describe('requireAuth (via a protected route)', () => {
    it('rejects a request with no Authorization header', async () => {
      const res = await request(app).get('/api/repos');
      expect(res.status).toBe(401);
    });

    it('rejects a malformed/invalid token', async () => {
      const res = await request(app).get('/api/repos').set('Authorization', 'Bearer not-a-real-token');
      expect(res.status).toBe(401);
    });

    it('accepts a request with a valid token from login', async () => {
      global.fetch = jest.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => [],
        text: async () => '[]',
      }));

      const res = await request(app).get('/api/repos').set('Authorization', `Bearer ${validToken}`);
      expect(res.status).toBe(200);
    });
  });
});
