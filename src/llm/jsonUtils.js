const logger = require('../utils/logger');

function safeParseJSON(text) {
  if (typeof text !== 'string') return null;

  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenceMatch ? fenceMatch[1] : text;

  try {
    return JSON.parse(candidate.trim());
  } catch (err) {
    logger.warn('Failed to parse LLM response as JSON', { error: err.message });
    return null;
  }
}

module.exports = { safeParseJSON };
