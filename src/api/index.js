const express = require('express');
const { login, requireAuth } = require('./auth');
const reposRouter = require('./repos');
const runsRouter = require('./runs');
const pendingActionsRouter = require('./pendingActions');
const costsRouter = require('./costs');
const logger = require('../utils/logger');

const router = express.Router();

router.use(express.json());

router.post('/auth/login', login);

router.use(requireAuth);
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
