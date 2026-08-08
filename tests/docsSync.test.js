const { checkDocsStaleness, touchesDocs, buildDocsStalenessPrompt } = require('../src/triage/docsSync');

function fakeLLMClient(impl) {
  return { complete: jest.fn(impl) };
}

describe('touchesDocs', () => {
  it('detects a top-level README', () => {
    expect(touchesDocs([{ filename: 'README.md' }])).toBe(true);
  });

  it('detects a nested README', () => {
    expect(touchesDocs([{ filename: 'packages/api/README.md' }])).toBe(true);
  });

  it('detects anything under a docs/ directory', () => {
    expect(touchesDocs([{ filename: 'docs/setup.md' }])).toBe(true);
  });

  it('returns false when no changed file is doc-related', () => {
    expect(touchesDocs([{ filename: 'src/index.js' }, { filename: 'src/utils/helper.js' }])).toBe(false);
  });

  it('is not fooled by a filename that merely contains "docs" as a substring', () => {
    expect(touchesDocs([{ filename: 'src/docsGenerator.js' }])).toBe(false);
  });
});

describe('checkDocsStaleness', () => {
  const files = [{ filename: 'src/api.js', status: 'modified', additions: 10, deletions: 2 }];

  it('returns the AI result when valid', async () => {
    const llmClient = fakeLLMClient(async () => ({
      content: JSON.stringify({
        docsLikelyStale: true,
        reasoning: 'Changes a public API signature.',
        suggestedUpdates: ['Update the API reference for `foo()`'],
      }),
    }));

    const result = await checkDocsStaleness(llmClient, { title: 'Change foo() signature', body: '', files });

    expect(result.docsLikelyStale).toBe(true);
    expect(result.suggestedUpdates).toEqual(['Update the API reference for `foo()`']);
  });

  it('fails closed (not stale) on invalid JSON', async () => {
    const llmClient = fakeLLMClient(async () => ({ content: 'not json' }));
    const result = await checkDocsStaleness(llmClient, { title: 'x', body: '', files });
    expect(result.docsLikelyStale).toBe(false);
  });

  it('fails closed (not stale) when suggestedUpdates is missing/invalid', async () => {
    const llmClient = fakeLLMClient(async () => ({
      content: JSON.stringify({ docsLikelyStale: true, reasoning: 'x' }), // missing suggestedUpdates
    }));
    const result = await checkDocsStaleness(llmClient, { title: 'x', body: '', files });
    expect(result.docsLikelyStale).toBe(false);
  });

  it('fails closed (not stale) when every LLM provider fails', async () => {
    const llmClient = fakeLLMClient(async () => {
      throw new Error('providers down');
    });
    const result = await checkDocsStaleness(llmClient, { title: 'x', body: '', files });
    expect(result.docsLikelyStale).toBe(false);
    expect(result.suggestedUpdates).toEqual([]);
  });
});

describe('buildDocsStalenessPrompt', () => {
  it('includes the PR title and changed file list', () => {
    const prompt = buildDocsStalenessPrompt({
      title: 'Rework auth flow',
      body: 'Switches to JWT.',
      files: [{ filename: 'src/auth.js', status: 'modified', additions: 5, deletions: 3 }],
    });
    expect(prompt).toContain('Rework auth flow');
    expect(prompt).toContain('src/auth.js');
  });
});
