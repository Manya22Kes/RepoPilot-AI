const { createGeminiEmbeddingAdapter } = require('../src/embeddings/providers/geminiEmbeddingAdapter');

function fakeResponse(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body, text: async () => JSON.stringify(body) };
}

describe('createGeminiEmbeddingAdapter', () => {
  let adapter;

  beforeEach(() => {
    adapter = createGeminiEmbeddingAdapter({ apiKey: 'fake-key', model: 'text-embedding-004' });
  });

  it('returns a normalized embedding result', async () => {
    const vector = [0.1, 0.2, 0.3];
    global.fetch = jest.fn(async () => fakeResponse({ embedding: { values: vector } }));

    const result = await adapter.embed('some issue text');

    expect(result).toEqual({ embedding: vector, provider: 'gemini', model: 'text-embedding-004' });
  });

  it('throws if the response has no embedding values', async () => {
    global.fetch = jest.fn(async () => fakeResponse({}));
    await expect(adapter.embed('x')).rejects.toThrow(/no usable vector/);
  });

  it('throws on a non-retryable error status', async () => {
    global.fetch = jest.fn(async () => fakeResponse({ error: 'bad request' }, 400));
    await expect(adapter.embed('x')).rejects.toThrow(/HTTP 400/);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('retries on a 500 and succeeds', async () => {
    let calls = 0;
    global.fetch = jest.fn(async () => {
      calls += 1;
      if (calls === 1) return fakeResponse({ error: 'oops' }, 500);
      return fakeResponse({ embedding: { values: [1, 2, 3] } });
    });

    const result = await adapter.embed('x');
    expect(result.embedding).toEqual([1, 2, 3]);
    expect(calls).toBe(2);
  });
});
