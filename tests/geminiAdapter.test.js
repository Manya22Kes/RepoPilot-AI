const { createGeminiAdapter } = require('../src/llm/providers/geminiAdapter');

function fakeResponse(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body, text: async () => JSON.stringify(body) };
}

describe('createGeminiAdapter', () => {
  let adapter;

  beforeEach(() => {
    adapter = createGeminiAdapter({ apiKey: 'fake-key', model: 'gemini-1.5-flash' });
  });

  it('parses a successful text response', async () => {
    global.fetch = jest.fn(async () =>
      fakeResponse({
        candidates: [{ content: { parts: [{ text: 'hello there' }] }, finishReason: 'STOP' }],
        usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 3 },
      })
    );

    const result = await adapter.complete({ prompt: 'say hi', responseFormat: 'text' });

    expect(result).toEqual({
      content: 'hello there',
      provider: 'gemini',
      model: 'gemini-1.5-flash',
      usage: { promptTokens: 10, completionTokens: 3 },
    });
  });

  it('requests JSON mime type when responseFormat is json', async () => {
    global.fetch = jest.fn(async (url, options) => {
      const body = JSON.parse(options.body);
      expect(body.generationConfig).toEqual({ responseMimeType: 'application/json' });
      return fakeResponse({ candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }] });
    });

    await adapter.complete({ prompt: 'give me json', responseFormat: 'json' });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('throws with the response body on a non-ok, non-retryable status', async () => {
    global.fetch = jest.fn(async () => fakeResponse({ error: { message: 'bad request' } }, 400));

    await expect(adapter.complete({ prompt: 'x' })).rejects.toThrow(/HTTP 400/);
    expect(global.fetch).toHaveBeenCalledTimes(1); // no retry on 400
  });

  it('retries on a 503 and succeeds on the next attempt', async () => {
    let calls = 0;
    global.fetch = jest.fn(async () => {
      calls += 1;
      if (calls === 1) return fakeResponse({ error: 'unavailable' }, 503);
      return fakeResponse({ candidates: [{ content: { parts: [{ text: 'ok after retry' }] } }] });
    });

    const result = await adapter.complete({ prompt: 'x' });
    expect(result.content).toBe('ok after retry');
    expect(calls).toBe(2);
  });

  it('throws if the response has no usable content', async () => {
    global.fetch = jest.fn(async () => fakeResponse({ candidates: [{ finishReason: 'SAFETY' }] }));
    await expect(adapter.complete({ prompt: 'x' })).rejects.toThrow(/no usable content/);
  });
});
