import { apiFetch } from "@/lib/api-client";
import type { ColumnConfig, FilterValue } from "@/components/tables/unified";
import type { ServerTableDefinition } from "@/features/tables/server-table";

export interface ContactTableRow {
  id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string;
  type: string;
  company: string;
  company_id: string | null;
  phone: string;
  is_admin: boolean;
  created_at: string | null;
}

export type ContactFilterState = {
  type: FilterValue;
  is_admin: FilterValue;
};

export const EMPTY_CONTACT_FILTERS: ContactFilterState = {
  type: undefined,
  is_admin: undefined,
};

export const contactColumns: ColumnConfig[] = [
  { id: "full_name", label: "Name", alwaysVisible: true },
  { id: "email", label: "Email", defaultVisible: true },
  { id: "type", label: "Type", defaultVisible: true },
  { id: "company", label: "Company", defaultVisible: true },
  { id: "phone", label: "Phone", defaultVisible: true },
  { id: "is_admin", label: "Admin Access", defaultVisible: true },
  { id: "created_at", label: "Created", defaultVisible: true },
];

export const contactDefaultVisibleColumns = contactColumns
  .filter((column) => column.defaultVisible !== false)
  .map((column) => column.id);

const ALLOWED_SERVER_SORT_FIELDS = new Set([
  "full_name",
  "email",
  "type",
  "company",
  "phone",
  "is_admin",
  "created_at",
]);

interface ContactsTableResponse {
  data: ContactTableRow[];
  pagination: {
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
  };
}

export const contactsTableDefinition: ServerTableDefinition<
  ContactTableRow,
  ContactFilterState
> = {
  entityKey: "global-directory-contacts-v2",
  allowedViews: ["table", "card", "list"],
  defaultView: "table",
  defaultPerPage: 50,
  defaultSortBy: "full_name",
  defaultSortDirection: "asc",
  searchPlaceholder: "Search contacts...",
  columns: contactColumns,
  defaultVisibleColumns: contactDefaultVisibleColumns,
  filters: [],
  defaultFilters: EMPTY_CONTACT_FILTERS,
  parseFiltersFromSearchParams(searchParams) {
    return {
      type: searchParams.get("type") ?? undefined,
      is_admin: searchParams.get("is_admin") ?? undefined,
    };
  },
  serializeFiltersToSearchParams(filters) {
    return {
      type: typeof filters.type === "string" ? filters.type : null,
      is_admin: typeof filters.is_admin === "string" ? filters.is_admin : null,
    };
  },
  async fetchPage(query) {
    const params = new URLSearchParams();

    if (query.search.trim()) params.set("search", query.search.trim());
    if (typeof query.filters.type === "string" && query.filters.type) {
      params.set("type", query.filters.type);
    }
    if (typeof query.filters.is_admin === "string" && query.filters.is_admin) {
      params.set("is_admin", query.filters.is_admin);
    }

    params.set("page", String(query.page));
    params.set("per_page", String(query.perPage));

    const sortBy = ALLOWED_SERVER_SORT_FIELDS.has(query.sortBy ?? "")
      ? query.sortBy
      : "full_name";
    params.set("sort", `${sortBy}:${query.sortDirection}`);

    const result = await apiFetch<ContactsTableResponse>(
      `/api/directory/contacts/table?${params.toString()}`,
      { cache: "no-store" },
    );

    return {
      items: result.data ?? [],
      total: result.pagination?.total ?? result.data?.length ?? 0,
      totalPages: result.pagination?.total_pages ?? 1,
    };
  },
};
