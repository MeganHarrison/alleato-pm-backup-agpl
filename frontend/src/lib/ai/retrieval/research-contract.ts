import type { ToolSet } from "ai";

export type ExternalResearchSource =
  | "meetings"
  | "email"
  | "teams"
  | "onedrive";
export type ResearchSource = ExternalResearchSource;
export type ResearchAuthority = "operating_only";
export type ResearchReceiptStatus =
  | "complete"
  | "empty"
  | "denied"
  | "unavailable"
  | "timed_out"
  | "failed";

export type ExternalResearchRequest = {
  source: ExternalResearchSource;
  required: true;
  authority: "operating_only";
  query: string;
  queries: string[];
};

export type ResearchRequest = ExternalResearchRequest;

export type ChatTurnResearchContract = {
  version: 1;
  visibility: "closed";
  requests: ResearchRequest[];
};

export type ResearchReceipt = {
  source: ResearchSource;
  required: true;
  authority: ResearchAuthority;
  toolName: string;
  status: ResearchReceiptStatus;
  durationMs: number;
  payload?: unknown;
  error?: string;
};

export type ResearchCitation = {
  source: ResearchSource;
  documentId?: string;
  title: string;
  snippet?: string;
  url?: string;
  metadata: Record<string, unknown>;
};

type ResearchSourceDefinition = {
  label: string;
  toolNames: readonly string[];
  directRead: boolean;
  timeoutPerQueryMs?: number;
  mention?: RegExp;
};

const RESEARCH_SOURCE_DEFINITIONS: Record<
  ResearchSource,
  ResearchSourceDefinition
> = {
  meetings: {
    label: "meeting transcripts",
    toolNames: ["searchMeetingsByTopic"],
    directRead: true,
    // Meeting search performs an embedding request, keyword + semantic RPCs,
    // and a metadata fetch. A universal 3s external-source budget repeatedly
    // abandoned valid results before this multi-stage reader could finish.
    timeoutPerQueryMs: 12_000,
    mention: /\b(meeting|meetings|transcript|transcripts)\b/i,
  },
  email: {
    label: "Outlook email",
    toolNames: ["searchEmails"],
    directRead: true,
    timeoutPerQueryMs: 8_000,
    mention: /\b(email|emails|e-mail|e-mails|outlook)\b/i,
  },
  teams: {
    label: "Teams messages",
    toolNames: ["searchTeamsMessages"],
    directRead: true,
    timeoutPerQueryMs: 8_000,
    mention: /\bteams\b/i,
  },
  onedrive: {
    label: "OneDrive documents",
    toolNames: ["searchExternalDocuments"],
    directRead: true,
    timeoutPerQueryMs: 10_000,
    mention: /\b(onedrive|sharepoint|documents?|files?)\b/i,
  },
};

const RESEARCH_ACTION =
  /\b(search|look\s+(?:through|across|in)|review|analy[sz]e|map|trace|find|read|research|investigate|use)\b/i;

function operatingResearchQueries(message: string): string[] {
  return [message];
}

export function detectRequestedExternalResearchSources(
  message: string,
): ExternalResearchSource[] {
  if (!RESEARCH_ACTION.test(message)) return [];

  return (Object.keys(RESEARCH_SOURCE_DEFINITIONS) as ExternalResearchSource[])
    .filter((source) =>
      RESEARCH_SOURCE_DEFINITIONS[source].mention?.test(message),
    );
}

export function compileChatTurnResearchContract(input: {
  message: string;
  externalSources?: ExternalResearchSource[];
}): ChatTurnResearchContract | undefined {
  const externalSources =
    input.externalSources ?? detectRequestedExternalResearchSources(input.message);
  const queries = operatingResearchQueries(input.message);
  const requests: ResearchRequest[] = [];

  for (const source of externalSources) {
    if (requests.some((request) => request.source === source)) continue;
    requests.push({
      source,
      required: true,
      authority: "operating_only",
      query: input.message,
      queries,
    });
  }

  if (requests.length === 0) return undefined;
  return { version: 1, visibility: "closed", requests };
}

