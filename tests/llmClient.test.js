const { createLLMClient } = require('../src/llm/LLMClient');

function fakeProvider(name, impl) {
  return { name, complete: jest.fn(impl) };
}

describe('createLLMClient', () => {
  it('throws if constructed with no providers', () => {
    expect(() => createLLMClient({ providers: [] })).toThrow(/at least one provider/i);
  });

  it('returns the primary provider result without touching the fallback', async () => {
    const primary = fakeProvider('primary', async () => ({ content: 'ok', provider: 'primary' }));
    const fallback = fakeProvider('fallback', async () => ({ content: 'fallback', provider: 'fallback' }));

    const client = createLLMClient({ providers: [primary, fallback] });
    const result = await client.complete({ prompt: 'hi' });

    expect(result.content).toBe('ok');
    expect(primary.complete).toHaveBeenCalledTimes(1);
    expect(fallback.complete).not.toHaveBeenCalled();
  });

  it('falls back to the next provider when the first one throws', async () => {
    const primary = fakeProvider('primary', async () => {
      throw new Error('primary is down');
    });
    const fallback = fakeProvider('fallback', async () => ({ content: 'from fallback', provider: 'fallback' }));

    const client = createLLMClient({ providers: [primary, fallback] });
    const result = await client.complete({ prompt: 'hi' });

    expect(result.content).toBe('from fallback');
    expect(primary.complete).toHaveBeenCalledTimes(1);
    expect(fallback.complete).toHaveBeenCalledTimes(1);
  });

  it('tries providers strictly in order', async () => {
    const calls = [];
    const first = fakeProvider('first', async () => {
      calls.push('first');
      throw new Error('nope');
    });
    const second = fakeProvider('second', async () => {
      calls.push('second');
      throw new Error('nope');
    });
    const third = fakeProvider('third', async () => {
      calls.push('third');
      return { content: 'ok', provider: 'third' };
    });

    const client = createLLMClient({ providers: [first, second, third] });
    await client.complete({ prompt: 'hi' });

    expect(calls).toEqual(['first', 'second', 'third']);
  });

  it('throws an aggregate error when every provider fails', async () => {
    const first = fakeProvider('first', async () => {
      throw new Error('first failed');
    });
    const second = fakeProvider('second', async () => {
      throw new Error('second failed');
    });

    const client = createLLMClient({ providers: [first, second] });

    await expect(client.complete({ prompt: 'hi' })).rejects.toThrow(/first failed/);
    await expect(client.complete({ prompt: 'hi' })).rejects.toThrow(/second failed/);
  });

  it('passes prompt and responseFormat through to the provider unchanged', async () => {
    const provider = fakeProvider('p', async (args) => ({ content: JSON.stringify(args), provider: 'p' }));
    const client = createLLMClient({ providers: [provider] });

    await client.complete({ prompt: 'the prompt', responseFormat: 'json' });

    expect(provider.complete).toHaveBeenCalledWith({ prompt: 'the prompt', responseFormat: 'json' });
  });
});
