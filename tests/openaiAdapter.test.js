const { createOpenAIAdapter } = require('../src/llm/providers/openaiAdapter');

function fakeResponse(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body, text: async () => JSON.stringify(body) };
}

describe('createOpenAIAdapter', () => {
  let adapter;

  beforeEach(() => {
    adapter = createOpenAIAdapter({ apiKey: 'fake-key', model: 'gpt-4o-mini' });
  });

  it('parses a successful response and sends the Authorization header', async () => {
    global.fetch = jest.fn(async (url, options) => {
      expect(options.headers.Authorization).toBe('Bearer fake-key');
      return fakeResponse({
        choices: [{ message: { content: 'hello there' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 8, completion_tokens: 4 },
      });
    });

    const result = await adapter.complete({ prompt: 'say hi' });

    expect(result).toEqual({
      content: 'hello there',
      provider: 'openai',
      model: 'gpt-4o-mini',
      usage: { promptTokens: 8, completionTokens: 4 },
    });
  });

  it('requests json_object response format when responseFormat is json', async () => {
    global.fetch = jest.fn(async (url, options) => {
      const body = JSON.parse(options.body);
      expect(body.response_format).toEqual({ type: 'json_object' });
      return fakeResponse({ choices: [{ message: { content: '{"ok":true}' } }] });
    });

    await adapter.complete({ prompt: 'give me json', responseFormat: 'json' });
  });

  it('throws with the response body on a non-retryable error', async () => {
    global.fetch = jest.fn(async () => fakeResponse({ error: { message: 'unauthorized' } }, 401));
    await expect(adapter.complete({ prompt: 'x' })).rejects.toThrow(/HTTP 401/);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('retries on a 429 and succeeds on the next attempt', async () => {
    let calls = 0;
    global.fetch = jest.fn(async () => {
      calls += 1;
      if (calls === 1) return fakeResponse({ error: 'rate limited' }, 429);
      return fakeResponse({ choices: [{ message: { content: 'ok after retry' } }] });
    });

    const result = await adapter.complete({ prompt: 'x' });
    expect(result.content).toBe('ok after retry');
    expect(calls).toBe(2);
  });
});
