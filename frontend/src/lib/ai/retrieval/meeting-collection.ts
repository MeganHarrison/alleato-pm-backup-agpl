import { generateText, Output } from "ai";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { getLanguageModel } from "@/lib/ai/providers";
import type { ToolGuardrails } from "@/lib/ai/tools/guardrails";
import { withoutLeadershipRestricted } from "@/lib/ai/leadership-restriction";
import { loadMeetingTranscriptContent } from "@/lib/meetings/transcript-content";
import type {
  MeetingCollectionFailure,
  MeetingCollectionItem,
  MeetingCollectionRequest,
  MeetingCollectionResult,
} from "./types";

const COLLECTION_SELECTOR_MODEL =
  process.env.AI_ASSISTANT_COLLECTION_SELECTOR_MODEL ?? "openai/gpt-4.1-mini";
const ENUMERATION_PAGE_SIZE = 500;
const MAX_ENUMERATED_MEETINGS = 10_000;
const MAX_MATCHED_MEETINGS = 100;
const SELECTOR_BATCH_SIZE = 50;
const SELECTOR_CONCURRENCY = 3;
const DETAIL_BATCH_SIZE = 25;
const TRANSCRIPT_FETCH_CONCURRENCY = 5;

export type MeetingMetadataCandidate = Pick<
  Database["public"]["Tables"]["document_metadata"]["Row"],
  | "id"
  | "title"
  | "date"
  | "category"
  | "meeting_type"
  | "project"
  | "project_id"
  | "participants"
  | "participants_array"
  | "summary"
  | "overview"
> & {
  titleFamily?: string | null;
  siblingCategories?: string[];
  siblingCount?: number;
};

type MeetingDetailRow = MeetingMetadataCandidate &
  Pick<
    Database["public"]["Tables"]["document_metadata"]["Row"],
    "url" | "source" | "source_web_url" | "content"
  >;

const candidateSelectionSchema = z.object({
  selected: z
    .array(
      z.object({
        id: z.string(),
        confidence: z.enum(["high", "medium"]),
        matchReason: z.string().max(300),
      }),
    )
    .max(SELECTOR_BATCH_SIZE),
  rationale: z.string().max(800),
});

export type MeetingCandidateSelector = (input: {
  request: MeetingCollectionRequest;
  candidates: MeetingMetadataCandidate[];
}) => Promise<string[]>;

function compactCandidate(candidate: MeetingMetadataCandidate) {
  return {
    id: candidate.id,
    title: candidate.title,
    date: candidate.date,
    category: candidate.category,
    meetingType: candidate.meeting_type,
    project: candidate.project,
    projectId: candidate.project_id,
    participants:
      candidate.participants_array?.length
        ? candidate.participants_array
        : candidate.participants,
    summary: candidate.summary?.slice(0, 500) ?? candidate.overview?.slice(0, 500) ?? null,
    titleFamily: candidate.titleFamily ?? null,
    siblingCategories: candidate.siblingCategories ?? [],
    siblingCount: candidate.siblingCount ?? 1,
  };
}

export async function selectMeetingCollectionCandidates(input: {
  request: MeetingCollectionRequest;
  candidates: MeetingMetadataCandidate[];
}): Promise<string[]> {
  if (input.request.scope === "single_entity") {
    return input.candidates.map((candidate) => candidate.id);
  }

  const result = await generateText({
    model: getLanguageModel(COLLECTION_SELECTOR_MODEL),
    output: Output.object({
      schema: candidateSelectionSchema,
      name: "meeting_collection_selection",
      description:
        "The complete set of candidate meeting IDs matching the collection's semantic criteria.",
    }),
    instructions: [
      "Select meeting records for a collection operation using their metadata.",
      "Interpret the semantic criteria, not merely a shared word in the title.",
      "For exhaustive requests, include every candidate that satisfies the criteria and exclude every candidate that does not.",
      "When criteria are literal (for example an exact title/category/date condition), apply them literally.",
      "A shared generic noun is not evidence of a match. Select a candidate only when its combined title, category, meeting type, project, and participants affirmatively identify the requested business record.",
      "Treat the specific title as stronger evidence than a conflicting broad category label. titleFamily and siblingCategories are consistency evidence derived from records with the same repeated title template.",
      "Use medium confidence only when the metadata still affirmatively identifies the requested record type; omit merely possible or adjacent candidates.",
      "Return only IDs that appear in the candidate list. Do not invent IDs.",
      "Do not select a record merely because it is topically adjacent.",
    ].join("\n"),
    prompt: [
      `Original request: ${input.request.originalRequest}`,
      `Semantic inclusion criteria: ${input.request.semanticCriteria}`,
      `Scope: ${input.request.scope}`,
      `Exhaustive coverage required: ${input.request.requiresExhaustiveCoverage}`,
      "Candidates:",
      JSON.stringify(input.candidates.map(compactCandidate)),
    ].join("\n\n"),
  });

  const allowed = new Set(input.candidates.map((candidate) => candidate.id));
  return [...new Set(result.output.selected.map((item) => item.id))].filter((id) =>
    allowed.has(id),
  );
}

