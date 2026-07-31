export type StoredSpecDocumentRow = {
  id: string;
  title: string | null;
  content: string | null;
  raw_text: string | null;
  summary: string | null;
  overview: string | null;
  source: string | null;
  source_system: string | null;
  document_type: string | null;
  category: string | null;
};

export type SpecSourceResult = {
  documentId: string;
  title: string;
  excerptCount: number;
  excerpts: string[];
};

const SPEC_TITLE_KEYWORDS = [
  "spec",
  "specification",
  "division",
  "section",
  "csi",
  "requirements",
];

export function tokenizeSpecQuery(query: string): string[] {
  return Array.from(
    new Set(
      query
        .toLowerCase()
        .split(/[^a-z0-9.-]+/i)
        .map((token) => token.trim())
        .filter((token) => token.length >= 3),
    ),
  );
}

export function extractSpecSectionHints(query: string): string[] {
  return Array.from(
    new Set(
      query.match(/\b\d{2}(?:[-.\s]?\d{2,4}){1,3}\b/g)?.map((match) =>
        match.replace(/\s+/g, "-"),
      ) ?? [],
    ),
  );
}

export function compactWhitespace(
  value: string | null | undefined,
): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

export function buildSpecExcerpt(
  text: string,
  queryTokens: string[],
): string {
  const normalized = compactWhitespace(text);
  if (!normalized) return "";

  const lower = normalized.toLowerCase();
  const firstHit = queryTokens
    .map((token) => lower.indexOf(token))
    .filter((index) => index >= 0)
    .sort((a, b) => a - b)[0];

  if (firstHit === undefined) {
    return normalized.slice(0, 500);
  }

  const start = Math.max(0, firstHit - 140);
  const end = Math.min(normalized.length, firstHit + 360);
  return normalized.slice(start, end).trim();
}

function scoreStoredSpecDocument(
  row: StoredSpecDocumentRow,
  queryTokens: string[],
  specSectionHints: string[],
): number {
  const title = compactWhitespace(row.title).toLowerCase();
  const text = compactWhitespace(
    row.content ?? row.raw_text ?? row.summary ?? row.overview,
  ).toLowerCase();

  let score = 0;

  if (
    SPEC_TITLE_KEYWORDS.some((keyword) => title.includes(keyword)) ||
    row.category === "specification"
  ) {
    score += 6;
  }

  if (
    row.document_type?.toLowerCase().includes("spec") ||
    row.source_system?.toLowerCase().includes("spec")
  ) {
    score += 4;
  }

  for (const hint of specSectionHints) {
    const normalizedHint = hint.toLowerCase();
    if (title.includes(normalizedHint)) score += 7;
    if (text.includes(normalizedHint)) score += 5;
  }

  for (const token of queryTokens) {
    if (title.includes(token)) score += 3;
    if (text.includes(token)) score += 1;
  }

  return score;
}

function hasStoredSpecSignal(
  row: StoredSpecDocumentRow,
  specSectionHints: string[],
): boolean {
  const title = compactWhitespace(row.title).toLowerCase();
  const text = compactWhitespace(
    row.content ?? row.raw_text ?? row.summary ?? row.overview,
  ).toLowerCase();

  if (
    row.category === "specification" ||
    row.document_type?.toLowerCase().includes("spec") ||
    row.source_system?.toLowerCase().includes("spec") ||
    SPEC_TITLE_KEYWORDS.some((keyword) => title.includes(keyword))
  ) {
    return true;
  }

  return specSectionHints.some((hint) => {
    const normalizedHint = hint.toLowerCase();
    return title.includes(normalizedHint) || text.includes(normalizedHint);
  });
}

function hasStoredSpecQueryMatch(
  row: StoredSpecDocumentRow,
  queryTokens: string[],
  specSectionHints: string[],
): boolean {
  const searchableText = [
    row.title,
    row.content,
    row.raw_text,
    row.summary,
    row.overview,
  ]
    .map((value) => compactWhitespace(value).toLowerCase())
    .filter(Boolean)
    .join(" ");

  return (
    queryTokens.some((token) => searchableText.includes(token)) ||
    specSectionHints.some((hint) =>
      searchableText.includes(hint.toLowerCase()),
    )
  );
}

export function findStoredSpecDocumentMatches(
  rows: StoredSpecDocumentRow[],
  query: string,
  maxSources = 4,
): SpecSourceResult[] {
  const queryTokens = tokenizeSpecQuery(query);
  const specSectionHints = extractSpecSectionHints(query);

  return rows
    .map((row) => {
      const fullText = compactWhitespace(
        row.content ?? row.raw_text ?? row.summary ?? row.overview,
      );
      const score = scoreStoredSpecDocument(row, queryTokens, specSectionHints);
      return {
        row,
        score,
        hasSpecSignal: hasStoredSpecSignal(row, specSectionHints),
        hasQueryMatch: hasStoredSpecQueryMatch(
          row,
          queryTokens,
          specSectionHints,
        ),
        excerpt: buildSpecExcerpt(fullText, queryTokens),
      };
    })
    .filter(
      ({ score, excerpt, hasSpecSignal, hasQueryMatch }) =>
        hasSpecSignal && hasQueryMatch && score > 0 && excerpt.length > 0,
    )
    .sort((a, b) => b.score - a.score)
    .slice(0, maxSources)
    .map(({ row, excerpt }) => ({
      documentId: row.id,
      title: compactWhitespace(row.title) || row.id,
      excerptCount: 1,
      excerpts: [excerpt],
    }));
}
