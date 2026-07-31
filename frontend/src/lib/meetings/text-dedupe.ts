const STOPWORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "but",
  "of",
  "to",
  "in",
  "on",
  "for",
  "with",
  "at",
  "by",
  "from",
  "as",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "may",
  "might",
  "could",
  "would",
  "should",
  "can",
  "will",
  "shall",
  "that",
  "this",
  "these",
  "those",
  "it",
  "its",
  "potential",
  "potentially",
  "possible",
  "possibly",
  "due",
  "if",
  "not",
]);

function tokenize(value: string): Set<string> {
  return new Set(
    value
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length > 2 && !STOPWORDS.has(word)),
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  if (a.size === 0 || b.size === 0) return 0;

  let intersection = 0;
  for (const word of a) {
    if (b.has(word)) intersection += 1;
  }

  const union = a.size + b.size - intersection;
  return intersection / union;
}

const DEFAULT_SIMILARITY_THRESHOLD = 0.6;

export function areSemanticallySimilar(
  left: string,
  right: string,
  similarityThreshold = DEFAULT_SIMILARITY_THRESHOLD,
): boolean {
  const leftText = left.trim();
  const rightText = right.trim();

  if (!leftText || !rightText) return false;

  return (
    jaccard(tokenize(leftText), tokenize(rightText)) >= similarityThreshold
  );
}

export function dedupeSemanticText(items: string[], similarityThreshold = DEFAULT_SIMILARITY_THRESHOLD): string[] {
  const result: { text: string; tokens: Set<string> }[] = [];

  for (const raw of items) {
    const text = raw.trim();
    if (!text) continue;

    const tokens = tokenize(text);
    const duplicate = result.find(
      (entry) => jaccard(entry.tokens, tokens) >= similarityThreshold,
    );

    if (duplicate) {
      if (text.length > duplicate.text.length) {
        duplicate.text = text;
        duplicate.tokens = tokens;
      }
      continue;
    }

    result.push({ text, tokens });
  }

  return result.map((entry) => entry.text);
}

export function dedupeSemanticItems<T>(
  items: T[],
  getText: (item: T) => string,
  similarityThreshold = DEFAULT_SIMILARITY_THRESHOLD,
): T[] {
  const result: Array<{ item: T; tokens: Set<string> }> = [];

  for (const item of items) {
    const text = getText(item).trim();
    if (!text) continue;

    const tokens = tokenize(text);
    const duplicate = result.find(
      (entry) => jaccard(entry.tokens, tokens) >= similarityThreshold,
    );

    if (!duplicate) {
      result.push({ item, tokens });
    }
  }

  return result.map((entry) => entry.item);
}