function normalize(value: string | null | undefined): string {
  return (value ?? "").normalize("NFKC").toLocaleLowerCase().replace(/\s+/g, " ").trim();
}

function stemMetadataToken(token: string): string {
  if (token.length > 5 && token.endsWith("ies")) {
    return `${token.slice(0, -3)}y`;
  }
  if (token.length > 4 && token.endsWith("s") && !token.endsWith("ss")) {
    return token.slice(0, -1);
  }
  return token;
}

export function normalizeMeetingMetadataForMatching(value: string): string {
  return normalize(value)
    .split(/([^\p{L}\p{N}]+)/u)
    .map((part) =>
      /^[\p{L}\p{N}]+$/u.test(part) ? stemMetadataToken(part) : part,
    )
    .join("");
}

function candidateSearchText(candidate: MeetingMetadataCandidate): string {
  return normalize(
    [
      candidate.title,
      candidate.category,
      candidate.meeting_type,
      candidate.project,
      candidate.participants,
      ...(candidate.participants_array ?? []),
    ]
      .filter(Boolean)
      .join(" | "),
  );
}

const GENERIC_QUERY_WORDS = new Set([
  "about",
  "across",
  "all",
  "analyze",
  "compare",
  "complete",
  "every",
  "find",
  "from",
  "into",
  "list",
  "matching",
  "read",
  "search",
  "summarize",
  "tell",
  "that",
  "their",
  "these",
  "this",
  "with",
]);

export function expandMeetingCandidateSearchTerms(searchTerms: string[]): string[] {
  const expanded = new Set<string>();
  for (const rawTerm of searchTerms) {
    const term = normalizeMeetingMetadataForMatching(rawTerm);
    if (!term) continue;
    expanded.add(term);
    for (const token of term.split(/[^\p{L}\p{N}]+/u)) {
      if (token.length >= 4 && !GENERIC_QUERY_WORDS.has(token)) {
        expanded.add(token);
      }
    }
  }
  return [...expanded];
}

function rawTitleFamily(title: string | null): string | null {
  const normalized = normalize(title);
  const segments = normalized
    .split(/\s*[-–—]\s*/)
    .map((segment) => segment.trim())
    .filter(Boolean);
  const suffix = segments.at(-1) ?? "";
  return suffix.split(/\s+/).length >= 3 ? suffix : null;
}

export function enrichMeetingCandidateFamilies(
  candidates: MeetingMetadataCandidate[],
): MeetingMetadataCandidate[] {
  const rawFamilies = candidates.map((candidate) => rawTitleFamily(candidate.title));
  const counts = new Map<string, number>();
  rawFamilies.forEach((family) => {
    if (family) counts.set(family, (counts.get(family) ?? 0) + 1);
  });

  const familyKeys = candidates.map((candidate, index) => {
    const rawFamily = rawFamilies[index];
    return rawFamily && (counts.get(rawFamily) ?? 0) >= 2
      ? rawFamily
      : normalize(candidate.title);
  });
  const familyCounts = new Map<string, number>();
  familyKeys.forEach((family) => {
    if (family) familyCounts.set(family, (familyCounts.get(family) ?? 0) + 1);
  });

  const categoriesByFamily = new Map<string, Set<string>>();
  candidates.forEach((candidate, index) => {
    const family = familyKeys[index];
    if (!family) return;
    const categories = categoriesByFamily.get(family) ?? new Set<string>();
    if (candidate.category?.trim()) categories.add(candidate.category.trim());
    categoriesByFamily.set(family, categories);
  });

  return candidates.map((candidate, index) => {
    const titleFamily = familyKeys[index] ?? "";
    return {
      ...candidate,
      titleFamily,
      siblingCategories: [
        ...(categoriesByFamily.get(titleFamily) ?? new Set<string>()),
      ],
      siblingCount: familyCounts.get(titleFamily) ?? 1,
    };
  });
}

