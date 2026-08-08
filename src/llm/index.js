const config = require('../config');
const { createLLMClient } = require('./LLMClient');
const { createGeminiAdapter } = require('./providers/geminiAdapter');
const { createOpenAIAdapter } = require('./providers/openaiAdapter');
const logger = require('../utils/logger');

function buildAdapter(providerName) {
  if (providerName === 'gemini' && config.llm.gemini.apiKey) {
    return createGeminiAdapter({ apiKey: config.llm.gemini.apiKey, model: config.llm.gemini.model });
  }
  if (providerName === 'openai' && config.llm.openai.apiKey) {
    return createOpenAIAdapter({ apiKey: config.llm.openai.apiKey, model: config.llm.openai.model });
  }
  return null;
}

function createDefaultLLMClient() {
  const adapters = config.llm.providerOrder.map(buildAdapter).filter(Boolean);

  if (adapters.length < config.llm.providerOrder.length) {
    const skipped = config.llm.providerOrder.filter((name) => !buildAdapter(name));
    logger.warn('Skipping LLM provider(s) with no API key configured', { skipped });
  }

  return createLLMClient({ providers: adapters });
}

module.exports = { createDefaultLLMClient };
