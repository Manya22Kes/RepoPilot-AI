function createEmbeddingClient({ provider }) {
  return {
    provider,
    model: provider.model,

    async embed(text) {
      return provider.embed(text);
    },
  };
}

module.exports = { createEmbeddingClient };
