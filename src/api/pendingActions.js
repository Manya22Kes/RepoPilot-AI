const express = require('express');
const {
  listPendingActions,
  getPendingActionById,
  resolvePendingAction,
} = require('../db/pendingActions');
const { createComment, closeIssue } = require('../services/githubApi');
const logger = require('../utils/logger');

const router = express.Router();

router.get('/pending-actions', async (req, res, next) => {
  try {
    const status = req.query.status || 'pending_approval';
    const actions = await listPendingActions({ status });
    res.json({ actions });
  } catch (err) {
    next(err);
  }
});

async function executeApprovedAction(action) {
  if (action.action_type === 'close_as_duplicate') {
    await createComment(
      action.installation_id,
      action.repo_full_name,
      action.issue_number,
      `Approved by a maintainer — closing as a duplicate of #${action.payload.matchedIssueNumber}.`
    );
    await closeIssue(action.installation_id, action.repo_full_name, action.issue_number, {
      stateReason: 'not_planned',
    });
    return { executed: true };
  }

  if (action.action_type === 'docs_update_suggestion') {
    logger.info('docs_update_suggestion approved — no automated action to execute', {
      pendingActionId: action.id,
    });
    return { executed: false, reason: 'No automated action for this type — manual follow-up expected.' };
  }

  logger.warn('Approved a pending action with an unrecognized action_type — nothing executed', {
    actionType: action.action_type,
  });
  return { executed: false, reason: `Unrecognized action_type: ${action.action_type}` };
}

router.post('/pending-actions/:id/approve', async (req, res, next) => {
  try {
    const action = await getPendingActionById(req.params.id);
    if (!action) {
      return res.status(404).json({ error: 'Pending action not found' });
    }
    if (action.status !== 'pending_approval') {
      return res.status(409).json({ error: `Action is already ${action.status}` });
    }

    const executionResult = await executeApprovedAction(action);
    await resolvePendingAction(action.id, 'approved');

    return res.json({ id: action.id, status: 'approved', ...executionResult });
  } catch (err) {
    return next(err);
  }
});

router.post('/pending-actions/:id/reject', async (req, res, next) => {
  try {
    const action = await getPendingActionById(req.params.id);
    if (!action) {
      return res.status(404).json({ error: 'Pending action not found' });
    }
    if (action.status !== 'pending_approval') {
      return res.status(409).json({ error: `Action is already ${action.status}` });
    }

    await resolvePendingAction(action.id, 'rejected');
    return res.json({ id: action.id, status: 'rejected' });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
