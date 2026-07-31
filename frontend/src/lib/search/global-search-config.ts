/**
 * Global (site-wide) search — entity registry.
 *
 * Single source of truth describing every entity type the site-wide search
 * (⌘K command palette) can surface. The API route (`/api/search`) reads this to
 * build one Supabase query per entity, and the client reads the labels/kinds to
 * group and render results.
 *
 * Adding a new searchable entity = add one entry here. Keep it icon-free and
 * dependency-free so it stays safe to import from a server route.
 */

export type SearchEntityKind =
  | "project"
  | "company"
  | "rfi"
  | "submittal"
  | "change_event"
  | "prime_contract"
  | "commitment"
  | "drawing"
  | "punch_item";

export interface GlobalSearchResult {
  /** Stable id of the underlying record (stringified). */
  id: string;
  kind: SearchEntityKind;
  /** Group heading the result renders under, e.g. "RFIs". */
  groupLabel: string;
  /** Primary line, e.g. the RFI subject. */
  title: string;
  /** Secondary line, e.g. "RFI 12 · Open". `null` when nothing to show. */
  subtitle: string | null;
  /** Route to navigate to when the result is chosen. */
  url: string;
}

interface EntityConfig {
  kind: SearchEntityKind;
  /** Supabase table or view to query. */
  table: string;
  /** Group heading shown in the palette. */
  groupLabel: string;
  /** True when the table has a `project_id` column and needs a project scope. */
  projectScoped: boolean;
  /** Column used as the result title. */
  titleColumn: string;
  /** Optional identifier column shown as a subtitle prefix (e.g. RFI number). */
  numberColumn: string | null;
  /** Optional status column shown in the subtitle. */
  statusColumn: string | null;
  /**
   * Text columns that are safe to `ilike`-match against the query. Numeric
   * columns (e.g. `rfis.number`) are intentionally excluded — they cannot be
   * pattern-matched — but can still appear via `numberColumn` in the subtitle.
   */
  searchColumns: string[];
  /** Soft-delete column to filter out (`.is(col, null)`), when the table has one. */
  softDeleteColumn: string | null;
  /**
   * Boolean columns whose `true` rows must be excluded — soft-delete flags
   * (`is_deleted`) and archived flags (`archived`). Applied as
   * `.not(col, "is", true)` so `false` and `null` rows both survive.
   */
  excludeWhenTrue: string[];
  /** Builds the destination route for a matched row. */
  buildUrl: (id: string, projectId: number | null) => string;
}

/**
 * Ordered so the most-navigated-to entities surface first in the palette.
 * Project-scoped entities are only queried when a project is active.
 */
export const SEARCH_ENTITY_CONFIGS: EntityConfig[] = [
  {
    kind: "project",
    table: "projects",
    groupLabel: "Projects",
    projectScoped: false,
    titleColumn: "name",
    numberColumn: "project_number",
    statusColumn: "stage",
    searchColumns: ["name", "project_number", "name_code"],
    softDeleteColumn: null,
    excludeWhenTrue: ["archived"],
    buildUrl: (id) => `/${id}`,
  },
  {
    kind: "rfi",
    table: "rfis",
    groupLabel: "RFIs",
    projectScoped: true,
    titleColumn: "subject",
    numberColumn: "number",
    statusColumn: "status",
    searchColumns: ["subject"],
    softDeleteColumn: null,
    excludeWhenTrue: [],
    buildUrl: (id, projectId) => `/${projectId}/rfis/${id}`,
  },
  {
    kind: "submittal",
    table: "submittals",
    groupLabel: "Submittals",
    projectScoped: true,
    titleColumn: "title",
    numberColumn: "submittal_number",
    statusColumn: "status",
    searchColumns: ["title", "submittal_number"],
    softDeleteColumn: "deleted_at",
    excludeWhenTrue: [],
    buildUrl: (id, projectId) => `/${projectId}/submittals/${id}`,
  },
  {
    kind: "change_event",
    table: "change_events",
    groupLabel: "Change Events",
    projectScoped: true,
    titleColumn: "title",
    numberColumn: "number",
    statusColumn: "status",
    searchColumns: ["title", "number"],
    softDeleteColumn: "deleted_at",
    excludeWhenTrue: [],
    buildUrl: (id, projectId) => `/${projectId}/change-events/${id}`,
  },
  {
    kind: "prime_contract",
    table: "prime_contracts",
    groupLabel: "Prime Contracts",
    projectScoped: true,
    titleColumn: "title",
    numberColumn: "contract_number",
    statusColumn: "status",
    searchColumns: ["title", "contract_number"],
    softDeleteColumn: null,
    excludeWhenTrue: [],
    buildUrl: (id, projectId) => `/${projectId}/prime-contracts/${id}`,
  },
  {
    kind: "commitment",
    table: "commitments_unified",
    groupLabel: "Commitments",
    projectScoped: true,
    titleColumn: "title",
    numberColumn: "contract_number",
    statusColumn: "status",
    searchColumns: ["title", "contract_number"],
    softDeleteColumn: "deleted_at",
    excludeWhenTrue: [],
    buildUrl: (id, projectId) => `/${projectId}/commitments/${id}`,
  },
  {
    kind: "drawing",
    table: "drawings",
    groupLabel: "Drawings",
    projectScoped: true,
    titleColumn: "title",
    numberColumn: "drawing_number",
    statusColumn: null,
    searchColumns: ["title", "drawing_number"],
    softDeleteColumn: "deleted_at",
    excludeWhenTrue: [],
    buildUrl: (id, projectId) => `/${projectId}/drawings/${id}`,
  },
  {
    kind: "punch_item",
    table: "punch_items",
    groupLabel: "Punch List",
    projectScoped: true,
    titleColumn: "title",
    numberColumn: "number",
    statusColumn: "status",
    searchColumns: ["title", "description"],
    softDeleteColumn: null,
    excludeWhenTrue: ["is_deleted"],
    buildUrl: (id, projectId) => `/${projectId}/punch-list/${id}`,
  },
  {
    kind: "company",
    table: "companies",
    groupLabel: "Companies",
    projectScoped: false,
    titleColumn: "name",
    numberColumn: null,
    statusColumn: "type",
    searchColumns: ["name", "legal_name"],
    softDeleteColumn: null,
    excludeWhenTrue: [],
    buildUrl: (id) => `/directory/companies/${id}`,
  },
];

/** Max rows returned per entity group. */
export const RESULTS_PER_GROUP = 5;

/**
 * Strips characters that would break a PostgREST `or(...)` filter string
 * (commas and parens are delimiters; `%`/`*`/`\` are wildcards). Collapses the
 * result and trims — callers should treat an empty string as "no query".
 */
export function sanitizeSearchTerm(raw: string): string {
  return raw.replace(/[,()%*\\]/g, " ").replace(/\s+/g, " ").trim();
}
