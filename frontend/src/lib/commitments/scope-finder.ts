export interface CommitmentScopeSource {
  id: string;
  projectId: number | null;
  commitmentType: "subcontract" | "purchase_order";
  contractCompanyId: string | null;
  companyName: string | null;
  contractNumber: string | null;
  title: string | null;
  description: string | null;
  inclusions: string | null;
  exclusions: string | null;
}

export interface CommitmentScopeLine {
  commitmentId: string;
  budgetCode: string | null;
  description: string | null;
  amount: number | null;
  lineNumber: number | null;
}

export interface CostCodeInsight {
  divisionTitle: string | null;
  title: string | null;
}

export interface CommitmentScopeRecord {
  id: string;
  projectId: number | null;
  commitmentType: "subcontract" | "purchase_order";
  contractCompanyId: string | null;
  companyName: string | null;
  contractNumber: string | null;
  title: string | null;
  costCodes: string[];
  tradeNames: string[];
  scopeSummary: string | null;
  primaryScopeText: string | null;
  inclusionSummary: string | null;
  exclusionSummary: string | null;
  searchableText: string;
}

export interface CommitmentScopeMatch {
  id: string;
  score: number;
  matchReason: string | null;
  matchedText: string | null;
}

const MAX_SCOPE_SUMMARY_LENGTH = 180;
const GENERIC_SOV_DESCRIPTION = /^cost of contracts/i;

function cleanText(value: string | null | undefined): string | null {
  const cleaned = value?.replace(/\s+/g, " ").trim();
  return cleaned ? cleaned : null;
}

function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  const sliced = value.slice(0, maxLength - 1).trimEnd();
  return `${sliced}...`;
}

function normalizeForCompare(value: string | null | undefined): string {
  return value?.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim() ?? "";
}

function compactCostCode(value: string): string {
  return value.replace(/[^A-Za-z0-9]/g, "").toLowerCase();
}

export function costCodeLookupKeys(value: string): string[] {
  const cleaned = cleanText(value);
  if (!cleaned) return [];

  const compact = compactCostCode(cleaned);
  const keys = new Set<string>([cleaned, compact]);

  if (/^\d{6}$/.test(compact)) {
    keys.add(`${compact.slice(0, 2)}-${compact.slice(2)}`);
    keys.add(`${compact.slice(0, 2)}-${compact.slice(2, 4)}-${compact.slice(4)}`);
  }

  return Array.from(keys);
}

function getCostCodeInsight(
  budgetCode: string | null,
  costCodeByBudgetCode: Map<string, CostCodeInsight>,
): CostCodeInsight | null {
  if (!budgetCode) return null;
  for (const key of costCodeLookupKeys(budgetCode)) {
    const insight = costCodeByBudgetCode.get(key);
    if (insight) return insight;
  }
  return null;
}

function isGenericSovDescription(value: string): boolean {
  return GENERIC_SOV_DESCRIPTION.test(value);
}

function parseTextSegments(value: string | null | undefined): string[] {
  if (!value) return [];
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?(p|div|li|ul|ol)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .split(/[\n\r]+|•|;(?=\s+[A-Z0-9])/)
    .map((item) => cleanText(item))
    .filter((item): item is string => Boolean(item));
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const cleaned = cleanText(value);
    if (!cleaned) continue;
    const normalized = normalizeForCompare(cleaned);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(cleaned);
  }

  return result;
}

function buildPrimaryScopeText(
  source: CommitmentScopeSource,
  orderedLines: CommitmentScopeLine[],
  costCodeByBudgetCode: Map<string, CostCodeInsight>,
): string | null {
  const description = cleanText(source.description);
  if (description) return description;

  const lineDescriptions = orderedLines
    .map((line) => {
      const lineDescription = cleanText(line.description);
      if (lineDescription && !isGenericSovDescription(lineDescription)) {
        return lineDescription;
      }
      const costCodeInsight = getCostCodeInsight(line.budgetCode, costCodeByBudgetCode);
      return cleanText(costCodeInsight?.title);
    })
    .filter((value): value is string => Boolean(value));

  return lineDescriptions[0] ?? cleanText(source.title);
}

