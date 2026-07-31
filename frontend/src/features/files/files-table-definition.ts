import { apiFetch } from "@/lib/api-client";
import type { FilterValue } from "@/components/tables/unified";
import type { ServerTableDefinition } from "@/features/tables/server-table";

export type FileItem = {
  id: string;
  title: string | null;
  file_name: string | null;
  file_path: string | null;
  source_path: string | null;
  source_web_url: string | null;
  url: string | null;
  source_system: string | null;
  source: string | null;
  category: string | null;
  type: string | null;
  document_type: string | null;
  project_id: number | null;
  project: string | null;
  date: string | null;
  created_at: string | null;
  source_last_modified_at: string | null;
  source_size: number | null;
  status: string | null;
  tags: string | null;
  division: string | null;
  overview: string | null;
  participants: string | null;
  access_level: string | null;
};

export type Project = {
  id: number;
  name: string;
};

export type FileFilterState = {
  group: FilterValue;
  file_type: FilterValue;
  project_id: FilterValue;
  source: FilterValue;
  assigned: FilterValue;
  indexed: FilterValue;
  modified_after: FilterValue;
  modified_before: FilterValue;
};

export const EMPTY_FILE_FILTERS: FileFilterState = {
  group: undefined,
  file_type: undefined,
  project_id: undefined,
  source: undefined,
  assigned: undefined,
  indexed: undefined,
  modified_after: undefined,
  modified_before: undefined,
};

export const ACTIVE_FILE_GROUPS = [
  "pdf",
  "word",
  "spreadsheet",
  "presentation",
  "image",
  "text",
  "other",
] as const;

export type FileGroup = (typeof ACTIVE_FILE_GROUPS)[number];

export const FILE_GROUP_META: Record<FileGroup, { label: string }> = {
  pdf: { label: "PDF" },
  word: { label: "Word" },
  spreadsheet: { label: "Spreadsheets" },
  presentation: { label: "Slides" },
  image: { label: "Images" },
  text: { label: "Text" },
  other: { label: "Other" },
};

const FILE_SORT_FIELDS = new Set([
  "modified",
  "name",
  "project",
  "document_type",
  "category",
  "date",
  "status",
  "access_level",
  "size",
  "division",
]);

const fileColumns = [
  { id: "name", label: "Name", alwaysVisible: true },
  { id: "project", label: "Project", defaultVisible: true },
  { id: "document_type", label: "Type", defaultVisible: true },
  { id: "category", label: "Category", defaultVisible: true },
  { id: "date", label: "Date", defaultVisible: true },
  { id: "overview", label: "Overview", defaultVisible: true },
  { id: "status", label: "Status", defaultVisible: true },
  { id: "access_level", label: "Access", defaultVisible: true },
  { id: "source", label: "Source", defaultVisible: true },
  { id: "modified", label: "Last Modified", defaultVisible: false },
  { id: "size", label: "Size", defaultVisible: false },
  { id: "participants", label: "Participants", defaultVisible: false },
  { id: "folder", label: "Folder", defaultVisible: false },
  { id: "full_path", label: "Full Path", defaultVisible: false },
  { id: "division", label: "Division", defaultVisible: false },
  { id: "tags", label: "Tags", defaultVisible: false },
];

export const fileColumnsConfig = fileColumns;

export const defaultVisibleFileColumns = fileColumns
  .filter((column) => column.alwaysVisible || column.defaultVisible)
  .map((column) => column.id);

function readCsvFilter(searchParams: URLSearchParams, key: keyof FileFilterState) {
  const raw = searchParams.get(key);
  if (!raw) return undefined;
  return raw.includes(",") ? raw.split(",").filter(Boolean) : raw;
}

export const filesTableDefinition: ServerTableDefinition<
  FileItem,
  FileFilterState
> = {
  entityKey: "files",
  allowedViews: ["table"],
  defaultView: "table",
  defaultPerPage: 50,
  defaultSortBy: "modified",
  defaultSortDirection: "desc",
  searchPlaceholder: "Search by name, project, source…",
  columns: fileColumnsConfig,
  defaultVisibleColumns: defaultVisibleFileColumns,
  filters: [],
  defaultFilters: EMPTY_FILE_FILTERS,
  parseFiltersFromSearchParams(searchParams) {
    return {
      group: searchParams.get("group") ?? undefined,
      project_id: searchParams.get("project_id") ?? undefined,
      file_type: readCsvFilter(searchParams, "file_type"),
      source: searchParams.get("source") ?? undefined,
      assigned: searchParams.get("assigned") ?? undefined,
      indexed: readCsvFilter(searchParams, "indexed"),
      modified_after: searchParams.get("modified_after") ?? undefined,
      modified_before: searchParams.get("modified_before") ?? undefined,
    };
  },
  serializeFiltersToSearchParams(filters) {
    const serialize = (value: FilterValue) =>
      Array.isArray(value) ? value.join(",") : value == null ? null : String(value);

    return {
      group: typeof filters.group === "string" ? filters.group : null,
      project_id: serialize(filters.project_id),
      file_type: serialize(filters.file_type),
      source: serialize(filters.source),
      assigned: serialize(filters.assigned),
      indexed: serialize(filters.indexed),
      modified_after: serialize(filters.modified_after),
      modified_before: serialize(filters.modified_before),
    };
  },
  async fetchPage(query) {
    const params = new URLSearchParams();

    if (query.search.trim()) params.set("search", query.search.trim());
    if (typeof query.filters.group === "string" && query.filters.group) {
      params.set("group", query.filters.group);
    }
    if (typeof query.filters.project_id === "string" && query.filters.project_id) {
      params.set("project_id", query.filters.project_id);
    }
    if (typeof query.filters.source === "string" && query.filters.source) {
      params.set("source", query.filters.source);
    }
    if (typeof query.filters.assigned === "string" && query.filters.assigned) {
      params.set("assigned", query.filters.assigned);
    }
    if (
      typeof query.filters.modified_after === "string" &&
      query.filters.modified_after
    ) {
      params.set("modified_after", query.filters.modified_after);
    }
    if (
      typeof query.filters.modified_before === "string" &&
      query.filters.modified_before
    ) {
      params.set("modified_before", query.filters.modified_before);
    }
    if (Array.isArray(query.filters.file_type) && query.filters.file_type.length > 0) {
      params.set("file_type", query.filters.file_type.join(","));
    }
    if (Array.isArray(query.filters.indexed) && query.filters.indexed.length > 0) {
      params.set("indexed", query.filters.indexed.join(","));
    }

    params.set("page", String(query.page));
    params.set("per_page", String(query.perPage));

    const sortBy = FILE_SORT_FIELDS.has(query.sortBy ?? "")
      ? query.sortBy
      : "modified";
    if (sortBy) {
      params.set("sort", sortBy);
      params.set("sort_dir", query.sortDirection);
    }

    const result = await apiFetch<{
      items?: FileItem[];
      total?: number;
      total_pages?: number;
    }>(`/api/files/table?${params.toString()}`, { cache: "no-store" });

    return {
      items: result.items ?? [],
      total: result.total ?? result.items?.length ?? 0,
      totalPages: result.total_pages ?? 1,
    };
  },
};
