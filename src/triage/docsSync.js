const logger = require('../utils/logger');
const { safeParseJSON } = require('../llm/jsonUtils');
const { getPullRequest, getPullRequestFiles, createComment } = require('../services/githubApi');
const { createPendingAction } = require('../db/pendingActions');

const DOCS_PATH_PATTERN = /(^|\/)(README|readme)(\.[a-zA-Z0-9]+)?$|(^|\/)docs\//;

function touchesDocs(files) {
  return files.some((file) => DOCS_PATH_PATTERN.test(file.filename));
}

function buildDocsStalenessPrompt({ title, body, files }) {
  const fileList = files.map((f) => `- ${f.filename} (${f.status}, +${f.additions}/-${f.deletions})`).join('\n');

  return [
    'A pull request just merged with no changes to any documentation files.',
    'Based on the PR title, description, and the list of changed (non-doc) files below, decide whether this change likely makes existing documentation stale — e.g. it changes a public API, CLI flag, config option, or documented behavior.',
    'A refactor with no behavior change, or an internal-only change, should NOT be flagged.',
    '',
    `PR title: ${title}`,
    `PR description: ${body || '(no description provided)'}`,
    '',
    'Changed files:',
    fileList,
    '',
    'Respond with ONLY a JSON object (no markdown fences, no commentary) matching exactly this shape:',
    '{"docsLikelyStale": boolean, "reasoning": string, "suggestedUpdates": string[]}',
    '- "suggestedUpdates" is a short list of specific doc changes to consider (empty array if docsLikelyStale is false).',
  ].join('\n');
}

function isValidStalenessResult(parsed) {
  if (!parsed || typeof parsed !== 'object') return false;
  if (typeof parsed.docsLikelyStale !== 'boolean') return false;
  if (!Array.isArray(parsed.suggestedUpdates)) return false;
  return true;
}

async function checkDocsStaleness(llmClient, { title, body, files }) {
  try {
    const response = await llmClient.complete({
      prompt: buildDocsStalenessPrompt({ title, body, files }),
      responseFormat: 'json',
      purpose: 'docs_staleness_check',
    });

    const parsed = safeParseJSON(response.content);

    if (!isValidStalenessResult(parsed)) {
      logger.warn('Docs-staleness response was invalid, defaulting to not-stale', {
        rawContent: response.content?.slice(0, 200),
      });
      return { docsLikelyStale: false, reasoning: null, suggestedUpdates: [] };
    }

    return parsed;
  } catch (err) {
    logger.warn('Docs-staleness check failed (all LLM providers), defaulting to not-stale', {
      error: err.message,
    });
    return { docsLikelyStale: false, reasoning: null, suggestedUpdates: [] };
  }
}

async function processPullRequestMerged({ installationId, repoFullName, number, triageRunId }, { llmClient }) {
  const files = await getPullRequestFiles(installationId, repoFullName, number);

  if (touchesDocs(files)) {
    return { docsChecked: false, reason: 'PR already touched docs', docsLikelyStale: false };
  }

  const pullRequest = await getPullRequest(installationId, repoFullName, number);
  const staleness = await checkDocsStaleness(llmClient, {
    title: pullRequest.title,
    body: pullRequest.body || '',
    files,
  });

  let pendingActionId = null;
  if (staleness.docsLikelyStale) {
    await createComment(
      installationId,
      repoFullName,
      number,
      `This merged PR doesn't touch documentation, but might make it stale. ${staleness.reasoning}\n\n` +
        `Suggested updates (for maintainer review — not applied automatically):\n` +
        staleness.suggestedUpdates.map((s) => `- ${s}`).join('\n')
    );

    pendingActionId = await createPendingAction({
      triageRunId,
      installationId,
      repoFullName,
      issueNumber: number,
      actionType: 'docs_update_suggestion',
      payload: { reasoning: staleness.reasoning, suggestedUpdates: staleness.suggestedUpdates },
    });
  }

  return { docsChecked: true, docsLikelyStale: staleness.docsLikelyStale, pendingActionId };
}

module.exports = { processPullRequestMerged, checkDocsStaleness, touchesDocs, buildDocsStalenessPrompt };
