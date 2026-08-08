const { classifyIssue, estimatePriority, FALLBACK_LABEL, DEFAULT_PRIORITY } = require('../src/triage/rules');

describe('classifyIssue', () => {
  it('labels an obvious bug report', () => {
    const { labels } = classifyIssue({
      title: 'App crashes on startup',
      body: 'It throws an exception every time and the app is broken.',
    });
    expect(labels).toContain('bug');
  });

  it('labels an obvious feature request', () => {
    const { labels } = classifyIssue({
      title: 'Feature request: dark mode',
      body: 'Would be nice to have support for a dark theme.',
    });
    expect(labels).toContain('feature');
  });

  it('labels a docs issue', () => {
    const { labels } = classifyIssue({
      title: 'README has a typo',
      body: 'Small documentation fix needed.',
    });
    expect(labels).toContain('docs');
  });

  it('labels a question', () => {
    const { labels } = classifyIssue({
      title: 'How do I configure the webhook secret?',
      body: '',
    });
    expect(labels).toContain('question');
  });

  it('can match multiple categories at once', () => {
    const { labels } = classifyIssue({
      title: 'Docs are wrong and it crashes',
      body: 'The readme is out of date and following it causes an exception.',
    });
    expect(labels).toEqual(expect.arrayContaining(['bug', 'docs']));
  });

  it('falls back to needs-triage when nothing matches', () => {
    const { labels } = classifyIssue({ title: 'zzz qqq unrelated words', body: '' });
    expect(labels).toEqual([FALLBACK_LABEL]);
  });
});

describe('estimatePriority', () => {
  it('flags urgent/security language as high priority', () => {
    expect(estimatePriority({ title: 'Critical security vulnerability', body: '' })).toBe('high');
    expect(estimatePriority({ title: 'Production is down', body: '' })).toBe('high');
  });

  it('flags cosmetic language as low priority', () => {
    expect(estimatePriority({ title: 'Minor typo in button label', body: '' })).toBe('low');
  });

  it('defaults to medium priority otherwise', () => {
    expect(estimatePriority({ title: 'Something happened', body: '' })).toBe(DEFAULT_PRIORITY);
  });
});