export function expandSelectedMeetingFamilies(
  candidates: MeetingMetadataCandidate[],
  selectedIds: string[],
): string[] {
  const selected = new Set(selectedIds);
  const selectedFamilies = new Set(
    candidates
      .filter(
        (candidate) =>
          selected.has(candidate.id) && (candidate.siblingCount ?? 1) >= 2,
      )
      .map((candidate) => candidate.titleFamily)
      .filter((family): family is string => Boolean(family)),
  );
  for (const candidate of candidates) {
    if (candidate.titleFamily && selectedFamilies.has(candidate.titleFamily)) {
      selected.add(candidate.id);
    }
  }
  return [...selected];
}

export function hasCompiledQueryAlignment(
  candidate: MeetingMetadataCandidate,
  request: MeetingCollectionRequest,
): boolean {
  if (
    request.scope === "single_entity" ||
    request.titleContains ||
    request.category ||
    request.participant
  ) {
    return true;
  }

  const phrases = request.searchTerms
    .map(normalizeMeetingMetadataForMatching)
    .filter(Boolean);
  if (phrases.length === 0) return true;

  const queryTokens = new Set(
    expandMeetingCandidateSearchTerms(request.searchTerms).filter(
      (term) => !term.includes(" "),
    ),
  );
  const aligns = (metadata: string) => {
    if (phrases.some((phrase) => metadata.includes(phrase))) return true;
    const alignedTokens = [...queryTokens].filter((token) =>
      metadata.includes(token),
    );
    return alignedTokens.length >= Math.min(2, queryTokens.size);
  };

  // A specific title is stronger than a broad category label. This prevents a
  // lone miscategorized record from entering a collection solely because its
  // category says one thing while its title clearly names another record type.
  const titleMetadata = normalizeMeetingMetadataForMatching(
    [candidate.title, candidate.meeting_type, candidate.titleFamily]
      .filter(Boolean)
      .join(" | "),
  );
  if (aligns(titleMetadata)) return true;

  // Repeated title families may inherit sparse taxonomy from their siblings.
  // This is how identically templated records remain consistent even when only
  // a few rows have a category populated.
  if ((candidate.siblingCount ?? 1) >= 2) {
    const familyMetadata = normalizeMeetingMetadataForMatching(
      [candidate.titleFamily, ...(candidate.siblingCategories ?? [])]
        .filter(Boolean)
        .join(" | "),
    );
    if (aligns(familyMetadata)) return true;
  }

  return false;
}

export function deterministicCompiledTitleMatches(
  candidates: MeetingMetadataCandidate[],
  request: MeetingCollectionRequest,
): string[] {
  const phrases = request.searchTerms
    .map(normalizeMeetingMetadataForMatching)
    .filter((phrase) => phrase.split(/\s+/).length >= 2);
  if (phrases.length === 0) return [];
  return candidates
    .filter((candidate) => {
      const title = normalizeMeetingMetadataForMatching(candidate.title ?? "");
      return phrases.some((phrase) => title.includes(phrase));
    })
    .map((candidate) => candidate.id);
}

export function deterministicCompiledFamilyMatches(
  candidates: MeetingMetadataCandidate[],
  request: MeetingCollectionRequest,
): string[] {
  const phrases = request.searchTerms
    .map(normalizeMeetingMetadataForMatching)
    .filter((phrase) => phrase.split(/\s+/).length >= 2);
  if (phrases.length === 0) return [];
  return candidates
    .filter((candidate) => {
      if ((candidate.siblingCount ?? 1) < 2) return false;
      const familyMetadata = normalizeMeetingMetadataForMatching(
        [candidate.titleFamily, ...(candidate.siblingCategories ?? [])]
          .filter(Boolean)
          .join(" | "),
      );
      return phrases.some((phrase) => familyMetadata.includes(phrase));
    })
    .map((candidate) => candidate.id);
}

