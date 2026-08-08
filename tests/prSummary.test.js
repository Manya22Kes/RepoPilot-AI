const { summarizePullRequest, buildPRSummaryPrompt } = require('../src/triage/prSummary');

function fakeLLMClient(impl) {
  return { complete: jest.fn(impl) };
}

describe('summarizePullRequest', () => {
  it('returns the trimmed AI summary on success', async () => {
    const llmClient = fakeLLMClient(async () => ({ content: '  This PR adds dark mode.  ' }));

    const result = await summarizePullRequest(llmClient, {
      title: 'Add dark mode',
      body: '',
      files: [{ filename: 'src/theme.js', status: 'added', additions: 20, deletions: 0, patch: '+ code' }],
    });

    expect(result).toBe('This PR adds dark mode.');
  });

  it('returns a canned message and skips the LLM call when there are no changed files', async () => {
    const llmClient = fakeLLMClient(async () => {
      throw new Error('should not be called');
    });

    const result = await summarizePullRequest(llmClient, { title: 'Empty PR', body: '', files: [] });

    expect(result).toMatch(/no file changes/i);
    expect(llmClient.complete).not.toHaveBeenCalled();
  });

  it('returns null (not a thrown error) when every LLM provider fails', async () => {
    const llmClient = fakeLLMClient(async () => {
      throw new Error('all providers down');
    });

    const result = await summarizePullRequest(llmClient, {
      title: 'x',
      body: '',
      files: [{ filename: 'a.js', status: 'modified', additions: 1, deletions: 1, patch: 'x' }],
    });

    expect(result).toBeNull();
  });

  it('handles a file with no patch (binary/too-large) without throwing', async () => {
    const llmClient = fakeLLMClient(async ({ prompt }) => {
      expect(prompt).toMatch(/no diff available/i);
      return { content: 'summary' };
    });

    await summarizePullRequest(llmClient, {
      title: 'x',
      body: '',
      files: [{ filename: 'image.png', status: 'added', additions: 0, deletions: 0, patch: null }],
    });
  });

  it('truncates a very long patch and notes the truncation', () => {
    const longPatch = '+'.repeat(5000);
    const prompt = buildPRSummaryPrompt({
      title: 'x',
      body: '',
      files: [{ filename: 'big.js', status: 'modified', additions: 100, deletions: 0, patch: longPatch }],
    });

    expect(prompt).toMatch(/diff truncated/);
    expect(prompt.length).toBeLessThan(longPatch.length);
  });

  it('notes omitted files beyond the cap without including their full diffs', () => {
    const manyFiles = Array.from({ length: 25 }, (_, i) => ({
      filename: `file${i}.js`,
      status: 'modified',
      additions: 1,
      deletions: 0,
      patch: 'x',
    }));

    const prompt = buildPRSummaryPrompt({ title: 'x', body: '', files: manyFiles });
    expect(prompt).toMatch(/more changed file\(s\) not shown/);
  });
});
