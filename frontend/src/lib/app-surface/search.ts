// Find-a-page search over the generated app-surface index.
//
// The index (app-surface.generated.json) is produced by `npm run map:project`
// from every production page's PageShell title/description and every AI tool's
// description. Routes explicitly classified as non-production are omitted.
// This is deliberately NOT a vector/RAG search: the corpus is ~400 short,
// structured records, so a deterministic keyword + substring scorer over good
// descriptions is faster, cheaper, and debuggable. Quality depends on pages
// having descriptions — pages without one cannot be found here by design.

import surface from "./app-surface.generated.json";

export type AppSurfaceKind = "page" | "tool";

export interface AppSurfaceResult {
  kind: AppSurfaceKind;
  /** Route URL for pages, tool name for tools. */
  ref: string;
  title: string | null;
  description: string | null;
  score: number;
}

interface IndexedEntry {
  kind: AppSurfaceKind;
  ref: string;
  title: string | null;
  description: string | null;
  /** Pre-lowercased searchable text, weighted fields kept separate. */
  titleText: string;
  bodyText: string;
  refText: string;
  /** Full leaf segment, hyphens intact, word-stemmed (e.g. "prime-contract"). */
  leaf: string;
  /** Stemmed leaf words (e.g. {"prime","contract"}) — the strongest locator signal. */
  leafWords: Set<string>;
  /** All stemmed non-param segment words — a weaker "appears in the path" signal. */
  segmentWords: Set<string>;
  /** True when the route's terminal segment is the noun itself (list page), not a [param] (detail page). */
  terminalIsStatic: boolean;
  /** Path depth — used as a tiebreak so canonical (shallower) routes rank first. */
  depth: number;
}

const STOP_WORDS = new Set([
  "a", "an", "the", "to", "of", "for", "in", "on", "is", "do", "i",
  "how", "where", "what", "page", "screen", "view", "can", "me", "my",
  "show", "find", "go", "get", "see", "with", "and", "or",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t));
}

// Naive singular stem so "meeting"~"meetings", "commitment"~"commitments".
function stem(word: string): string {
  return word.length > 3 && word.endsWith("s") ? word.slice(0, -1) : word;
}

// Generic CRUD/action verbs that appear as route segments (e.g. /…/new, /testing/runs)
// but are never a page's subject noun. They must NOT grant a route-tier match —
// otherwise "run workflows" hijacks to /testing/runs. They still count for text.
const ROUTE_GENERIC = new Set([
  "run", "new", "edit", "add", "create", "view", "list", "detail", "index", "setup",
]);

function buildIndex(): IndexedEntry[] {
  const entries: IndexedEntry[] = [];
  for (const p of surface.pages) {
    const rawSegments = p.url.split("/").filter(Boolean);
    const staticSegments = rawSegments.filter((s) => !s.startsWith("["));
    const leafRaw =
      [...staticSegments].pop()?.replace(/[().]/g, "").toLowerCase() ?? "";
    const leaf = leafRaw.split("-").filter(Boolean).map(stem).join("-");
    const segmentWords = new Set(
      staticSegments.flatMap((s) =>
        s
          .replace(/[().]/g, "")
          .toLowerCase()
          .split("-")
          .filter(Boolean)
          .map(stem),
      ),
    );
    entries.push({
      kind: "page",
      ref: p.url,
      title: p.title,
      description: p.description,
      titleText: (p.title ?? "").toLowerCase(),
      bodyText: (p.description ?? "").toLowerCase(),
      refText: p.url.toLowerCase().replace(/[/[\]-]+/g, " "),
      leaf,
      leafWords: new Set(leaf.split("-").filter(Boolean)),
      segmentWords,
      terminalIsStatic:
        rawSegments.length === 0 ||
        !rawSegments[rawSegments.length - 1].startsWith("["),
      depth: rawSegments.length,
    });
  }
  for (const t of surface.tools) {
    entries.push({
      kind: "tool",
      ref: t.name,
      title: t.name,
      description: t.description,
      // Tool names are camelCase — split into words so "create order" matches createOrder.
      titleText: t.name
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .toLowerCase(),
      bodyText: (t.description ?? "").toLowerCase(),
      refText: t.name.toLowerCase(),
      leaf: "",
      leafWords: new Set(),
      segmentWords: new Set(),
      terminalIsStatic: false,
      depth: 0,
    });
  }
  return entries;
}

