const { withRetry } = require("../../utils/retry");
const { parseRetryAfterMs } = require("../../utils/rateLimitHeaders");

const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);

function createGeminiEmbeddingAdapter({ apiKey, model }) {
  return {
    name: "gemini",
    model,

    async embed(text) {
      const data = await withRetry(
        async () => {
          const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent?key=${apiKey}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                content: { parts: [{ text }] },
                outputDimensionality: 768,
              }),
            },
          );

          if (!response.ok) {
            const bodyText = await response.text();
            const error = new Error(
              `Gemini embedding request failed (HTTP ${response.status}): ${bodyText}`,
            );
            error.status = response.status;
            error.retryAfterMs = parseRetryAfterMs(response);
            throw error;
          }

          return response.json();
        },
        {
          attempts: 3,
          baseDelayMs: 500,
          isRetryable: (err) => RETRYABLE_STATUS_CODES.has(err.status),
        },
      );

      const values = data.embedding?.values;
      if (!Array.isArray(values) || values.length === 0) {
        throw new Error("Gemini embedding response contained no usable vector");
      }

      return { embedding: values, provider: "gemini", model };
    },
  };
}

module.exports = { createGeminiEmbeddingAdapter };
