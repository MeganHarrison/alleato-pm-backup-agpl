import type { DailyBriefSourceRef } from "./canonical-packets";

// Prefixes the compiler bakes into source titles ("Email: …", "Teams DM
// Conversation: …"). We strip them so a cited source reads as its subject line,
// not its plumbing.
const TITLE_PREFIXES = [
  /^Email:\s*/i,
  /^Teams DM Conversation:\s*/i,
  /^Teams:\s*/i,
  /^Meeting:\s*/i,
  /^Document:\s*/i,
];

// A citation token the model shortened, e.g. `01KWYW…` (trailing) or
// `outlook_AAMkADI0…AALgMchlAAA=` (interior). Split into prefix + suffix.
const ELLIPSIS_SPLIT = /…|\.{3,}/;

// Friendly label when a source has no human subject line (e.g. a Teams DM whose
// title is just the raw conversation id).
const LANE_LABEL: Record<string, string> = {
  meetings: "Meeting",
  emails: "Email",
  teams: "Teams message",
  documents: "Document",
};

/** A title that is really an opaque id (Teams conversation id, long token). */
function looksLikeOpaqueId(value: string): boolean {
  return /^19:/.test(value) || (!/\s/.test(value) && value.length > 24);
}

/** Human-readable label for a cited source — its subject, prefix stripped. */
export function cleanSourceTitle(ref: DailyBriefSourceRef): string {
  let title = ref.title.trim();
  for (const prefix of TITLE_PREFIXES) title = title.replace(prefix, "");
  title = title.trim();
  if (!title || looksLikeOpaqueId(title)) {
    return LANE_LABEL[ref.lane] ?? title ?? ref.id;
  }
  return title;
}

export interface DailyBriefSourceIndex {
  /**
   * Resolve a citation token from the brief markdown to its source. A token is
   * either a short alias the model was told to cite (`S12`, the current scheme)
   * or, for pre-alias packets, a full source id — both resolve by exact match.
   * Full ids the model truncated with a trailing/interior ellipsis fall back to
   * a UNIQUE prefix match; an ambiguous prefix resolves to null so we never
   * link to the wrong record. (Aliases are short and never truncated, which is
   * the whole point of the scheme.)
   */
  resolve(token: string): DailyBriefSourceRef | null;
  size: number;
}

/**
 * Mark known bracketed source aliases as inline code so BriefMarkdown's code
 * renderer can replace them with readable source titles and links. Generated
 * reports historically emitted both `[S12]` and `` `[S12]` ``; normalizing at
 * the renderer boundary keeps both packet generations readable without
 * rewriting the persisted artifact.
 *
 * Existing inline code and Markdown reference-definition lines are preserved.
 */
export function markKnownSourceCitations(
  markdown: string,
  index: DailyBriefSourceIndex,
): string {
  return markdown
    .split("\n")
    .map((line) => {
      if (/^\s*\[[^\]]+\]:\s+\S+/.test(line)) return line;

      return line
        .split(/(`+[^`]*`+)/g)
        .map((segment, segmentIndex) => {
          if (segmentIndex % 2 === 1) return segment;
          return segment.replace(/\[([^\]\n]+)\]/g, (match, token: string) =>
            index.resolve(token) ? `\`${token}\`` : match,
          );
        })
        .join("");
    })
    .join("\n");
}

export function buildSourceIndex(
  sources: DailyBriefSourceRef[],
): DailyBriefSourceIndex {
  // Exact-match lookup keyed by BOTH the alias and the full id, so `S12` and
  // the raw Outlook id both resolve to the same source. Prefix matching runs
  // over full ids only (aliases are short and exact).
  const byKey = new Map<string, DailyBriefSourceRef>();
  const ids: string[] = [];
  for (const source of sources) {
    if (!byKey.has(source.id)) {
      byKey.set(source.id, source);
      ids.push(source.id);
    }
    if (source.alias && !byKey.has(source.alias)) {
      byKey.set(source.alias, source);
    }
  }
  const cache = new Map<string, DailyBriefSourceRef | null>();

  function resolve(rawToken: string): DailyBriefSourceRef | null {
    const token = rawToken.trim();
    if (!token) return null;
    if (cache.has(token)) return cache.get(token) ?? null;

    let result = byKey.get(token) ?? null;
    // Pre-alias citations the model shortened won't match exactly. Split on the
    // ellipsis into a prefix and (optional) suffix, then accept ONLY a unique
    // match so we never link an ambiguous prefix to the wrong record.
    if (!result && ELLIPSIS_SPLIT.test(token)) {
      const [prefix, suffix = ""] = token
        .split(ELLIPSIS_SPLIT)
        .map((part) => part.trim());
      if (prefix.length >= 6) {
        const matches = ids.filter(
          (id) =>
            id.startsWith(prefix) && (suffix === "" || id.endsWith(suffix)),
        );
        result = matches.length === 1 ? (byKey.get(matches[0]) ?? null) : null;
      }
    }
    cache.set(token, result);
    return result;
  }

  return { resolve, size: ids.length };
}

/**
 * Collect the citation tokens a `source_signal_candidates` row points at — the
 * ids in `extraction_json.source_ids` plus `source_document_id`. These are the
 * same tokens the brief markdown cites, so they resolve against the packet
 * `sourceSet` manifest. Order is preserved with `source_document_id` last, so
 * the first-cited source stays primary.
 */
export function candidateSourceTokens(row: {
  source_document_id: string | null;
  extraction_json: unknown;
}): string[] {
  const tokens: string[] = [];
  const extraction = row.extraction_json;
  if (extraction && typeof extraction === "object" && !Array.isArray(extraction)) {
    const rawIds = (extraction as Record<string, unknown>).source_ids;
    if (Array.isArray(rawIds)) {
      for (const value of rawIds) {
        if (typeof value === "string" && value.trim()) tokens.push(value);
      }
    }
  }
  if (row.source_document_id) tokens.push(row.source_document_id);
  return tokens;
}

/**
 * Resolve a candidate's citation tokens to their manifest sources, de-duped by
 * source id. A token resolves only on an exact or UNIQUE-prefix match (see
 * `buildSourceIndex`); ambiguous truncated ids (long Outlook ids the brief
 * shortened) resolve to nothing rather than mislinking, so every returned
 * source is guaranteed to be the right record.
 */
export function resolveCandidateSources(
  row: { source_document_id: string | null; extraction_json: unknown },
  index: DailyBriefSourceIndex,
): DailyBriefSourceRef[] {
  const resolved: DailyBriefSourceRef[] = [];
  const seen = new Set<string>();
  for (const token of candidateSourceTokens(row)) {
    const ref = index.resolve(token);
    if (!ref || seen.has(ref.id)) continue;
    seen.add(ref.id);
    resolved.push(ref);
  }
  return resolved;
}
