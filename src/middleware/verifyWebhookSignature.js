const crypto = require('crypto');

function verifyWebhookSignature(secret) {
  return (req, res, next) => {
    const signature = req.headers['x-hub-signature-256'];

    if (!signature) {
      return res.status(401).json({ error: 'Missing X-Hub-Signature-256 header' });
    }

    if (!Buffer.isBuffer(req.body)) {
      return res.status(500).json({
        error: 'Webhook body was not raw — check route middleware ordering',
      });
    }

    const expectedSignature =
      'sha256=' + crypto.createHmac('sha256', secret).update(req.body).digest('hex');

    const signatureBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSignature);

    const isValid =
      signatureBuffer.length === expectedBuffer.length &&
      crypto.timingSafeEqual(signatureBuffer, expectedBuffer);

    if (!isValid) {
      return res.status(401).json({ error: 'Invalid webhook signature' });
    }

    next();
  };
}

module.exports = { verifyWebhookSignature };
