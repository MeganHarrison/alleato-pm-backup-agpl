import type {
  ColumnConfig,
  FilterConfig,
  FilterValue,
  ViewMode,
} from "@/components/tables/unified";

export type ServerTableFilters = Record<string, FilterValue>;

export interface ServerTableQueryState<
  TFilters extends ServerTableFilters,
> {
  search: string;
  filters: TFilters;
  page: number;
  perPage: number;
  sortBy: string | null;
  sortDirection: "asc" | "desc";
}

export interface ServerTableQueryResult<TItem> {
  items: TItem[];
  total: number;
  totalPages: number;
}

export interface ServerTableDefinition<
  TItem,
  TFilters extends ServerTableFilters,
> {
  entityKey: string;
  allowedViews: ViewMode[];
  defaultView?: ViewMode;
  defaultPerPage: number;
  defaultSortBy: string | null;
  defaultSortDirection: "asc" | "desc";
  searchPlaceholder: string;
  columns: ColumnConfig[];
  defaultVisibleColumns: string[];
  filters: FilterConfig[];
  defaultFilters: TFilters;
  parseFiltersFromSearchParams?: (searchParams: URLSearchParams) => Partial<TFilters>;
  serializeFiltersToSearchParams?: (
    filters: TFilters,
  ) => Record<string, string | null>;
  fetchPage: (
    query: ServerTableQueryState<TFilters>,
  ) => Promise<ServerTableQueryResult<TItem>>;
}
