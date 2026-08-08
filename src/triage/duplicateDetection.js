
const DUPLICATE_SIMILARITY_THRESHOLD = 0.5;

function tokenize(title) {
  return new Set(
    title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(Boolean)
  );
}

function jaccardSimilarity(titleA, titleB) {
  const setA = tokenize(titleA);
  const setB = tokenize(titleB);

  if (setA.size === 0 || setB.size === 0) return 0;

  let intersectionSize = 0;
  for (const word of setA) {
    if (setB.has(word)) intersectionSize += 1;
  }

  const unionSize = new Set([...setA, ...setB]).size;
  return intersectionSize / unionSize;
}

function findLikelyDuplicates(newTitle, candidateIssues, threshold = DUPLICATE_SIMILARITY_THRESHOLD) {
  return candidateIssues
    .map((issue) => ({ ...issue, similarity: jaccardSimilarity(newTitle, issue.title) }))
    .filter((issue) => issue.similarity >= threshold)
    .sort((a, b) => b.similarity - a.similarity);
}

module.exports = { jaccardSimilarity, findLikelyDuplicates, DUPLICATE_SIMILARITY_THRESHOLD };
