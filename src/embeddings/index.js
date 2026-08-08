const config = require('../config');
const { createEmbeddingClient } = require('./EmbeddingClient');
const { createGeminiEmbeddingAdapter } = require('./providers/geminiEmbeddingAdapter');

function createDefaultEmbeddingClient() {
  if (config.llm.embeddingProvider === 'gemini') {
    if (!config.llm.gemini.apiKey) {
      throw new Error('EMBEDDING_PROVIDER is "gemini" but GEMINI_API_KEY is not set');
    }
    const provider = createGeminiEmbeddingAdapter({
      apiKey: config.llm.gemini.apiKey,
      model: config.llm.gemini.embeddingModel,
    });
    return createEmbeddingClient({ provider });
  }

  throw new Error(
    `Unsupported EMBEDDING_PROVIDER: ${config.llm.embeddingProvider} (only "gemini" is implemented — see EmbeddingClient.js for why this isn't a simple multi-provider list)`
  );
}

module.exports = { createDefaultEmbeddingClient };
