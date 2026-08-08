const { recordLlmCall } = require('../db/llmCalls');
const { estimateCostUsd } = require('./pricing');
const logger = require('../utils/logger');

async function safeRecord(fields) {
  try {
    const estimatedCostUsd = estimateCostUsd(
      fields.provider,
      fields.model,
      fields.promptTokens,
      fields.completionTokens
    );
    await recordLlmCall({ ...fields, estimatedCostUsd });
  } catch (err) {
    logger.warn('Failed to record LLM call for cost tracking (call itself still succeeded)', {
      error: err.message,
    });
  }
}

function withLLMCostTracking(llmClient, { triageRunId }) {
  return {
    async complete({ prompt, responseFormat, purpose = 'unspecified' }) {
      const response = await llmClient.complete({ prompt, responseFormat });

      await safeRecord({
        triageRunId,
        purpose,
        provider: response.provider,
        model: response.model,
        promptTokens: response.usage?.promptTokens ?? null,
        completionTokens: response.usage?.completionTokens ?? null,
      });

      return response;
    },
  };
}

function withEmbeddingCostTracking(embeddingClient, { triageRunId }) {
  return {
    async embed(text) {
      const result = await embeddingClient.embed(text);

      await safeRecord({
        triageRunId,
        purpose: 'duplicate_detection_embedding',
        provider: result.provider,
        model: result.model,
        promptTokens: null,
        completionTokens: null,
      });

      return result;
    },
  };
}

module.exports = { withLLMCostTracking, withEmbeddingCostTracking };