function buildTradeNames(
  orderedLines: CommitmentScopeLine[],
  costCodeByBudgetCode: Map<string, CostCodeInsight>,
): string[] {
  return uniqueStrings(
    orderedLines.map((line) => getCostCodeInsight(line.budgetCode, costCodeByBudgetCode)?.divisionTitle),
  );
}

function buildScopeSummary(
  source: CommitmentScopeSource,
  orderedLines: CommitmentScopeLine[],
  costCodeByBudgetCode: Map<string, CostCodeInsight>,
): {
  primaryScopeText: string | null;
  inclusionSummary: string | null;
  exclusionSummary: string | null;
  scopeSummary: string | null;
} {
  const primaryScopeText = buildPrimaryScopeText(source, orderedLines, costCodeByBudgetCode);
  const inclusionSummary = parseTextSegments(source.inclusions)[0] ?? null;
  const exclusionSummary = parseTextSegments(source.exclusions)[0] ?? null;

  const summaryParts = uniqueStrings([
    primaryScopeText,
    inclusionSummary ? `Includes ${inclusionSummary}` : null,
    exclusionSummary ? `Excludes ${exclusionSummary}` : null,
  ]);

  if (summaryParts.length === 0) {
    return {
      primaryScopeText: null,
      inclusionSummary: null,
      exclusionSummary: null,
      scopeSummary: null,
    };
  }

  return {
    primaryScopeText,
    inclusionSummary,
    exclusionSummary,
    scopeSummary: truncateText(summaryParts.join(". "), MAX_SCOPE_SUMMARY_LENGTH),
  };
}

function buildSearchableText(parts: Array<string | null | undefined>): string {
  return parts
    .map((part) => cleanText(part))
    .filter((part): part is string => Boolean(part))
    .join(" \n");
}

export function buildCommitmentScopeRecords(
  sources: CommitmentScopeSource[],
  lines: CommitmentScopeLine[],
  costCodeByBudgetCode: Map<string, CostCodeInsight>,
): Map<string, CommitmentScopeRecord> {
  const linesByCommitment = new Map<string, CommitmentScopeLine[]>();

  for (const line of lines) {
    const existing = linesByCommitment.get(line.commitmentId) ?? [];
    existing.push(line);
    linesByCommitment.set(line.commitmentId, existing);
  }

  const records = new Map<string, CommitmentScopeRecord>();

  for (const source of sources) {
    const commitmentLines = linesByCommitment.get(source.id) ?? [];
    const orderedLines = [...commitmentLines].sort((a, b) => {
      const amountDelta = (Number(b.amount) || 0) - (Number(a.amount) || 0);
      if (amountDelta !== 0) return amountDelta;
      return (a.lineNumber ?? 0) - (b.lineNumber ?? 0);
    });

    const tradeNames = buildTradeNames(orderedLines, costCodeByBudgetCode);
    const costCodes = uniqueStrings(orderedLines.map((line) => cleanText(line.budgetCode)));
    const scopeSummary = buildScopeSummary(source, orderedLines, costCodeByBudgetCode);
    const lineDescriptions = uniqueStrings(
      orderedLines.map((line) => {
        const description = cleanText(line.description);
        if (description && !isGenericSovDescription(description)) {
          return description;
        }
        const costCodeInsight = getCostCodeInsight(line.budgetCode, costCodeByBudgetCode);
        return cleanText(costCodeInsight?.title);
      }),
    );

    records.set(source.id, {
      id: source.id,
      projectId: source.projectId,
      commitmentType: source.commitmentType,
      contractCompanyId: source.contractCompanyId,
      companyName: source.companyName,
      contractNumber: source.contractNumber,
      title: source.title,
      costCodes,
      tradeNames,
      scopeSummary: scopeSummary.scopeSummary,
      primaryScopeText: scopeSummary.primaryScopeText,
      inclusionSummary: scopeSummary.inclusionSummary,
      exclusionSummary: scopeSummary.exclusionSummary,
      searchableText: buildSearchableText([
        source.contractNumber,
        source.title,
        source.companyName,
        tradeNames.join(" "),
        scopeSummary.scopeSummary,
        source.description,
        source.inclusions,
        source.exclusions,
        lineDescriptions.join(" "),
      ]),
    });
  }

  return records;
}