export function researchToolNames(
  contract: ChatTurnResearchContract | undefined,
): string[] {
  if (!contract) return [];
  return contract.requests
    .flatMap((request) => [
      ...RESEARCH_SOURCE_DEFINITIONS[request.source].toolNames,
    ])
    .filter((name, index, names) => names.indexOf(name) === index);
}

export function directResearchToolNames(
  contract: ChatTurnResearchContract | undefined,
): ReadonlySet<string> {
  if (!contract) return new Set();
  return new Set(
    contract.requests.flatMap((request) => {
      const definition = RESEARCH_SOURCE_DEFINITIONS[request.source];
      return definition.directRead ? [...definition.toolNames] : [];
    }),
  );
}

export function selectToolsForResearchContract(
  tools: ToolSet,
  contract: ChatTurnResearchContract | undefined,
  receipts?: ResearchReceipt[],
): ToolSet {
  if (!contract) return tools;
  const allowedToolNames = researchToolNames(contract);
  const missing = allowedToolNames.filter((name) => !tools[name]);
  if (missing.length > 0) {
    throw new Error(
      `Chat-turn research tools are unavailable: missing ${missing.join(", ")}.`,
    );
  }

  const unresolvedToolNames = contract.requests.flatMap((request) => {
    const receipt = receipts?.find((item) => item.source === request.source);
    const resolved = receipt && isSuccessfulReceipt(receipt);
    if (!resolved) return [...RESEARCH_SOURCE_DEFINITIONS[request.source].toolNames];
    return [];
  });

  return Object.fromEntries(
    unresolvedToolNames.map((name) => [name, tools[name]]),
  ) as ToolSet;
}

export function researchSourceLabel(source: ResearchSource): string {
  return RESEARCH_SOURCE_DEFINITIONS[source].label;
}

export function researchToolName(source: ResearchSource): string {
  return RESEARCH_SOURCE_DEFINITIONS[source].toolNames[0];
}

export function researchTimeoutMs(
  source: ExternalResearchSource,
  queryCount = 1,
): number {
  const timeoutPerQueryMs =
    RESEARCH_SOURCE_DEFINITIONS[source].timeoutPerQueryMs;
  if (!timeoutPerQueryMs) {
    throw new Error(`No bounded research timeout is registered for ${source}.`);
  }
  if (!Number.isInteger(queryCount) || queryCount < 1) {
    throw new Error(`Research query count must be a positive integer for ${source}.`);
  }
  return timeoutPerQueryMs * queryCount;
}

