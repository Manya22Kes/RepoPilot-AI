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

const CORRECT_PASSWORD = 'test-admin-password';
const REPO = 'acme/api-test-repo';

function fakeHttpResponse(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body, text: async () => JSON.stringify(body) };
}

async function getToken() {
  const res = await request(app).post('/api/auth/login').send({ password: CORRECT_PASSWORD });
  return res.body.token;
}

describe('repos API (integration: real Postgres, mocked GitHub)', () => {
  let token;

  beforeAll(async () => {
    token = await getToken();
  });

  afterEach(async () => {
    await pool.query('DELETE FROM repo_settings WHERE repo_full_name = $1', [REPO]);
  });

  afterAll(async () => {
    await triageQueue.close();
    await pool.end();
  });

  describe('GET /api/repos', () => {
    it('lists repos across installations, each with its current settings', async () => {
      global.fetch = jest.fn(async (url) => {
        if (url.includes('/access_tokens')) {
          return fakeHttpResponse({ token: 'fake', expires_at: new Date(Date.now() + 3600000).toISOString() });
        }
        if (url.includes('/app/installations')) {
          return fakeHttpResponse([{ id: 321 }]);
        }
        if (url.includes('/installation/repositories')) {
          return fakeHttpResponse({ repositories: [{ full_name: REPO }] });
        }
        throw new Error(`Unhandled fetch: ${url}`);
      });

      const res = await request(app).get('/api/repos').set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.repos).toEqual([
        {
          repoFullName: REPO,
          installationId: 321,
          settings: {
            triageEnabled: true,
            prSummaryEnabled: true,
            stalePrScanEnabled: true,
            docsSyncEnabled: true,
            releaseNotesEnabled: true,
          },
        },
      ]);
    });
  });

  describe('GET/PUT /api/repos/:owner/:repo/settings', () => {
    it('returns all-enabled defaults for an unconfigured repo', async () => {
      const res = await request(app)
        .get(`/api/repos/acme/api-test-repo/settings`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.settings.triageEnabled).toBe(true);
    });

    it('updates settings via PUT and reflects the change on the next GET', async () => {
      const putRes = await request(app)
        .put(`/api/repos/acme/api-test-repo/settings`)
        .set('Authorization', `Bearer ${token}`)
        .send({ installationId: 321, triageEnabled: false, stalePrScanEnabled: false });

      expect(putRes.status).toBe(200);
      expect(putRes.body.settings.triageEnabled).toBe(false);
      expect(putRes.body.settings.stalePrScanEnabled).toBe(false);
      expect(putRes.body.settings.prSummaryEnabled).toBe(true); // untouched

      const getRes = await request(app)
        .get(`/api/repos/acme/api-test-repo/settings`)
        .set('Authorization', `Bearer ${token}`);
      expect(getRes.body.settings.triageEnabled).toBe(false);
    });

    it('rejects a PUT with no installationId', async () => {
      const res = await request(app)
        .put(`/api/repos/acme/api-test-repo/settings`)
        .set('Authorization', `Bearer ${token}`)
        .send({ triageEnabled: false });

      expect(res.status).toBe(400);
    });

    it('requires auth on the settings routes too', async () => {
      const res = await request(app).get(`/api/repos/acme/api-test-repo/settings`);
      expect(res.status).toBe(401);
    });
  });
});
