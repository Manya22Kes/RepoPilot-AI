const express = require('express');
const request = require('supertest');
const crypto = require('crypto');
const { verifyWebhookSignature } = require('../src/middleware/verifyWebhookSignature');

function sign(secret, body) {
  return 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex');
}

function buildTestApp(secret) {
  const app = express();
  app.post(
    '/test',
    express.raw({ type: 'application/json' }),
    verifyWebhookSignature(secret),
    (req, res) => res.status(200).json({ ok: true })
  );
  return app;
}

describe('verifyWebhookSignature', () => {
  const secret = 'test-webhook-secret';
  let app;

  beforeEach(() => {
    app = buildTestApp(secret);
  });

  it('accepts a request with a valid signature', async () => {
    const body = JSON.stringify({ hello: 'world' });
    const res = await request(app)
      .post('/test')
      .set('Content-Type', 'application/json')
      .set('X-Hub-Signature-256', sign(secret, body))
      .send(body);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('rejects a request with no signature header', async () => {
    const body = JSON.stringify({ hello: 'world' });
    const res = await request(app)
      .post('/test')
      .set('Content-Type', 'application/json')
      .send(body);

    expect(res.status).toBe(401);
  });

  it('rejects a request with a malformed signature', async () => {
    const body = JSON.stringify({ hello: 'world' });
    const res = await request(app)
      .post('/test')
      .set('Content-Type', 'application/json')
      .set('X-Hub-Signature-256', 'sha256=deadbeef')
      .send(body);

    expect(res.status).toBe(401);
  });

  it('rejects a request signed with the wrong secret', async () => {
    const body = JSON.stringify({ hello: 'world' });
    const res = await request(app)
      .post('/test')
      .set('Content-Type', 'application/json')
      .set('X-Hub-Signature-256', sign('wrong-secret', body))
      .send(body);

    expect(res.status).toBe(401);
  });

  it('rejects a request whose body was tampered with after signing', async () => {
    const originalBody = JSON.stringify({ hello: 'world' });
    const tamperedBody = JSON.stringify({ hello: 'world!' });

    const res = await request(app)
      .post('/test')
      .set('Content-Type', 'application/json')
      .set('X-Hub-Signature-256', sign(secret, originalBody))
      .send(tamperedBody);

    expect(res.status).toBe(401);
  });
});
