const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const config = require('../config');
const logger = require('../utils/logger');

const TOKEN_LIFETIME = '12h';

function passwordsMatch(candidate, expected) {
  const candidateBuffer = Buffer.from(candidate || '');
  const expectedBuffer = Buffer.from(expected);
  return (
    candidateBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(candidateBuffer, expectedBuffer)
  );
}

function login(req, res) {
  const { password } = req.body || {};

  if (!passwordsMatch(password, config.dashboard.adminPassword)) {
    logger.warn('Dashboard login failed');
    return res.status(401).json({ error: 'Invalid password' });
  }

  const token = jwt.sign({ role: 'admin' }, config.dashboard.jwtSecret, { expiresIn: TOKEN_LIFETIME });
  return res.json({ token, expiresIn: TOKEN_LIFETIME });
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : null;

  if (!token) {
    return res.status(401).json({ error: 'Missing Authorization header' });
  }

  try {
    req.user = jwt.verify(token, config.dashboard.jwtSecret);
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = { login, requireAuth, passwordsMatch };
