import { apiFetch } from "@/lib/api-client";
import type { ColumnConfig, FilterValue } from "@/components/tables/unified";
import type { ServerTableDefinition } from "@/features/tables/server-table";

export const ALLEATO_COMPANY = "Alleato Group";

export interface EmployeeRow {
  id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string;
  job_title: string;
  business_unit: string;
  phone: string;
  status: string;
  person_type: string;
  created_at: string | null;
}

export type EmployeeFilterState = {
  status: FilterValue;
  business_unit: FilterValue;
};

export const EMPTY_EMPLOYEE_FILTERS: EmployeeFilterState = {
  status: undefined,
  business_unit: undefined,
};

export const employeeColumns: ColumnConfig[] = [
  { id: "full_name", label: "Name", alwaysVisible: true },
  { id: "job_title", label: "Job Title", defaultVisible: true },
  { id: "business_unit", label: "Business Unit", defaultVisible: true },
  { id: "email", label: "Email", defaultVisible: true },
  { id: "phone", label: "Phone", defaultVisible: true },
  { id: "status", label: "Status", defaultVisible: true },
  { id: "person_type", label: "Type", defaultVisible: false },
  { id: "created_at", label: "Added", defaultVisible: false },
];

export const employeeDefaultVisibleColumns = employeeColumns
  .filter((column) => column.defaultVisible !== false)
  .map((column) => column.id);

const ALLOWED_SERVER_SORT_FIELDS = new Set([
  "full_name",
  "job_title",
  "business_unit",
  "email",
  "phone",
  "status",
  "person_type",
  "created_at",
]);

interface EmployeesTableResponse {
  data: EmployeeRow[];
  pagination: {
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
  };
}

export const employeesTableDefinition: ServerTableDefinition<
  EmployeeRow,
  EmployeeFilterState
> = {
  entityKey: "global-directory-employees-v2",
  allowedViews: ["table", "card", "list"],
  defaultView: "table",
  defaultPerPage: 50,
  defaultSortBy: "full_name",
  defaultSortDirection: "asc",
  searchPlaceholder: "Search employees...",
  columns: employeeColumns,
  defaultVisibleColumns: employeeDefaultVisibleColumns,
  filters: [],
  defaultFilters: EMPTY_EMPLOYEE_FILTERS,
  parseFiltersFromSearchParams(searchParams) {
    return {
      status: searchParams.get("status") ?? undefined,
      business_unit: searchParams.get("business_unit") ?? undefined,
    };
  },
  serializeFiltersToSearchParams(filters) {
    return {
      status: typeof filters.status === "string" ? filters.status : null,
      business_unit:
        typeof filters.business_unit === "string" ? filters.business_unit : null,
    };
  },
  async fetchPage(query) {
    const params = new URLSearchParams();

    if (query.search.trim()) {
      params.set("search", query.search.trim());
    }
    if (typeof query.filters.status === "string" && query.filters.status) {
      params.set("status", query.filters.status);
    }
    if (
      typeof query.filters.business_unit === "string" &&
      query.filters.business_unit
    ) {
      params.set("business_unit", query.filters.business_unit);
    }

    params.set("page", String(query.page));
    params.set("per_page", String(query.perPage));

    const sortBy = ALLOWED_SERVER_SORT_FIELDS.has(query.sortBy ?? "")
      ? query.sortBy
      : "full_name";
    params.set("sort", `${sortBy}:${query.sortDirection}`);

    const result = await apiFetch<EmployeesTableResponse>(
      `/api/directory/employees/table?${params.toString()}`,
      { cache: "no-store" },
    );

    return {
      items: result.data ?? [],
      total: result.pagination?.total ?? result.data?.length ?? 0,
      totalPages: result.pagination?.total_pages ?? 1,
    };
  },
};