const INDEX = buildIndex();

// Two-tier score: a coarse "route tier" dominates, then a finer text/canonical
// score breaks ties. This guarantees the page whose ROUTE is the noun outranks a
// peripheral page that merely mentions the noun in its description, while still
// letting description-only matches surface when no route matches.
function scoreEntry(entry: IndexedEntry, tokens: string[], rawQuery: string): number {
  const tokenStems = tokens.map(stem);
  const queryAsLeaf = tokenStems.join("-");

  // Route tier (the locator signal):
  //   4 = the WHOLE query is this page's noun (exact leaf, e.g. "punch list" → punch-list)
  //   3 = a single query word equals this page's whole noun (e.g. "wip" → /accounting/wip)
  //   2 = a query word is part of this page's (multi-word) noun
  //   1 = a query word appears elsewhere in the path
  //   0 = no path match
  // Generic verbs match text but never grant a route tier.
  const routeTokens = tokenStems.filter((t) => !ROUTE_GENERIC.has(t));
  let tier = 0;
  if (entry.leaf && queryAsLeaf === entry.leaf) tier = 4;
  else if (entry.leaf && routeTokens.some((t) => t === entry.leaf)) tier = 3;
  else if (routeTokens.some((t) => entry.leafWords.has(t))) tier = 2;
  else if (routeTokens.some((t) => entry.segmentWords.has(t))) tier = 1;

  // Text/refinement score (small — only orders pages within the same tier).
  let text = 0;
  if (rawQuery.length > 2) {
    if (entry.titleText.includes(rawQuery)) text += 6;
    if (entry.bodyText.includes(rawQuery)) text += 2;
  }
  for (const token of tokens) {
    const wordRe = new RegExp(`\\b${token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`);
    if (wordRe.test(entry.titleText)) text += 4;
    else if (entry.titleText.includes(token)) text += 2;
    if (wordRe.test(entry.bodyText)) text += 2;
    else if (entry.bodyText.includes(token)) text += 1;
    if (entry.refText.includes(token)) text += 1;
  }

  // A list page (terminal segment IS the noun) is more canonical than a
  // detail/[param] page sharing the same leaf — large enough that a detail
  // page's richer description can't outrank its own list page within a tier.
  const canonical = tier >= 2 && entry.terminalIsStatic ? 25 : 0;

  if (tier === 0 && text === 0) return 0;
  // Tier dominates; canonical + text refine within a tier.
  return tier * 100 + canonical + text;
}

export interface SearchOptions {
  limit?: number;
  /** Restrict to pages or tools. Defaults to both. */
  kinds?: AppSurfaceKind[];
}

export function searchAppSurface(
  query: string,
  options: SearchOptions = {},
): AppSurfaceResult[] {
  const limit = options.limit ?? 8;
  const kinds = options.kinds ?? ["page", "tool"];
  const rawQuery = query.trim().toLowerCase();
  const tokens = tokenize(query);
  if (tokens.length === 0 && rawQuery.length < 3) return [];

  return INDEX.filter((e) => kinds.includes(e.kind))
    .map((e) => ({
      kind: e.kind,
      ref: e.ref,
      title: e.title,
      description: e.description,
      score: scoreEntry(e, tokens, rawQuery),
      depth: e.depth,
    }))
    .filter((r) => r.score > 0)
    // Score desc; then canonical (shallower) routes; then alpha for stability.
    .sort(
      (a, b) =>
        b.score - a.score || a.depth - b.depth || a.ref.localeCompare(b.ref),
    )
    .slice(0, limit)
    .map(({ depth: _depth, ...r }) => r);
}

/** Total counts — useful for the tool to report coverage honestly. */
export function appSurfaceStats() {
  const pages = surface.pages.length;
  const describedPages = surface.pages.filter((p) => p.description).length;
  return { pages, describedPages, tools: surface.tools.length };
}
