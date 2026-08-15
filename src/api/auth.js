const jwt = require('jsonwebtoken');
const config = require('../config');
const logger = require('../utils/logger');
const { getUserByEmail } = require('../db/users');
const { verifyPassword } = require('../utils/passwords');

const TOKEN_LIFETIME = '12h';

async function login(req, res) {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const user = await getUserByEmail(email);

  // Same generic error whether the email doesn't exist or the password
  // is wrong — never reveal which, so a failed login can't be used to
  // discover which emails have accounts.
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    logger.warn('Dashboard login failed', { email });
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const token = jwt.sign(
    { userId: user.id, email: user.email, role: user.role },
    config.dashboard.jwtSecret,
    { expiresIn: TOKEN_LIFETIME }
  );

  return res.json({
    token,
    expiresIn: TOKEN_LIFETIME,
    user: { id: user.id, email: user.email, role: user.role },
  });
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

function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  return next();
}

module.exports = { login, requireAuth, requireAdmin };
