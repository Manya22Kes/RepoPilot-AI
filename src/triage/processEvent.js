const logger = require('../utils/logger');
const { classifyIssueWithAI } = require('./aiClassifier');
const { findEmbeddingDuplicateCandidates } = require('./embeddingDuplicateDetection');
const { verifyDuplicateWithAI, DUPLICATE_CONFIRMATION_THRESHOLD } = require('./duplicateVerification');
const { summarizePullRequest } = require('./prSummary');
const { processPullRequestMerged } = require('./docsSync');
const { processTagPush } = require('./releaseNotes');
const { runStalePrScan } = require('./staleProcessing');
const { runBackup } = require('../backup/runBackup');
const { createPendingAction } = require('../db/pendingActions');
const { getRepoSettings } = require('../db/repoSettings');
const {
  getIssue,
  getPullRequest,
  addLabels,
  createComment,
  getPullRequestFiles,
} = require('../services/githubApi');

function subjectTypeForEvent(eventName) {
  if (eventName === 'issues') return 'issue';
  if (eventName === 'pull_request') return 'pull_request';
  if (eventName === 'push') return 'tag';
  if (eventName === 'stale-pr-scan') return 'scheduled_scan';
  if (eventName === 'db-backup') return 'scheduled_backup';
  return 'installation';
}

async function processInstallation({ action, account, installationId }) {
  logger.info('Processing installation event', { action, account, installationId });
  return { action, account };
}

async function processIssueOpened(
  { installationId, repoFullName, number },
  { llmClient, embeddingClient, triageRunId }
) {
  const issue = await getIssue(installationId, repoFullName, number);
  const issueContext = { title: issue.title, body: issue.body || '' };

  const classification = await classifyIssueWithAI(llmClient, issueContext);

  const candidates = await findEmbeddingDuplicateCandidates({
    embeddingClient,
    repoFullName,
    issueNumber: number,
    title: issue.title,
    body: issue.body || '',
  });

  const verification = await verifyDuplicateWithAI(llmClient, {
    newIssue: issueContext,
    candidates,
  });

  const labelsToApply = [...classification.labels, `priority:${classification.priority}`];
  if (candidates.length > 0) {
    labelsToApply.push('possible-duplicate');
  }

  await addLabels(installationId, repoFullName, number, labelsToApply);

  let pendingActionId = null;
  const isConfirmedDuplicate =
    verification.isDuplicate && verification.confidence >= DUPLICATE_CONFIRMATION_THRESHOLD;

  if (isConfirmedDuplicate) {
    await createComment(
      installationId,
      repoFullName,
      number,
      `This looks like it may be a duplicate of #${verification.matchedIssueNumber}. ${verification.reasoning}\n\nFlagged for maintainer review — not closed automatically.`
    );

    pendingActionId = await createPendingAction({
      triageRunId,
      installationId,
      repoFullName,
      issueNumber: number,
      actionType: 'close_as_duplicate',
      payload: {
        matchedIssueNumber: verification.matchedIssueNumber,
        confidence: verification.confidence,
        reasoning: verification.reasoning,
      },
    });
  }

  return {
    labels: labelsToApply,
    priority: classification.priority,
    classificationSource: classification.source,
    duplicateCandidates: candidates.map((c) => ({ number: c.issueNumber, distance: c.distance })),
    duplicateVerification: verification,
    pendingActionId,
  };
}

async function processPullRequestOpened({ installationId, repoFullName, number }, { llmClient }) {
  const pullRequest = await getPullRequest(installationId, repoFullName, number);
  const files = await getPullRequestFiles(installationId, repoFullName, number);

  const summary = await summarizePullRequest(llmClient, {
    title: pullRequest.title,
    body: pullRequest.body || '',
    files,
  });

  if (summary) {
    await createComment(
      installationId,
      repoFullName,
      number,
      `**Summary of changes** (auto-generated)\n\n${summary}`
    );
  } else {
    logger.warn('Skipping PR summary comment — LLM summarization unavailable', { repoFullName, number });
  }

  return { filesChanged: files.length, summaryPosted: Boolean(summary) };
}

async function processEvent({ name, data }, deps = {}) {
  switch (name) {
    case 'installation':
      return processInstallation(data);

    case 'issues': {
      if (!(await isFeatureEnabled(data.repoFullName, 'triageEnabled'))) {
        return skipped('triage_disabled_for_repo', data.repoFullName);
      }
      return processIssueOpened(data, deps);
    }

    case 'pull_request': {
      if (data.eventAction === 'closed') {
        if (!(await isFeatureEnabled(data.repoFullName, 'docsSyncEnabled'))) {
          return skipped('docs_sync_disabled_for_repo', data.repoFullName);
        }
        return processPullRequestMerged(data, deps);
      }
      if (!(await isFeatureEnabled(data.repoFullName, 'prSummaryEnabled'))) {
        return skipped('pr_summary_disabled_for_repo', data.repoFullName);
      }
      return processPullRequestOpened(data, deps);
    }

    case 'push': {
      if (!(await isFeatureEnabled(data.repoFullName, 'releaseNotesEnabled'))) {
        return skipped('release_notes_disabled_for_repo', data.repoFullName);
      }
      return processTagPush(data, deps);
    }

    case 'stale-pr-scan':
      return runStalePrScan();

    case 'db-backup':
      return runBackup();

    default:
      logger.warn('Received unknown event name', { name });
      return { skipped: true };
  }
}

async function isFeatureEnabled(repoFullName, featureKey) {
  const settings = await getRepoSettings(repoFullName);
  return settings[featureKey];
}

function skipped(reason, repoFullName) {
  logger.info('Skipping event — feature disabled for this repo', { reason, repoFullName });
  return { skipped: true, reason };
}

module.exports = {
  processEvent,
  processInstallation,
  processIssueOpened,
  processPullRequestOpened,
  subjectTypeForEvent,
};