function isSuccessfulReceipt(receipt: ResearchReceipt): boolean {
  return receipt.status === "complete" || receipt.status === "empty";
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function resultItems(value: unknown): unknown[] {
  const record = asRecord(value);
  for (const key of ["results", "items", "data", "emails", "threads", "matches"]) {
    if (Array.isArray(record[key])) return record[key] as unknown[];
  }
  return [];
}

export function mergeResearchQueryResults(
  queries: string[],
  payloads: unknown[],
): Record<string, unknown> {
  const results: unknown[] = [];
  const seen = new Set<string>();
  const searches = payloads.map((payload, index) => {
    const outcome = classifyResearchResult(payload);
    const items = resultItems(payload);
    for (const item of items) {
      const record = asRecord(item);
      const key = [
        asString(record.id),
        asString(record.documentId),
        asString(record.title),
        asString(record.subject),
      ]
        .filter(Boolean)
        .join(":") || JSON.stringify(item) || String(item);
      if (seen.has(key)) continue;
      seen.add(key);
      results.push(item);
    }
    return {
      query: queries[index],
      status: outcome.status,
      resultCount: items.length,
      ...(outcome.error ? { error: outcome.error } : {}),
    };
  });
  const failures = searches.filter(
    (search) => search.status !== "complete" && search.status !== "empty",
  );

  return {
    queries,
    searches,
    resultCount: results.length,
    results,
    ...(failures.length > 0
      ? {
          error: `Research query expansion was incomplete: ${failures
            .map((failure) => `${failure.query}: ${failure.error ?? failure.status}`)
            .join("; ")}`,
        }
      : {}),
  };
}

export function researchReceiptEvidenceText(receipt: ResearchReceipt): string {
  const items = resultItems(receipt.payload).slice(0, 8);
  if (items.length === 0) {
    const payload = asRecord(receipt.payload);
    return asString(payload.message) ?? "No matching evidence was returned.";
  }

  return items
    .map((raw, index) => {
      const item = asRecord(raw);
      const title =
        asString(item.title) ??
        asString(item.subject) ??
        `${researchSourceLabel(receipt.source)} result ${index + 1}`;
      const date = asString(item.date);
      const content =
        asString(item.content) ?? asString(item.summary) ?? asString(item.snippet);
      const citation = asString(item.citation);
      return [
        `${index + 1}. ${title}${date ? ` (${date})` : ""}`,
        content ? `   ${content.slice(0, 900)}` : null,
        citation ? `   ${citation}` : null,
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n");
}

export function classifyResearchResult(value: unknown): {
  status: ResearchReceiptStatus;
  error?: string;
} {
  if (value == null) {
    return { status: "unavailable", error: "The source reader returned no result." };
  }

  const record = asRecord(value);
  const message = asString(record.message);
  if (
    message &&
    /do not have access|not assigned to any projects|cannot search .* safely/i.test(
      message,
    )
  ) {
    return { status: "denied", error: message };
  }
  const error =
    asString(record.error) ??
    (record.__toolError === true ? asString(record.message) : undefined);
  if (error) {
    if (/timed?\s*out|timeout|deadline exceeded/i.test(error)) {
      return { status: "timed_out", error };
    }
    if (/admin[- ]only|access denied|permission|not authorized|forbidden/i.test(error)) {
      return { status: "denied", error };
    }
    if (/unavailable|not configured|missing credential|could not reach/i.test(error)) {
      return { status: "unavailable", error };
    }
    return { status: "failed", error };
  }

  if (record.semanticSearchDegraded === true) {
    return {
      status: "failed",
      error:
        "The source reader returned partial keyword results because semantic search was unavailable.",
    };
  }

  const count = typeof record.count === "number" ? record.count : undefined;
  const items = resultItems(value);
  const hasExplicitItems = [
    "results",
    "items",
    "data",
    "emails",
    "threads",
    "matches",
  ].some((key) => Array.isArray(record[key]));
  if (
    count === 0 ||
    (hasExplicitItems && items.length === 0) ||
    (items.length === 0 && Object.keys(record).length === 0)
  ) {
    return { status: "empty" };
  }
  return { status: "complete" };
}

/**
 * Converts a raw live tool trace into the same receipt used by prefetch,
 * persistence, citations, and coverage checks. Only the primary evidence
 * reader for a requested source is eligible; analysis tools cannot masquerade
 * as source reads.
 */
export function researchReceiptFromToolTrace(
  contract: ChatTurnResearchContract | undefined,
  trace: Record<string, unknown>,
): ResearchReceipt | null {
  if (!contract) return null;
  const toolName = asString(trace.tool) ?? asString(trace.toolName);
  if (!toolName) return null;

  const request = contract.requests.find(
    (candidate) => researchToolName(candidate.source) === toolName,
  );
  if (!request) return null;

  const traceError = asString(trace.error);
  const payload = trace.output;
  const outcome = traceError
    ? classifyResearchResult({ error: traceError })
    : classifyResearchResult(payload);

  return {
    source: request.source,
    required: true,
    authority: request.authority,
    toolName,
    status: outcome.status,
    durationMs:
      typeof trace.durationMs === "number" && Number.isFinite(trace.durationMs)
        ? trace.durationMs
        : 0,
    ...(payload !== undefined ? { payload } : {}),
    ...(outcome.error ? { error: outcome.error } : {}),
  };
}

/**
 * Reconciles prefetch and live retries into one final ordered receipt set.
 * A later successful read is authoritative; a failed retry never downgrades a
 * successful prefetch. This prevents the answer and persisted audit record
 * from describing different source outcomes.
 */
export function mergeResearchReceipts(
  contract: ChatTurnResearchContract | undefined,
  prefetchReceipts: ResearchReceipt[] | undefined,
  liveReceipts: ResearchReceipt[] | undefined,
): ResearchReceipt[] {
  if (!contract) return [];

  return contract.requests.flatMap((request) => {
    const prefetched = prefetchReceipts?.find(
      (receipt) => receipt.source === request.source,
    );
    const live = (liveReceipts ?? []).filter(
      (receipt) => receipt.source === request.source,
    );
    const latestLiveSuccess = [...live].reverse().find(isSuccessfulReceipt);
    if (latestLiveSuccess) return [latestLiveSuccess];
    if (prefetched && isSuccessfulReceipt(prefetched)) return [prefetched];
    const latestLive = live.at(-1);
    return latestLive ? [latestLive] : prefetched ? [prefetched] : [];
  });
}

export function researchCoverageComplete(
  contract: ChatTurnResearchContract | undefined,
  receipts: ResearchReceipt[] | undefined,
): boolean {
  if (!contract) return true;
  return contract.requests.every((request) => {
    const receipt = receipts?.find((item) => item.source === request.source);
    return receipt?.status === "complete" || receipt?.status === "empty";
  });
}

export function researchReceiptMetadata(receipts: ResearchReceipt[] | undefined) {
  return (receipts ?? []).map((receipt) => ({
    source: receipt.source,
    required: receipt.required,
    authority: receipt.authority,
    toolName: receipt.toolName,
    status: receipt.status,
    durationMs: receipt.durationMs,
    error: receipt.error ?? null,
    evidenceCount: resultItems(receipt.payload).length,
  }));
}

function citationFromItem(
  source: ExternalResearchSource,
  raw: unknown,
  index: number,
): ResearchCitation | null {
  const item = asRecord(raw);
  const metadata = asRecord(item.metadata);
  const documentId =
    asString(item.id) ??
    asString(item.documentId) ??
    asString(metadata.metadata_id) ??
    asString(metadata.meeting_id);
  const title =
    asString(item.title) ??
    asString(item.subject) ??
    asString(metadata.title) ??
    asString(metadata.subject) ??
    `${researchSourceLabel(source)} result ${index + 1}`;
  const snippet =
    asString(item.content) ??
    asString(item.snippet) ??
    asString(item.text) ??
    asString(item.summary);
  const url =
    asString(item.url) ??
    asString(item.sourceUrl) ??
    asString(metadata.url) ??
    asString(metadata.fireflies_link);

  if (!documentId && !snippet && !url) return null;
  return {
    source,
    ...(documentId ? { documentId } : {}),
    title,
    ...(snippet ? { snippet: snippet.slice(0, 600) } : {}),
    ...(url ? { url } : {}),
    metadata: { ...metadata, type: source, title },
  };
}

export function researchReceiptCitations(
  receipts: ResearchReceipt[] | undefined,
): ResearchCitation[] {
  const citationGroups: ResearchCitation[][] = [];
  for (const receipt of receipts ?? []) {
    if (receipt.status !== "complete") continue;

    const externalSource = receipt.source;
    citationGroups.push(
      resultItems(receipt.payload)
        .slice(0, 12)
        .flatMap((item, index) => {
        const citation = citationFromItem(externalSource, item, index);
          return citation ? [citation] : [];
        }),
    );
  }

  // The persisted answer has a global citation cap. Allocate that budget
  // across sources so an early high-volume source cannot erase a later source
  // that the answer actually used.
  const citations: ResearchCitation[] = [];
  for (let index = 0; citations.length < 12; index += 1) {
    let added = false;
    for (const group of citationGroups) {
      const citation = group[index];
      if (!citation) continue;
      citations.push(citation);
      added = true;
      if (citations.length === 12) break;
    }
    if (!added) break;
  }
  return citations;
}