function dateInRange(
  value: string | null,
  from: string | null | undefined,
  to: string | null | undefined,
): boolean {
  if (!from && !to) return true;
  if (!value) return false;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return false;
  if (from) {
    const lower = Date.parse(from);
    if (Number.isFinite(lower) && timestamp < lower) return false;
  }
  if (to) {
    const upper = Date.parse(to);
    if (Number.isFinite(upper) && timestamp > upper) return false;
  }
  return true;
}

export function matchesMeetingCollectionCandidate(
  candidate: MeetingMetadataCandidate,
  request: MeetingCollectionRequest,
): boolean {
  if (request.entityId && candidate.id !== request.entityId) return false;
  if (!dateInRange(candidate.date, request.dateFrom, request.dateTo)) return false;

  const title = normalize(candidate.title);
  const category = normalize(candidate.category);
  const participants = normalize(
    [candidate.participants, ...(candidate.participants_array ?? [])]
      .filter(Boolean)
      .join(" "),
  );

  if (request.titleContains && !title.includes(normalize(request.titleContains))) {
    return false;
  }
  if (request.category && !category.includes(normalize(request.category))) {
    return false;
  }
  if (request.participant && !participants.includes(normalize(request.participant))) {
    return false;
  }

  const terms = expandMeetingCandidateSearchTerms(request.searchTerms);
  const haystack = normalizeMeetingMetadataForMatching(
    candidateSearchText(candidate),
  );
  // Inclusion phrases are expanded for recall. Exclusion phrases stay intact:
  // expanding "design review" into the generic token "review" would erase the
  // very collection the planner is trying to disambiguate.
  const excluded = request.excludeTerms
    .map(normalizeMeetingMetadataForMatching)
    .filter(Boolean);
  if (excluded.some((term) => haystack.includes(term))) return false;
  if (terms.length === 0) return true;
  return terms.some((term) => haystack.includes(term));
}

export function filterMeetingCollectionCandidates(
  rows: MeetingMetadataCandidate[],
  request: MeetingCollectionRequest,
): MeetingMetadataCandidate[] {
  // The terms are compiled by the semantic planner, expanded generically, and
  // used only for high-recall metadata discovery. Final inclusion belongs to
  // the semantic selector, so there is no subject-specific phrase branch here.
  return rows.filter((candidate) =>
    matchesMeetingCollectionCandidate(candidate, request),
  );
}

async function mapWithConcurrency<T, TResult>(
  values: T[],
  concurrency: number,
  mapper: (value: T, index: number) => Promise<TResult>,
): Promise<TResult[]> {
  const results = new Array<TResult>(values.length);
  let cursor = 0;
  const workers = Array.from(
    { length: Math.min(concurrency, values.length) },
    async () => {
      while (cursor < values.length) {
        const index = cursor++;
        const value = values[index];
        if (value === undefined) continue;
        results[index] = await mapper(value, index);
      }
    },
  );
  await Promise.all(workers);
  return results;
}

function failure(
  code: MeetingCollectionFailure["code"],
  message: string,
  row?: { id?: string | null; title?: string | null },
): MeetingCollectionFailure {
  return {
    id: row?.id ?? null,
    title: row?.title ?? null,
    code,
    message,
  };
}

async function enumerateMeetingMetadata(input: {
  supabase: SupabaseClient<Database>;
  guardrails: ToolGuardrails;
  request: MeetingCollectionRequest;
  selectedProjectId?: number;
}): Promise<{
  rows: MeetingMetadataCandidate[];
  truncated: boolean;
  error: string | null;
}> {
  const scope = await input.guardrails.getScope();
  const requestedProjectId = input.selectedProjectId;
  if (
    typeof requestedProjectId === "number" &&
    !scope.isAdmin &&
    !scope.allowedProjectIds.includes(requestedProjectId)
  ) {
    return {
      rows: [],
      truncated: false,
      error: `Meeting collection access denied for project ${requestedProjectId}.`,
    };
  }

  const rows: MeetingMetadataCandidate[] = [];
  for (let offset = 0; offset < MAX_ENUMERATED_MEETINGS; offset += ENUMERATION_PAGE_SIZE) {
    // Service-role client bypasses RLS: enforce the leadership restriction
    // (Annual Review meetings) at the tool layer.
    let query = withoutLeadershipRestricted(
      input.supabase
        .from("document_metadata")
        .select(
          "id,title,date,category,meeting_type,project,project_id,participants,participants_array,summary,overview",
        )
        .eq("type", "meeting")
        .is("deleted_at", null),
      scope.isLeadership,
    )
      .order("date", { ascending: false, nullsFirst: false })
      .range(offset, offset + ENUMERATION_PAGE_SIZE - 1);

    if (typeof requestedProjectId === "number") {
      query = query.eq("project_id", requestedProjectId);
    } else if (!scope.isAdmin) {
      if (scope.allowedProjectIds.length === 0) {
        return { rows: [], truncated: false, error: null };
      }
      query = query.in("project_id", scope.allowedProjectIds);
    }

    const { data, error } = await query;
    if (error) {
      return { rows, truncated: false, error: error.message };
    }

    const page = (data ?? []) as MeetingMetadataCandidate[];
    rows.push(...page);
    if (page.length < ENUMERATION_PAGE_SIZE) {
      return { rows, truncated: false, error: null };
    }
  }

  return { rows, truncated: true, error: null };
}

