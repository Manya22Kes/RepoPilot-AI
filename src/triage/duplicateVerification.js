const logger = require('../utils/logger');
const { safeParseJSON } = require('../llm/jsonUtils');

const DUPLICATE_CONFIRMATION_THRESHOLD = 0.7;

function buildDuplicateVerificationPrompt({ newIssue, candidates }) {
  const candidateList = candidates.map((c) => `- #${c.issueNumber}: "${c.title}"`).join('\n');

  return [
    'You are reviewing whether a newly opened GitHub issue is a duplicate of any existing issue.',
    'The candidates below were retrieved by semantic similarity search, so some may be related but NOT true duplicates — a shared topic is not the same as describing the same underlying problem or request.',
    '',
    `New issue title: ${newIssue.title}`,
    `New issue body: ${newIssue.body || '(no description provided)'}`,
    '',
    'Candidates:',
    candidateList,
    '',
    'Respond with ONLY a JSON object (no markdown fences, no commentary) matching exactly this shape:',
    '{"isDuplicate": boolean, "matchedIssueNumber": number|null, "confidence": number, "reasoning": string}',
    '',
    '- "matchedIssueNumber" must be one of the candidate issue numbers above if isDuplicate is true, otherwise null.',
    '- "confidence" is a number from 0 to 1.',
  ].join('\n');
}

function isValidVerification(parsed, candidates) {
  if (!parsed || typeof parsed !== 'object') return false;
  if (typeof parsed.isDuplicate !== 'boolean') return false;
  if (typeof parsed.confidence !== 'number' || parsed.confidence < 0 || parsed.confidence > 1) return false;
  if (parsed.isDuplicate) {
    return candidates.some((c) => c.issueNumber === parsed.matchedIssueNumber);
  }
  return true;
}

function unverifiedResult(reasoning) {
  return { isDuplicate: false, matchedIssueNumber: null, confidence: 0, reasoning, source: 'unverified' };
}

async function verifyDuplicateWithAI(llmClient, { newIssue, candidates }) {
  if (candidates.length === 0) {
    return unverifiedResult('No similar issues found.');
  }

  try {
    const response = await llmClient.complete({
      prompt: buildDuplicateVerificationPrompt({ newIssue, candidates }),
      responseFormat: 'json',
      purpose: 'duplicate_verification',
    });

    const parsed = safeParseJSON(response.content);

    if (!isValidVerification(parsed, candidates)) {
      logger.warn('AI duplicate verification response was invalid', {
        rawContent: response.content?.slice(0, 200),
      });
      return unverifiedResult('AI verification returned an invalid response — flagged by similarity but not confirmed.');
    }

    return { ...parsed, source: 'ai' };
  } catch (err) {
    logger.warn('AI duplicate verification failed (all providers)', { error: err.message });
    return unverifiedResult('AI verification unavailable — flagged by similarity but not confirmed.');
  }
}

module.exports = { verifyDuplicateWithAI, buildDuplicateVerificationPrompt, DUPLICATE_CONFIRMATION_THRESHOLD };
