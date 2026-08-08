const { generateReleaseNotesBody, buildReleaseNotesPrompt, buildFallbackNotes } = require('../src/triage/releaseNotes');

function fakeLLMClient(impl) {
  return { complete: jest.fn(impl) };
}

const SAMPLE_COMMITS = [
  { sha: 'a1', message: 'Add dark mode toggle', author: 'alice' },
  { sha: 'b2', message: 'Fix crash on empty input', author: 'bob' },
];

describe('generateReleaseNotesBody', () => {
  it('returns the trimmed AI-generated notes on success', async () => {
    const llmClient = fakeLLMClient(async () => ({ content: '  ## Features\n- Dark mode\n  ' }));
    const result = await generateReleaseNotesBody(llmClient, { tagName: 'v1.1.0', commits: SAMPLE_COMMITS });
    expect(result).toBe('## Features\n- Dark mode');
  });

  it('returns a canned message and skips the LLM call when there are no commits', async () => {
    const llmClient = fakeLLMClient(async () => {
      throw new Error('should not be called');
    });
    const result = await generateReleaseNotesBody(llmClient, { tagName: 'v1.0.0', commits: [] });
    expect(result).toMatch(/no commits found/i);
    expect(llmClient.complete).not.toHaveBeenCalled();
  });

  it('falls back to a flat bullet list of commit messages when every LLM provider fails', async () => {
    const llmClient = fakeLLMClient(async () => {
      throw new Error('all providers down');
    });
    const result = await generateReleaseNotesBody(llmClient, { tagName: 'v1.1.0', commits: SAMPLE_COMMITS });
    expect(result).toContain('Add dark mode toggle');
    expect(result).toContain('Fix crash on empty input');
  });
});

describe('buildReleaseNotesPrompt', () => {
  it('includes the tag name and commit messages with authors', () => {
    const prompt = buildReleaseNotesPrompt({ tagName: 'v2.0.0', commits: SAMPLE_COMMITS });
    expect(prompt).toContain('v2.0.0');
    expect(prompt).toContain('Add dark mode toggle (alice)');
    expect(prompt).toContain('Fix crash on empty input (bob)');
  });

  it('only uses the first line of multi-line commit messages', () => {
    const prompt = buildReleaseNotesPrompt({
      tagName: 'v1.0.0',
      commits: [{ sha: 'x', message: 'Short summary\n\nLong body text here', author: 'carol' }],
    });
    expect(prompt).toContain('Short summary (carol)');
    expect(prompt).not.toContain('Long body text here');
  });
});

describe('buildFallbackNotes', () => {
  it('produces a flat, uncategorized bullet list', () => {
    const notes = buildFallbackNotes(SAMPLE_COMMITS);
    expect(notes).toBe('## Changes\n- Add dark mode toggle\n- Fix crash on empty input');
  });
});
