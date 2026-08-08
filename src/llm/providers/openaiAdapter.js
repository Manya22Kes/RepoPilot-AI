const { withRetry } = require('../../utils/retry');
const { parseRetryAfterMs } = require('../../utils/rateLimitHeaders');

const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);

function createOpenAIAdapter({ apiKey, model }) {
  return {
    name: 'openai',

    async complete({ prompt, responseFormat }) {
      const body = {
        model,
        messages: [{ role: 'user', content: prompt }],
        response_format: responseFormat === 'json' ? { type: 'json_object' } : undefined,
      };

      const data = await withRetry(
        async () => {
          const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
          });

          if (!response.ok) {
            const bodyText = await response.text();
            const error = new Error(`OpenAI API request failed (HTTP ${response.status}): ${bodyText}`);
            error.status = response.status;
            error.retryAfterMs = parseRetryAfterMs(response);
            throw error;
          }

          return response.json();
        },
        { attempts: 3, baseDelayMs: 500, isRetryable: (err) => RETRYABLE_STATUS_CODES.has(err.status) }
      );

      const content = data.choices?.[0]?.message?.content ?? '';

      if (!content) {
        throw new Error(
          `OpenAI returned no usable content (finish_reason: ${data.choices?.[0]?.finish_reason ?? 'unknown'})`
        );
      }

      return {
        content,
        provider: 'openai',
        model,
        usage: {
          promptTokens: data.usage?.prompt_tokens ?? null,
          completionTokens: data.usage?.completion_tokens ?? null,
        },
      };
    },
  };
}

module.exports = { createOpenAIAdapter };
