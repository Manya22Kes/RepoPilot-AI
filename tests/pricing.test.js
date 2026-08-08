const { estimateCostUsd } = require('../src/llm/pricing');

describe('estimateCostUsd', () => {
  it('computes cost from prompt and completion tokens for a known model', () => {
    const cost = estimateCostUsd('gemini', 'gemini-1.5-flash', 1000, 500);
    expect(cost).toBeCloseTo(1000 * 0.000000075 + 500 * 0.0000003, 10);
  });

  it('returns null for an unknown provider rather than guessing', () => {
    expect(estimateCostUsd('unknown-provider', 'some-model', 100, 50)).toBeNull();
  });

  it('returns null for a known provider but unlisted model', () => {
    expect(estimateCostUsd('gemini', 'gemini-9000-ultra', 100, 50)).toBeNull();
  });

  it('returns null when both token counts are missing', () => {
    expect(estimateCostUsd('gemini', 'gemini-1.5-flash', undefined, undefined)).toBeNull();
  });

  it('computes cost when only one of the token counts is present', () => {
    const cost = estimateCostUsd('openai', 'gpt-4o-mini', 200, undefined);
    expect(cost).toBeCloseTo(200 * 0.00000015, 10);
  });

  it('treats free-tier models (e.g. Gemini embeddings) as zero cost, not null', () => {
    const cost = estimateCostUsd('gemini', 'text-embedding-004', 100, 0);
    expect(cost).toBe(0);
  });
});
