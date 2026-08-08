const express = require('express');
const { getCostSummary } = require('../db/llmCalls');

const router = express.Router();

router.get('/costs/summary', async (req, res, next) => {
  try {
    const days = Math.min(Number(req.query.days) || 30, 365);
    const summary = await getCostSummary({ days });
    res.json(summary);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