async function fetchMeetingDetails(input: {
  supabase: SupabaseClient<Database>;
  ids: string[];
  isLeadership: boolean;
}): Promise<{ rows: MeetingDetailRow[]; error: string | null }> {
  const rows: MeetingDetailRow[] = [];
  for (let offset = 0; offset < input.ids.length; offset += DETAIL_BATCH_SIZE) {
    const ids = input.ids.slice(offset, offset + DETAIL_BATCH_SIZE);
    const { data, error } = await withoutLeadershipRestricted(
      input.supabase
        .from("document_metadata")
        .select(
          "id,title,date,category,meeting_type,project,project_id,participants,participants_array,summary,overview,url,source,source_web_url,content",
        )
        .in("id", ids)
        .eq("type", "meeting")
        .is("deleted_at", null),
      input.isLeadership,
    );
    if (error) return { rows, error: error.message };
    rows.push(...((data ?? []) as MeetingDetailRow[]));
  }
  return { rows, error: null };
}

export async function executeMeetingCollection(input: {
  supabase: SupabaseClient<Database>;
  guardrails: ToolGuardrails;
  request: MeetingCollectionRequest;
  selectedProjectId?: number;
  selectCandidates?: MeetingCandidateSelector;
}): Promise<MeetingCollectionResult> {
  const failures: MeetingCollectionFailure[] = [];
  const enumeration = await enumerateMeetingMetadata(input);
  if (enumeration.error) {
    failures.push(failure("enumeration_failed", enumeration.error));
  }
  if (enumeration.truncated) {
    failures.push(
      failure(
        "enumeration_limit_exceeded",
        `Meeting enumeration exceeded ${MAX_ENUMERATED_MEETINGS} records; exhaustive coverage cannot be proven.`,
      ),
    );
  }

  // Enumerate the full authorized corpus first, then run the compiled metadata
  // query and semantic selector. Nothing here knows subject-specific phrases.
  const candidates = enrichMeetingCandidateFamilies(
    filterMeetingCollectionCandidates(enumeration.rows, input.request),
  );

  let selectedIds: string[] = [];
  if (failures.length === 0 && candidates.length > 0) {
    if (input.request.scope === "single_entity") {
      selectedIds = candidates.map((candidate) => candidate.id);
    } else {
      const selector = input.selectCandidates ?? selectMeetingCollectionCandidates;
      try {
        const batches = Array.from(
          { length: Math.ceil(candidates.length / SELECTOR_BATCH_SIZE) },
          (_, index) =>
            candidates.slice(
              index * SELECTOR_BATCH_SIZE,
              (index + 1) * SELECTOR_BATCH_SIZE,
            ),
        );
        const selectedBatches = await mapWithConcurrency(
          batches,
          SELECTOR_CONCURRENCY,
          (batch) => selector({ request: input.request, candidates: batch }),
        );
        selectedIds.push(...selectedBatches.flat());
        const titleMatches = deterministicCompiledTitleMatches(
          candidates,
          input.request,
        );
        const familyMatches = deterministicCompiledFamilyMatches(
          candidates,
          input.request,
        );
        const approved = new Set(
          expandSelectedMeetingFamilies(candidates, [
            ...new Set([...selectedIds, ...titleMatches, ...familyMatches]),
          ]),
        );
        selectedIds = candidates
          .filter(
            (candidate) =>
              approved.has(candidate.id) &&
              hasCompiledQueryAlignment(candidate, input.request),
          )
          .map((candidate) => candidate.id);
      } catch (error) {
        failures.push(
          failure(
            "enumeration_failed",
            `Semantic collection selection failed: ${error instanceof Error ? error.message : String(error)}`,
          ),
        );
      }
    }
  }

  if (selectedIds.length > MAX_MATCHED_MEETINGS) {
    failures.push(
      failure(
        "record_limit_exceeded",
        `The collection matched ${selectedIds.length} meetings, above the safe analysis limit of ${MAX_MATCHED_MEETINGS}. Narrow the structured date, project, title, category, or participant filter.`,
      ),
    );
    selectedIds = [];
  }

  if (
    input.request.entityId &&
    candidates.length === 0 &&
    failures.length === 0
  ) {
    failures.push(
      failure(
        "meeting_not_found",
        `Meeting ${input.request.entityId} was not found in the authorized meeting corpus.`,
        { id: input.request.entityId },
      ),
    );
  }

  const details =
    selectedIds.length > 0
      ? await fetchMeetingDetails({
          supabase: input.supabase,
          ids: selectedIds,
          isLeadership: (await input.guardrails.getScope()).isLeadership,
        })
      : { rows: [] as MeetingDetailRow[], error: null };
  if (details.error) {
    failures.push(
      failure(
        "enumeration_failed",
        `Fetching selected meeting records failed: ${details.error}`,
      ),
    );
  }

  const detailById = new Map(details.rows.map((row) => [row.id, row]));
  for (const selectedId of selectedIds) {
    if (!detailById.has(selectedId)) {
      const candidate = candidates.find((row) => row.id === selectedId);
      failures.push(
        failure(
          "meeting_access_denied",
          `Meeting ${selectedId} disappeared between authorized enumeration and transcript retrieval.`,
          candidate,
        ),
      );
    }
  }

  const loaded = await mapWithConcurrency(
    details.rows,
    TRANSCRIPT_FETCH_CONCURRENCY,
    async (row): Promise<
      | { item: MeetingCollectionItem; failure: null }
      | { item: null; failure: MeetingCollectionFailure }
    > => {
      const transcript = await loadMeetingTranscriptContent({
        id: row.id,
        url: row.url,
        source: row.source,
        sourceWebUrl: row.source_web_url,
        content: row.content,
      });
      if (!transcript.content) {
        return {
          item: null,
          failure: failure(
            "transcript_fetch_failed",
            transcript.error ?? `Transcript retrieval failed for meeting ${row.id}.`,
            row,
          ),
        };
      }
      if (!transcript.completeTranscript) {
        return {
          item: null,
          failure: failure(
            "transcript_missing",
            `Meeting ${row.id} returned summary metadata but no complete transcript section; collection analysis was stopped.`,
            row,
          ),
        };
      }

      const title = row.title?.trim() || "Untitled meeting";
      return {
        failure: null,
        item: {
          id: row.id,
          title,
          date: row.date,
          category: row.category,
          projectId: row.project_id,
          project: row.project,
          participants: row.participants,
          sourceRef: `[Source: Meeting - "${title}" - ${row.date ?? "date unavailable"}]`,
          sourceUrl: `/meetings/${row.id}`,
          transcript: transcript.content,
          transcriptCharacters: transcript.content.length,
        },
      };
    },
  );

  const items = loaded.flatMap((result) => (result.item ? [result.item] : []));
  failures.push(
    ...loaded.flatMap((result) => (result.failure ? [result.failure] : [])),
  );

  const status: MeetingCollectionResult["status"] =
    selectedIds.length === 0 && failures.length === 0
      ? "no_matches"
      : failures.length === 0 && items.length === selectedIds.length
        ? "complete"
        : "incomplete";

  return {
    request: input.request,
    status,
    coverage: {
      enumerated: enumeration.rows.length,
      candidateMatches: candidates.length,
      matched: selectedIds.length,
      retrieved: items.length,
      failed: failures.length,
      transcriptCharacters: items.reduce(
        (total, item) => total + item.transcriptCharacters,
        0,
      ),
      exhaustive:
        status === "complete" &&
        !enumeration.truncated,
    },
    items,
    failures,
  };
}
