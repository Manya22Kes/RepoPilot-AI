const express = require('express');
const { listTriageRuns, getTriageRun } = require('../db/triageRuns');
const { listLlmCallsForRun } = require('../db/llmCalls');
const { listPendingActionsForRun } = require('../db/pendingActions');

const router = express.Router();

const MAX_LIMIT = 200;

router.get('/runs', async (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, MAX_LIMIT);
    const offset = Number(req.query.offset) || 0;

    const { runs, total } = await listTriageRuns({
      repoFullName: req.query.repo || undefined,
      status: req.query.status || undefined,
      limit,
      offset,
    });

    res.json({ runs, total, limit, offset });
  } catch (err) {
    next(err);
  }
});

router.get('/runs/:id', async (req, res, next) => {
  try {
    const run = await getTriageRun(req.params.id);
    if (!run) {
      return res.status(404).json({ error: 'Run not found' });
    }

    const [llmCalls, pendingActions] = await Promise.all([
      listLlmCallsForRun(run.id),
      listPendingActionsForRun(run.id),
    ]);

    return res.json({ run, llmCalls, pendingActions });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
