const logger = require('../utils/logger');

function createLLMClient({ providers }) {
  if (!providers || providers.length === 0) {
    throw new Error('LLMClient requires at least one provider');
  }

  return {
    providers,

    async complete({ prompt, responseFormat }) {
      const errors = [];

      for (const provider of providers) {
        try {
          return await provider.complete({ prompt, responseFormat });
        } catch (err) {
          errors.push({ provider: provider.name, error: err.message });
          logger.warn('LLM provider failed, falling back to next provider', {
            provider: provider.name,
            error: err.message,
          });
        }
      }

      throw new Error(
        `All LLM providers failed: ${errors.map((e) => `${e.provider} (${e.error})`).join('; ')}`
      );
    },
  };
}

module.exports = { createLLMClient };
