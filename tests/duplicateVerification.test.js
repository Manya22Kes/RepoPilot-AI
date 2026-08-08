const { verifyDuplicateWithAI, DUPLICATE_CONFIRMATION_THRESHOLD } = require('../src/triage/duplicateVerification');

function fakeLLMClient(impl) {
  return { complete: jest.fn(impl) };
}

const candidates = [
  { issueNumber: 10, title: 'Login button broken on mobile', distance: 0.1 },
  { issueNumber: 11, title: 'Add dark mode', distance: 0.28 },
];

describe('verifyDuplicateWithAI', () => {
  it('returns unverified immediately when there are no candidates, without calling the LLM', async () => {
    const llmClient = fakeLLMClient(async () => {
      throw new Error('should not be called');
    });

    const result = await verifyDuplicateWithAI(llmClient, {
      newIssue: { title: 'x', body: '' },
      candidates: [],
    });

    expect(result.isDuplicate).toBe(false);
    expect(llmClient.complete).not.toHaveBeenCalled();
  });

  it('returns the AI verdict when it is valid and matches a real candidate', async () => {
    const llmClient = fakeLLMClient(async () => ({
      content: JSON.stringify({
        isDuplicate: true,
        matchedIssueNumber: 10,
        confidence: 0.92,
        reasoning: 'Same underlying bug.',
      }),
    }));

    const result = await verifyDuplicateWithAI(llmClient, {
      newIssue: { title: 'Login button broken', body: '' },
      candidates,
    });

    expect(result).toEqual({
      isDuplicate: true,
      matchedIssueNumber: 10,
      confidence: 0.92,
      reasoning: 'Same underlying bug.',
      source: 'ai',
    });
    expect(result.confidence).toBeGreaterThanOrEqual(DUPLICATE_CONFIRMATION_THRESHOLD);
  });

  it('treats a matchedIssueNumber not among the candidates as invalid and falls back to unverified', async () => {
    const llmClient = fakeLLMClient(async () => ({
      content: JSON.stringify({ isDuplicate: true, matchedIssueNumber: 999, confidence: 0.9, reasoning: 'x' }),
    }));

    const result = await verifyDuplicateWithAI(llmClient, {
      newIssue: { title: 'x', body: '' },
      candidates,
    });

    expect(result.isDuplicate).toBe(false);
    expect(result.source).toBe('unverified');
  });

  it('falls back to unverified on malformed JSON', async () => {
    const llmClient = fakeLLMClient(async () => ({ content: 'not json' }));

    const result = await verifyDuplicateWithAI(llmClient, {
      newIssue: { title: 'x', body: '' },
      candidates,
    });

    expect(result.isDuplicate).toBe(false);
    expect(result.source).toBe('unverified');
  });

  it('falls back to unverified when confidence is out of range', async () => {
    const llmClient = fakeLLMClient(async () => ({
      content: JSON.stringify({ isDuplicate: true, matchedIssueNumber: 10, confidence: 1.5, reasoning: 'x' }),
    }));

    const result = await verifyDuplicateWithAI(llmClient, {
      newIssue: { title: 'x', body: '' },
      candidates,
    });

    expect(result.source).toBe('unverified');
  });

  it('falls back to unverified when every LLM provider fails', async () => {
    const llmClient = fakeLLMClient(async () => {
      throw new Error('providers down');
    });

    const result = await verifyDuplicateWithAI(llmClient, {
      newIssue: { title: 'x', body: '' },
      candidates,
    });

    expect(result.isDuplicate).toBe(false);
    expect(result.source).toBe('unverified');
  });
});
