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
const { createUser, countAdmins } = require('../src/db/users');
const { hashPassword } = require('../src/utils/passwords');

const ADMIN_EMAIL = 'apiusers-admin@example.com';
const MEMBER_EMAIL = 'apiusers-member@example.com';
const PASSWORD = 'test-password-123';

describe('users API', () => {
  let adminToken;
  let memberToken;

  beforeAll(async () => {
    const hash = await hashPassword(PASSWORD);
    await createUser(ADMIN_EMAIL, hash, 'admin');
    await createUser(MEMBER_EMAIL, hash, 'member');

    const adminLogin = await request(app).post('/api/auth/login').send({ email: ADMIN_EMAIL, password: PASSWORD });
    adminToken = adminLogin.body.token;

    const memberLogin = await request(app).post('/api/auth/login').send({ email: MEMBER_EMAIL, password: PASSWORD });
    memberToken = memberLogin.body.token;
  });

  afterAll(async () => {
    await pool.query("DELETE FROM users WHERE email LIKE 'apiusers-%'");
    await triageQueue.close();
    await pool.end();
  });

  describe('GET /api/users', () => {
    it('allows an admin to list users, without leaking password hashes', async () => {
      const res = await request(app).get('/api/users').set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.users.some((u) => u.email === ADMIN_EMAIL)).toBe(true);
      expect(res.body.users[0].password_hash).toBeUndefined();
    });

    it('rejects a non-admin member', async () => {
      const res = await request(app).get('/api/users').set('Authorization', `Bearer ${memberToken}`);
      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/users', () => {
    it('allows an admin to create a new user', async () => {
      const res = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ email: 'apiusers-new@example.com', password: 'a-new-password', role: 'member' });

      expect(res.status).toBe(201);
      expect(res.body.user.email).toBe('apiusers-new@example.com');
    });

    it('rejects a non-admin trying to create a user', async () => {
      const res = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ email: 'apiusers-blocked@example.com', password: 'x-password-123', role: 'member' });
      expect(res.status).toBe(403);
    });

    it('rejects a duplicate email', async () => {
      const res = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ email: ADMIN_EMAIL, password: 'whatever-password', role: 'member' });
      expect(res.status).toBe(409);
    });

    it('rejects a too-short password', async () => {
      const res = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ email: 'apiusers-short@example.com', password: 'short', role: 'member' });
      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /api/users/:id', () => {
    it('prevents deleting your own account', async () => {
      const listRes = await request(app).get('/api/users').set('Authorization', `Bearer ${adminToken}`);
      const self = listRes.body.users.find((u) => u.email === ADMIN_EMAIL);

      const res = await request(app).delete(`/api/users/${self.id}`).set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(400);
      // Asserting the exact message, not just the status, matters here: a
      // 400 could also come from the separate last-remaining-admin guard,
      // which would otherwise let this test pass for the wrong reason.
      expect(res.body.error).toBe("You can't delete your own account");
    });

    it('prevents deleting the last remaining admin', async () => {
      const hash = await hashPassword(PASSWORD);
      await createUser('apiusers-guard-admin@example.com', hash, 'admin');
      const guardLogin = await request(app).post('/api/auth/login').send({ email: 'apiusers-guard-admin@example.com', password: PASSWORD });
      const guardToken = guardLogin.body.token;

      // Asserting a relative change rather than an absolute count — a
      // shared dev/test database may already have other admins (e.g. a
      // real bootstrapped account), so "exactly 1 admin total" isn't a
      // safe assumption, only "one fewer than before this deletion" is.
      const adminCountBefore = await countAdmins();

      // Remove the original admin, leaving guard-admin as one of however
      // many admins remain.
      const listRes = await request(app).get('/api/users').set('Authorization', `Bearer ${guardToken}`);
      const original = listRes.body.users.find((u) => u.email === ADMIN_EMAIL);
      await request(app).delete(`/api/users/${original.id}`).set('Authorization', `Bearer ${guardToken}`);

      expect(await countAdmins()).toBe(adminCountBefore - 1);
      adminToken = guardToken; // remaining tests use the surviving admin
    });

    it('allows deleting a non-admin member', async () => {
      const listRes = await request(app).get('/api/users').set('Authorization', `Bearer ${adminToken}`);
      const member = listRes.body.users.find((u) => u.email === MEMBER_EMAIL);

      const res = await request(app).delete(`/api/users/${member.id}`).set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
    });

    it('returns 404 for a nonexistent user', async () => {
      const res = await request(app).delete('/api/users/999999999').set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(404);
    });
  });
});
