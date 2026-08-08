const { withRetry } = require('../../utils/retry');
const { parseRetryAfterMs } = require('../../utils/rateLimitHeaders');

const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);

function createGeminiAdapter({ apiKey, model }) {
  return {
    name: 'gemini',

    async complete({ prompt, responseFormat }) {
      const body = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig:
          responseFormat === 'json' ? { responseMimeType: 'application/json' } : undefined,
      };

      const data = await withRetry(
        async () => {
          const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body),
            }
          );

          if (!response.ok) {
            const bodyText = await response.text();
            const error = new Error(`Gemini API request failed (HTTP ${response.status}): ${bodyText}`);
            error.status = response.status;
            error.retryAfterMs = parseRetryAfterMs(response);
            throw error;
          }

          return response.json();
        },
        { attempts: 3, baseDelayMs: 500, isRetryable: (err) => RETRYABLE_STATUS_CODES.has(err.status) }
      );

      const candidate = data.candidates?.[0];
      const content = candidate?.content?.parts?.map((part) => part.text).join('') ?? '';

      if (!content) {
        throw new Error(
          `Gemini returned no usable content (finishReason: ${candidate?.finishReason ?? 'unknown'})`
        );
      }

      return {
        content,
        provider: 'gemini',
        model,
        usage: {
          promptTokens: data.usageMetadata?.promptTokenCount ?? null,
          completionTokens: data.usageMetadata?.candidatesTokenCount ?? null,
        },
      };
    },
  };
}

module.exports = { createGeminiAdapter };