function tokenizeQuery(query: string): string[] {
  return Array.from(
    new Set(
      query
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .map((token) => token.trim())
        .filter((token) => token.length >= 2),
    ),
  );
}

function countTokenMatches(haystack: string, tokens: string[]): number {
  let score = 0;
  for (const token of tokens) {
    if (haystack.includes(token)) score += 1;
  }
  return score;
}

function findMatchSnippet(
  record: CommitmentScopeRecord,
  normalizedQuery: string,
  tokens: string[],
): { matchReason: string | null; matchedText: string | null } {
  const candidates = [
    { label: "Title", value: cleanText(record.title) },
    { label: "Contract Company", value: cleanText(record.companyName) },
    { label: "Trade", value: cleanText(record.tradeNames.join(", ")) },
    { label: "Includes", value: cleanText(record.inclusionSummary) },
    { label: "Excludes", value: cleanText(record.exclusionSummary) },
    { label: "Scope", value: cleanText(record.scopeSummary) },
  ];

  for (const candidate of candidates) {
    const normalized = normalizeForCompare(candidate.value);
    if (!normalized) continue;
    if (normalizedQuery && normalized.includes(normalizedQuery)) {
      return { matchReason: candidate.label, matchedText: truncateText(candidate.value!, 180) };
    }
  }

  for (const candidate of candidates) {
    const normalized = normalizeForCompare(candidate.value);
    if (!normalized) continue;
    if (tokens.some((token) => normalized.includes(token))) {
      return { matchReason: candidate.label, matchedText: truncateText(candidate.value!, 180) };
    }
  }

  return { matchReason: null, matchedText: null };
}

export function searchCommitmentScopeRecords(
  records: CommitmentScopeRecord[],
  query: string,
  limit = 8,
): CommitmentScopeMatch[] {
  const normalizedQuery = normalizeForCompare(query);
  const tokens = tokenizeQuery(query);
  if (!normalizedQuery && tokens.length === 0) return [];

  const matches: CommitmentScopeMatch[] = [];

  for (const record of records) {
    let score = 0;
    const title = normalizeForCompare(record.title);
    const company = normalizeForCompare(record.companyName);
    const trades = normalizeForCompare(record.tradeNames.join(" "));
    const summary = normalizeForCompare(record.scopeSummary);
    const includes = normalizeForCompare(record.inclusionSummary);
    const excludes = normalizeForCompare(record.exclusionSummary);
    const fullText = normalizeForCompare(record.searchableText);

    if (normalizedQuery) {
      if (title.includes(normalizedQuery)) score += 12;
      if (company.includes(normalizedQuery)) score += 10;
      if (trades.includes(normalizedQuery)) score += 8;
      if (summary.includes(normalizedQuery)) score += 8;
      if (includes.includes(normalizedQuery)) score += 6;
      if (excludes.includes(normalizedQuery)) score += 6;
      if (fullText.includes(normalizedQuery)) score += 4;
    }

    score += countTokenMatches(title, tokens) * 4;
    score += countTokenMatches(company, tokens) * 4;
    score += countTokenMatches(trades, tokens) * 3;
    score += countTokenMatches(summary, tokens) * 3;
    score += countTokenMatches(includes, tokens) * 2;
    score += countTokenMatches(excludes, tokens) * 2;
    score += countTokenMatches(fullText, tokens);

    if (score <= 0) continue;

    const snippet = findMatchSnippet(record, normalizedQuery, tokens);
    matches.push({
      id: record.id,
      score,
      matchReason: snippet.matchReason,
      matchedText: snippet.matchedText,
    });
  }

  return matches
    .sort((left, right) => right.score - left.score)
    .slice(0, Math.max(1, Math.min(limit, 20)));
}
