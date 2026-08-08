const { classifyIssueWithAI } = require('../src/triage/aiClassifier');

function fakeLLMClient(impl) {
  return { complete: jest.fn(impl) };
}

describe('classifyIssueWithAI', () => {
  it('uses the AI response when it is valid JSON matching the expected shape', async () => {
    const llmClient = fakeLLMClient(async () => ({
      content: JSON.stringify({ labels: ['bug'], priority: 'high', reasoning: 'Crashes on startup.' }),
      provider: 'gemini',
    }));

    const result = await classifyIssueWithAI(llmClient, { title: 'Crash', body: '' });

    expect(result).toEqual({
      labels: ['bug'],
      priority: 'high',
      reasoning: 'Crashes on startup.',
      source: 'ai',
      provider: 'gemini',
    });
  });

  it('strips a markdown code fence if the model wraps its JSON in one', async () => {
    const llmClient = fakeLLMClient(async () => ({
      content: '```json\n{"labels":["feature"],"priority":"medium","reasoning":"New capability request."}\n```',
      provider: 'gemini',
    }));

    const result = await classifyIssueWithAI(llmClient, { title: 'x', body: '' });
    expect(result.labels).toEqual(['feature']);
    expect(result.source).toBe('ai');
  });

  it('falls back to needs-triage label when AI returns an empty labels array', async () => {
    const llmClient = fakeLLMClient(async () => ({
      content: JSON.stringify({ labels: [], priority: 'low', reasoning: 'Unclear.' }),
      provider: 'gemini',
    }));

    const result = await classifyIssueWithAI(llmClient, { title: 'x', body: '' });
    expect(result.labels).toEqual(['needs-triage']);
  });

  it('falls back to the rule-based engine when the AI response is invalid JSON', async () => {
    const llmClient = fakeLLMClient(async () => ({ content: 'not json at all', provider: 'gemini' }));

    const result = await classifyIssueWithAI(llmClient, {
      title: 'App crashes on startup',
      body: 'throws an exception',
    });

    expect(result.source).toBe('rule-based-fallback');
    expect(result.labels).toContain('bug');
  });

  it('falls back to the rule-based engine when the AI response has an invalid priority value', async () => {
    const llmClient = fakeLLMClient(async () => ({
      content: JSON.stringify({ labels: ['bug'], priority: 'extremely-urgent', reasoning: 'x' }),
      provider: 'gemini',
    }));

    const result = await classifyIssueWithAI(llmClient, { title: 'Something broken', body: '' });
    expect(result.source).toBe('rule-based-fallback');
  });

  it('falls back to the rule-based engine when the AI response includes an invalid label', async () => {
    const llmClient = fakeLLMClient(async () => ({
      content: JSON.stringify({ labels: ['bug', 'security-vuln'], priority: 'high', reasoning: 'x' }),
      provider: 'gemini',
    }));

    const result = await classifyIssueWithAI(llmClient, { title: 'x', body: '' });
    expect(result.source).toBe('rule-based-fallback');
  });

  it('falls back to the rule-based engine when every LLM provider fails', async () => {
    const llmClient = fakeLLMClient(async () => {
      throw new Error('all providers down');
    });

    const result = await classifyIssueWithAI(llmClient, {
      title: 'README has a typo',
      body: '',
    });

    expect(result.source).toBe('rule-based-fallback');
    expect(result.labels).toContain('docs');
  });
});
