jest.mock('../src/db/llmCalls');
const { recordLlmCall } = require('../src/db/llmCalls');
const { withLLMCostTracking, withEmbeddingCostTracking } = require('../src/llm/costTracking');

describe('withLLMCostTracking', () => {
  beforeEach(() => {
    recordLlmCall.mockReset();
    recordLlmCall.mockResolvedValue(undefined);
  });

  it('returns the underlying response unchanged', async () => {
    const llmClient = { complete: jest.fn(async () => ({ content: 'hi', provider: 'gemini', model: 'gemini-1.5-flash' })) };
    const tracked = withLLMCostTracking(llmClient, { triageRunId: 42 });

    const result = await tracked.complete({ prompt: 'x', responseFormat: 'text' });

    expect(result).toEqual({ content: 'hi', provider: 'gemini', model: 'gemini-1.5-flash' });
  });

  it('records the call with tokens, provider/model, triageRunId, and an estimated cost', async () => {
    const llmClient = {
      complete: jest.fn(async () => ({
        content: 'hi',
        provider: 'gemini',
        model: 'gemini-1.5-flash',
        usage: { promptTokens: 100, completionTokens: 20 },
      })),
    };
    const tracked = withLLMCostTracking(llmClient, { triageRunId: 42 });

    await tracked.complete({ prompt: 'x', responseFormat: 'json', purpose: 'issue_classification' });

    expect(recordLlmCall).toHaveBeenCalledWith({
      triageRunId: 42,
      purpose: 'issue_classification',
      provider: 'gemini',
      model: 'gemini-1.5-flash',
      promptTokens: 100,
      completionTokens: 20,
      estimatedCostUsd: expect.any(Number),
    });
  });

  it('defaults purpose to "unspecified" when the caller does not provide one', async () => {
    const llmClient = { complete: jest.fn(async () => ({ content: 'hi', provider: 'gemini', model: 'gemini-1.5-flash' })) };
    const tracked = withLLMCostTracking(llmClient, { triageRunId: 1 });

    await tracked.complete({ prompt: 'x' });

    expect(recordLlmCall).toHaveBeenCalledWith(expect.objectContaining({ purpose: 'unspecified' }));
  });

  it('passes through only prompt/responseFormat to the wrapped client, not purpose', async () => {
    const llmClient = { complete: jest.fn(async () => ({ content: 'hi', provider: 'gemini', model: 'x' })) };
    const tracked = withLLMCostTracking(llmClient, { triageRunId: 1 });

    await tracked.complete({ prompt: 'the prompt', responseFormat: 'json', purpose: 'x' });

    expect(llmClient.complete).toHaveBeenCalledWith({ prompt: 'the prompt', responseFormat: 'json' });
  });

  it('does not fail the call if recording the cost fails', async () => {
    recordLlmCall.mockRejectedValue(new Error('db down'));
    const llmClient = { complete: jest.fn(async () => ({ content: 'hi', provider: 'gemini', model: 'gemini-1.5-flash' })) };
    const tracked = withLLMCostTracking(llmClient, { triageRunId: 1 });

    await expect(tracked.complete({ prompt: 'x' })).resolves.toEqual({
      content: 'hi',
      provider: 'gemini',
      model: 'gemini-1.5-flash',
    });
  });
});

describe('withEmbeddingCostTracking', () => {
  beforeEach(() => {
    recordLlmCall.mockReset();
    recordLlmCall.mockResolvedValue(undefined);
  });

  it('records the embedding call with null token counts and a fixed purpose', async () => {
    const embeddingClient = { embed: jest.fn(async () => ({ embedding: [0.1, 0.2], provider: 'gemini', model: 'text-embedding-004' })) };
    const tracked = withEmbeddingCostTracking(embeddingClient, { triageRunId: 7 });

    const result = await tracked.embed('some text');

    expect(result.embedding).toEqual([0.1, 0.2]);
    expect(recordLlmCall).toHaveBeenCalledWith({
      triageRunId: 7,
      purpose: 'duplicate_detection_embedding',
      provider: 'gemini',
      model: 'text-embedding-004',
      promptTokens: null,
      completionTokens: null,
      // Gemini's embedContent API never returns token counts, so pricing.js
      // correctly returns null here (no token data to apply even a known
      // rate to) — see pricing.test.js's "both token counts are missing" case.
      estimatedCostUsd: null,
    });
  });

  it('does not fail the embed call if recording fails', async () => {
    recordLlmCall.mockRejectedValue(new Error('db down'));
    const embeddingClient = { embed: jest.fn(async () => ({ embedding: [1], provider: 'gemini', model: 'text-embedding-004' })) };
    const tracked = withEmbeddingCostTracking(embeddingClient, { triageRunId: 1 });

    await expect(tracked.embed('x')).resolves.toEqual({ embedding: [1], provider: 'gemini', model: 'text-embedding-004' });
  });
});
