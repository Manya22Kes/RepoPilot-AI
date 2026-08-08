const { isStale, shouldRenudge, buildNudgeComment } = require('../src/triage/staleProcessing');

const NOW = new Date('2026-07-30T00:00:00Z');

function daysAgo(n) {
  return new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000).toISOString();
}

describe('isStale', () => {
  it('is not stale when updated recently', () => {
    expect(isStale(daysAgo(1), NOW, 7)).toBe(false);
  });

  it('is not stale just under the threshold', () => {
    expect(isStale(daysAgo(6.9), NOW, 7)).toBe(false);
  });

  it('is stale at exactly the threshold', () => {
    expect(isStale(daysAgo(7), NOW, 7)).toBe(true);
  });

  it('is stale well past the threshold', () => {
    expect(isStale(daysAgo(30), NOW, 7)).toBe(true);
  });
});

describe('shouldRenudge', () => {
  it('renudges when never nudged before', () => {
    expect(shouldRenudge(null, NOW, 7)).toBe(true);
  });

  it('does not renudge within the cooldown window', () => {
    expect(shouldRenudge(daysAgo(2), NOW, 7)).toBe(false);
  });

  it('renudges once the cooldown has passed', () => {
    expect(shouldRenudge(daysAgo(8), NOW, 7)).toBe(true);
  });

  it('renudges at exactly the cooldown boundary', () => {
    expect(shouldRenudge(daysAgo(7), NOW, 7)).toBe(true);
  });
});

describe('buildNudgeComment', () => {
  it('includes the rounded-down day count', () => {
    const comment = buildNudgeComment(9.8);
    expect(comment).toMatch(/9 day/);
  });
});
