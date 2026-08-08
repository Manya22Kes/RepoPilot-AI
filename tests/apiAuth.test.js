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

// Matches tests/setupEnv.js's DASHBOARD_ADMIN_PASSWORD fallback.
const CORRECT_PASSWORD = 'test-admin-password';

describe('dashboard auth', () => {
  afterAll(async () => {
    await triageQueue.close();
    await pool.end();
  });

  describe('POST /api/auth/login', () => {
    it('returns a JWT for the correct password', async () => {
      const res = await request(app).post('/api/auth/login').send({ password: CORRECT_PASSWORD });

      expect(res.status).toBe(200);
      expect(typeof res.body.token).toBe('string');
      expect(res.body.token.split('.')).toHaveLength(3); // looks like a JWT
    });

    it('rejects an incorrect password', async () => {
      const res = await request(app).post('/api/auth/login').send({ password: 'wrong' });
      expect(res.status).toBe(401);
      expect(res.body.token).toBeUndefined();
    });

    it('rejects a missing password', async () => {
      const res = await request(app).post('/api/auth/login').send({});
      expect(res.status).toBe(401);
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
      const loginRes = await request(app).post('/api/auth/login').send({ password: CORRECT_PASSWORD });
      const token = loginRes.body.token;

      // Mock the GitHub calls this route makes so it doesn't need a real
      // installation — this test only cares about auth passing, not the
      // repos data itself.
      global.fetch = jest.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => [],
        text: async () => '[]',
      }));

      const res = await request(app).get('/api/repos').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
    });
  });
});
