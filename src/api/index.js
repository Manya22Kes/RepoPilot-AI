const express = require('express');
const rateLimit = require('express-rate-limit');
const { login, requireAuth } = require('./auth');
const usersRouter = require('./users');
const reposRouter = require('./repos');
const runsRouter = require('./runs');
const pendingActionsRouter = require('./pendingActions');
const costsRouter = require('./costs');
const logger = require('../utils/logger');

const router = express.Router();

router.use(express.json());

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { error: 'Too many login attempts. Try again in a few minutes.' },
});

router.post('/auth/login', loginLimiter, login);

router.use(requireAuth);
router.use(usersRouter);
router.use(reposRouter);
router.use(runsRouter);
router.use(pendingActionsRouter);
router.use(costsRouter);

// eslint-disable-next-line no-unused-vars
router.use((err, req, res, next) => {
  logger.error('API request failed', { path: req.path, error: err.message });
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = router;
