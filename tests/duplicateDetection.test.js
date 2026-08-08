const { jaccardSimilarity, findLikelyDuplicates } = require('../src/triage/duplicateDetection');

describe('jaccardSimilarity', () => {
  it('returns 1 for identical titles (ignoring case/punctuation)', () => {
    expect(jaccardSimilarity('Login button broken!', 'login button broken')).toBe(1);
  });

  it('returns 0 for titles sharing no words', () => {
    expect(jaccardSimilarity('Login button broken', 'Add dark mode support')).toBe(0);
  });

  it('returns a partial score for overlapping-but-different titles', () => {
    const score = jaccardSimilarity('Login button is broken on mobile', 'Login button broken on desktop');
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(1);
  });

  it('returns 0 when either title has no usable words', () => {
    expect(jaccardSimilarity('', 'Login button broken')).toBe(0);
  });
});

describe('findLikelyDuplicates', () => {
  const candidates = [
    { number: 1, title: 'Login button is broken on mobile Safari' },
    { number: 2, title: 'Add support for dark mode' },
    { number: 3, title: 'Login button broken on mobile' },
  ];

  it('returns only candidates at or above the threshold, most similar first', () => {
    const result = findLikelyDuplicates('Login button broken on mobile devices', candidates);

    expect(result.length).toBeGreaterThan(0);
    expect(result[0].number).toBe(3);
    for (let i = 1; i < result.length; i += 1) {
      expect(result[i - 1].similarity).toBeGreaterThanOrEqual(result[i].similarity);
    }
  });

  it('excludes candidates below the threshold', () => {
    const result = findLikelyDuplicates('Login button broken on mobile devices', candidates);
    expect(result.some((c) => c.number === 2)).toBe(false);
  });

  it('returns an empty array when nothing is similar enough', () => {
    const result = findLikelyDuplicates('Completely unrelated topic here', candidates);
    expect(result).toEqual([]);
  });
});
