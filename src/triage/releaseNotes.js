const logger = require('../utils/logger');
const {
  listReleases,
  compareCommits,
  listCommits,
  createDraftRelease,
} = require('../services/githubApi');

const MAX_COMMITS_IN_PROMPT = 100;

function buildReleaseNotesPrompt({ tagName, commits }) {
  const commitList = commits
    .slice(0, MAX_COMMITS_IN_PROMPT)
    .map((c) => `- ${c.message.split('\n')[0]} (${c.author})`)
    .join('\n');

  return [
    `You are drafting release notes for version ${tagName} of a software project, based on its commit history since the previous release.`,
    'Organize the notes into categories: "Features", "Fixes", "Docs", and "Other" — omit any category with nothing in it.',
    'Write each entry as a short, user-facing bullet point (what changed and why it matters), not a verbatim copy of the commit message.',
    'Respond in Markdown only — a "## Category" heading per non-empty category, with "- " bullet points underneath. No commentary before or after.',
    '',
    'Commits:',
    commitList,
  ].join('\n');
}

function buildFallbackNotes(commits) {
  const bullets = commits.map((c) => `- ${c.message.split('\n')[0]}`).join('\n');
  return `## Changes\n${bullets}`;
}

async function generateReleaseNotesBody(llmClient, { tagName, commits }) {
  if (commits.length === 0) {
    return 'No commits found since the previous release.';
  }

  try {
    const response = await llmClient.complete({
      prompt: buildReleaseNotesPrompt({ tagName, commits }),
      responseFormat: 'text',
      purpose: 'release_notes',
    });
    return response.content.trim();
  } catch (err) {
    logger.warn('Release notes generation failed (all LLM providers), using fallback bullet list', {
      error: err.message,
    });
    return buildFallbackNotes(commits);
  }
}

async function processTagPush({ installationId, repoFullName, tagName }, { llmClient }) {
  const previousReleases = await listReleases(installationId, repoFullName);
  const previousTag = previousReleases[0]?.tagName || null;

  const commits = previousTag
    ? await compareCommits(installationId, repoFullName, previousTag, tagName)
    : await listCommits(installationId, repoFullName, { sha: tagName, perPage: 50 });

  const body = await generateReleaseNotesBody(llmClient, { tagName, commits });

  await createDraftRelease(installationId, repoFullName, { tagName, name: tagName, body });

  return { tagName, previousTag, commitCount: commits.length, draftCreated: true };
}

module.exports = { processTagPush, generateReleaseNotesBody, buildReleaseNotesPrompt, buildFallbackNotes };
