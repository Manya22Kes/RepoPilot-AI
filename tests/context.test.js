const { runWithContext, getContext } = require('../src/utils/context');

describe('runWithContext / getContext', () => {
  it('returns an empty object when no context is active', () => {
    expect(getContext()).toEqual({});
  });

  it('makes the context available inside the callback', async () => {
    await runWithContext({ runId: 42, deliveryId: 'abc' }, () => {
      expect(getContext()).toEqual({ runId: 42, deliveryId: 'abc' });
    });
  });

  it('propagates through async/await chains, not just synchronous calls', async () => {
    async function nested() {
      await new Promise((resolve) => setTimeout(resolve, 5));
      return getContext();
    }

    const result = await runWithContext({ runId: 7 }, async () => nested());
    expect(result).toEqual({ runId: 7 });
  });

  it('does not leak context across separate runWithContext calls', async () => {
    await runWithContext({ runId: 1 }, () => {
      expect(getContext().runId).toBe(1);
    });

    // Outside any runWithContext call, context should be empty again.
    expect(getContext()).toEqual({});

    await runWithContext({ runId: 2 }, () => {
      expect(getContext().runId).toBe(2);
    });
  });

  it('isolates concurrent contexts from each other', async () => {
    const results = await Promise.all([
      runWithContext({ id: 'a' }, async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return getContext().id;
      }),
      runWithContext({ id: 'b' }, async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        return getContext().id;
      }),
    ]);

    expect(results).toEqual(['a', 'b']);
  });
});
