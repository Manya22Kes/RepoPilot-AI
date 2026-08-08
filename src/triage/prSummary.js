const logger = require('../utils/logger');

const MAX_FILES_IN_PROMPT = 20;
const MAX_PATCH_CHARS_PER_FILE = 2000;

function buildFileSection(files) {
  const shown = files.slice(0, MAX_FILES_IN_PROMPT);
  const omittedCount = files.length - shown.length;

  const fileBlocks = shown.map((file) => {
    const patch = file.patch
      ? file.patch.length > MAX_PATCH_CHARS_PER_FILE
        ? `${file.patch.slice(0, MAX_PATCH_CHARS_PER_FILE)}\n... (diff truncated)`
        : file.patch
      : '(no diff available — binary file or too large to display)';

    return [
      `File: ${file.filename} (${file.status}, +${file.additions}/-${file.deletions})`,
      '```diff',
      patch,
      '```',
    ].join('\n');
  });

  if (omittedCount > 0) {
    fileBlocks.push(`(...and ${omittedCount} more changed file(s) not shown)`);
  }

  return fileBlocks.join('\n\n');
}

function buildPRSummaryPrompt({ title, body, files }) {
  return [
    'You are summarizing a pull request for a code reviewer. Be concise and specific.',
    'Write a short summary covering: (1) what changed, (2) why (based on the PR title/description), and (3) anything that looks risky or worth extra reviewer attention (e.g. missing tests, broad refactors, changes to auth/security-sensitive code).',
    'Do not just restate the file list — synthesize what the change actually does.',
    '',
    `PR title: ${title}`,
    `PR description: ${body || '(no description provided)'}`,
    '',
    'Changed files:',
    buildFileSection(files),
  ].join('\n');
}

async function summarizePullRequest(llmClient, { title, body, files }) {
  if (files.length === 0) {
    return 'This PR has no file changes to summarize.';
  }

  try {
    const response = await llmClient.complete({
      prompt: buildPRSummaryPrompt({ title, body, files }),
      responseFormat: 'text',
      purpose: 'pr_summary',
    });
    return response.content.trim();
  } catch (err) {
    logger.warn('PR summarization failed (all LLM providers)', { error: err.message });
    return null;
  }
}

module.exports = { summarizePullRequest, buildPRSummaryPrompt };
