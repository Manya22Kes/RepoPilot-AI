const PRICING_PER_TOKEN_USD = {
  gemini: {
    'gemini-1.5-flash': { prompt: 0.000000075, completion: 0.0000003 },
    'text-embedding-004': { prompt: 0, completion: 0 }, // Gemini embeddings are currently free at typical usage tiers
  },
  openai: {
    'gpt-4o-mini': { prompt: 0.00000015, completion: 0.0000006 },
  },
};

function estimateCostUsd(provider, model, promptTokens, completionTokens) {
  const rates = PRICING_PER_TOKEN_USD[provider]?.[model];
  if (!rates) return null;
  if (typeof promptTokens !== 'number' && typeof completionTokens !== 'number') return null;

  const promptCost = (promptTokens || 0) * rates.prompt;
  const completionCost = (completionTokens || 0) * rates.completion;
  return promptCost + completionCost;
}

module.exports = { estimateCostUsd, PRICING_PER_TOKEN_USD };
