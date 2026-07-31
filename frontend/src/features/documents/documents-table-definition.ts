import { apiFetch } from "@/lib/api-client";
import type { FilterValue } from "@/components/tables/unified";
import type { ColumnConfig } from "@/components/tables/unified";
import type { ServerTableDefinition } from "@/features/tables/server-table";
import {
  type PipelineDoc,
  documentColumns,
  documentDefaultVisibleColumns,
  documentFilters,
} from "./documents-table-config";

export type DocumentFilterState = {
  source: FilterValue;
  type: FilterValue;
  document_type: FilterValue;
  category: FilterValue;
  pipeline_stage: FilterValue;
  date_from: FilterValue;
  date_to: FilterValue;
};

export const EMPTY_DOCUMENT_FILTERS: DocumentFilterState = {
  source: undefined,
  type: undefined,
  document_type: undefined,
  category: undefined,
  pipeline_stage: undefined,
  date_from: undefined,
  date_to: undefined,
};

const DOCUMENT_SORT_FIELDS = new Set([
  "created_at",
  "date",
  "title",
  "type",
  "document_type",
  "category",
  "source",
]);

function readFilter(
  searchParams: URLSearchParams,
  key: keyof DocumentFilterState,
) {
  return searchParams.get(key) ?? undefined;
}

type DocumentsTableDefinitionOptions = {
  entityKey?: string;
  defaultFilters?: Partial<DocumentFilterState>;
  /** Filters that ALWAYS win — applied after URL params are merged, preventing
   *  the parseFiltersFromSearchParams spread from clobbering them back to
   *  undefined.  Smart-group selection uses this to guarantee the group's
   *  document_type / type constraint reaches the API regardless of URL state. */
  forcedFilters?: Partial<DocumentFilterState>;
  /** Free-text search that ALWAYS wins (overrides the user's search input) —
   *  used by search-based smart groups (e.g. Commitments). */
  forcedSearch?: string;
  searchPlaceholder?: string;
  defaultSortBy?: string;
  defaultSortDirection?: "asc" | "desc";
  columns?: ColumnConfig[];
  defaultVisibleColumns?: string[];
  forcedProjectId?: number;
  defaultView?: "table" | "card" | "list";
};

export function createDocumentsTableDefinition(
  options: DocumentsTableDefinitionOptions = {},
): ServerTableDefinition<PipelineDoc, DocumentFilterState> {
  return {
    entityKey: options.entityKey ?? "documents",
    allowedViews: ["table", "card", "list"],
    defaultView: options.defaultView ?? "table",
    defaultPerPage: 25,
    defaultSortBy: options.defaultSortBy ?? "created_at",
    defaultSortDirection: options.defaultSortDirection ?? "desc",
    searchPlaceholder: options.searchPlaceholder ?? "Search documents...",
    columns: options.columns ?? documentColumns,
    defaultVisibleColumns:
      options.defaultVisibleColumns ?? documentDefaultVisibleColumns,
    filters: documentFilters,
    defaultFilters: {
      ...EMPTY_DOCUMENT_FILTERS,
      ...(options.defaultFilters ?? {}),
    },
    parseFiltersFromSearchParams(searchParams) {
      return {
        source: readFilter(searchParams, "source"),
        type: readFilter(searchParams, "type"),
        document_type: readFilter(searchParams, "document_type"),
        category: readFilter(searchParams, "category"),
        pipeline_stage: readFilter(searchParams, "pipeline_stage"),
        date_from: readFilter(searchParams, "date_from"),
        date_to: readFilter(searchParams, "date_to"),
      };
    },
    serializeFiltersToSearchParams(filters) {
      return {
        source: typeof filters.source === "string" ? filters.source : null,
        type: typeof filters.type === "string" ? filters.type : null,
        document_type:
          typeof filters.document_type === "string"
            ? filters.document_type
            : null,
        category: typeof filters.category === "string" ? filters.category : null,
        pipeline_stage:
          typeof filters.pipeline_stage === "string"
            ? filters.pipeline_stage
            : null,
        date_from:
          typeof filters.date_from === "string" ? filters.date_from : null,
        date_to: typeof filters.date_to === "string" ? filters.date_to : null,
      };
    },
    async fetchPage(query) {
      const params = new URLSearchParams();

      if (query.search.trim()) params.set("search", query.search.trim());
      if (typeof query.filters.source === "string" && query.filters.source) {
        params.set("source", query.filters.source);
      }
      if (typeof query.filters.type === "string" && query.filters.type) {
        params.set("type", query.filters.type);
      }
      if (
        typeof query.filters.document_type === "string" &&
        query.filters.document_type
      ) {
        params.set("document_type", query.filters.document_type);
      }
      if (typeof query.filters.category === "string" && query.filters.category) {
        params.set("category", query.filters.category);
      }
      if (typeof options.forcedProjectId === "number") {
        params.set("project_id", String(options.forcedProjectId));
      }
      if (
        typeof query.filters.pipeline_stage === "string" &&
        query.filters.pipeline_stage
      ) {
        params.set("pipeline_stage", query.filters.pipeline_stage);
      }
      if (
        typeof query.filters.date_from === "string" &&
        query.filters.date_from
      ) {
        params.set("date_from", query.filters.date_from);
      }
      if (typeof query.filters.date_to === "string" && query.filters.date_to) {
        params.set("date_to", query.filters.date_to);
      }

      // Apply forced filters AFTER the URL-param-derived filters so that the
      // parseFiltersFromSearchParams spread (which sets every key, returning
      // undefined for absent URL params) cannot clobber them back to undefined.
      if (options.forcedFilters) {
        for (const [k, v] of Object.entries(options.forcedFilters)) {
          if (typeof v === "string" && v) {
            params.set(k, v);
          }
        }
      }
      if (options.forcedSearch && options.forcedSearch.trim()) {
        params.set("search", options.forcedSearch.trim());
      }

      params.set("page", String(query.page));
      params.set("per_page", String(query.perPage));

      const sortBy = DOCUMENT_SORT_FIELDS.has(query.sortBy ?? "")
        ? query.sortBy
        : options.defaultSortBy ?? "created_at";
      if (sortBy) {
        params.set("sort", sortBy);
        params.set("sort_dir", query.sortDirection);
      }

      const result = await apiFetch<{
        documents?: PipelineDoc[];
        total?: number;
        total_pages?: number;
      }>(`/api/documents/status?${params.toString()}`, { cache: "no-store" });

      return {
        items: result.documents ?? [],
        total: result.total ?? result.documents?.length ?? 0,
        totalPages: result.total_pages ?? 1,
      };
    },
  };
}

export const documentsTableDefinition = createDocumentsTableDefinition();
