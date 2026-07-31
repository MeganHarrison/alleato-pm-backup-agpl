import { apiFetch } from "@/lib/api-client";
import type { ColumnConfig, FilterValue } from "@/components/tables/unified";
import type { ServerTableDefinition } from "@/features/tables/server-table";

export interface CompanyRow {
  id: string;
  project_id: number;
  company_id: string;
  business_phone: string | null;
  email_address: string | null;
  primary_contact_id: string | null;
  erp_vendor_id: string | null;
  /** Acumatica AR customer id. A company is ERP-backed if it has EITHER id. */
  erp_customer_id: string | null;
  tax_id: string | null;
  legal_name: string | null;
  vendor_class: string | null;
  terms: string | null;
  payment_method: string | null;
  ap_account: string | null;
  cash_account: string | null;
  is_1099_vendor: boolean | null;
  is_foreign_entity: boolean | null;
  is_labor_union: boolean | null;
  is_tax_agency: boolean | null;
  acumatica_sync_at: string | null;
  license_number: string | null;
  company_type: string | null;
  status: string | null;
  logo_url: string | null;
  created_at: string | null;
  updated_at: string | null;
  company_name: string | null;
  website: string | null;
  contact_count: number;
  project_count: number;
  has_w9: boolean;
}

export type CompanyFilterState = {
  status: FilterValue;
  company_type: FilterValue;
  source: FilterValue;
  has_w9: FilterValue;
  company_name: FilterValue;
  contact_count_min: FilterValue;
  project_count_min: FilterValue;
  business_phone: FilterValue;
  website: FilterValue;
  email_address: FilterValue;
  erp_vendor_id: FilterValue;
  created_at_from: FilterValue;
  created_at_to: FilterValue;
  updated_at_from: FilterValue;
  updated_at_to: FilterValue;
  primary_contact_id: FilterValue;
  logo_url: FilterValue;
};

export const EMPTY_COMPANY_FILTERS: CompanyFilterState = {
  status: undefined,
  company_type: undefined,
  source: undefined,
  has_w9: undefined,
  company_name: undefined,
  contact_count_min: undefined,
  project_count_min: undefined,
  business_phone: undefined,
  website: undefined,
  email_address: undefined,
  erp_vendor_id: undefined,
  created_at_from: undefined,
  created_at_to: undefined,
  updated_at_from: undefined,
  updated_at_to: undefined,
  primary_contact_id: undefined,
  logo_url: undefined,
};

export const companyColumns: ColumnConfig[] = [
  { id: "company_name", label: "Name", alwaysVisible: true },
  { id: "company_type", label: "Type", defaultVisible: true },
  { id: "status", label: "Status", defaultVisible: true },
  { id: "source", label: "Source", defaultVisible: true },
  { id: "w9", label: "W-9", defaultVisible: true },
  { id: "contact_count", label: "Contacts", defaultVisible: true },
  { id: "project_count", label: "Projects", defaultVisible: true },
  { id: "business_phone", label: "Phone", defaultVisible: true },
  { id: "website", label: "Website", defaultVisible: true },
  { id: "email_address", label: "Email", defaultVisible: false },
  { id: "erp_vendor_id", label: "Acumatica Vendor ID", defaultVisible: false },
  { id: "tax_id", label: "Tax ID", defaultVisible: false },
  { id: "legal_name", label: "Legal Name", defaultVisible: false },
  { id: "vendor_class", label: "Vendor Class", defaultVisible: false },
  { id: "terms", label: "Terms", defaultVisible: false },
  { id: "payment_method", label: "Payment Method", defaultVisible: false },
  { id: "ap_account", label: "AP Account", defaultVisible: false },
  { id: "cash_account", label: "Cash Account", defaultVisible: false },
  { id: "is_1099_vendor", label: "1099 Vendor", defaultVisible: false },
  { id: "is_foreign_entity", label: "Foreign Entity", defaultVisible: false },
  { id: "is_labor_union", label: "Labor Union", defaultVisible: false },
  { id: "is_tax_agency", label: "Tax Agency", defaultVisible: false },
  { id: "acumatica_sync_at", label: "Acumatica Sync", defaultVisible: false },
  { id: "license_number", label: "License Number", defaultVisible: false },
  { id: "created_at", label: "Date Added", defaultVisible: false },
  { id: "updated_at", label: "Last Updated", defaultVisible: false },
  { id: "primary_contact_id", label: "Primary Contact ID", defaultVisible: false },
  { id: "logo_url", label: "Logo URL", defaultVisible: false },
];

export const companyDefaultVisibleColumns = companyColumns
  .filter((column) => column.defaultVisible !== false)
  .map((column) => column.id);

const ALLOWED_SERVER_SORT_FIELDS = new Set([
  "company_name",
  "company_type",
  "status",
  "business_phone",
  "website",
  "email_address",
  "erp_vendor_id",
  "created_at",
  "updated_at",
]);

export const COMPANY_TYPE_FILTER_OPTIONS = [
  { value: "client", label: "Client" },
  { value: "vendor", label: "Vendor" },
  { value: "subcontractor", label: "Subcontractor" },
  { value: "supplier", label: "Supplier" },
  { value: "connected company", label: "Connected Company" },
];

// Archived is a soft delete: the table hides it unless the user selects
// "Archived" or "All". No selection means "everything except archived".
export const COMPANY_STATUS_FILTER_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "archived", label: "Archived" },
  { value: "all", label: "All (incl. archived)" },
];

export const COMPANY_SOURCE_FILTER_OPTIONS = [
  { value: "erp", label: "ERP / Acumatica" },
  { value: "other", label: "Other (non-ERP)" },
];

export const COMPANY_W9_FILTER_OPTIONS = [
  { value: "yes", label: "Has W-9" },
  { value: "no", label: "Missing W-9" },
];

export const companyFilters = [
  {
    id: "company_name",
    label: "Name",
    type: "text" as const,
    placeholder: "Contains...",
  },
  {
    id: "company_type",
    label: "Type",
    type: "select" as const,
    options: COMPANY_TYPE_FILTER_OPTIONS,
  },
  {
    id: "status",
    label: "Status",
    type: "select" as const,
    options: COMPANY_STATUS_FILTER_OPTIONS,
  },
  {
    id: "source",
    label: "Source",
    type: "select" as const,
    options: COMPANY_SOURCE_FILTER_OPTIONS,
  },
  {
    id: "has_w9",
    label: "W-9",
    type: "select" as const,
    options: COMPANY_W9_FILTER_OPTIONS,
  },
  {
    id: "business_phone",
    label: "Phone",
    type: "text" as const,
    placeholder: "Contains...",
  },
  {
    id: "website",
    label: "Website",
    type: "text" as const,
    placeholder: "Contains...",
  },
  {
    id: "email_address",
    label: "Email",
    type: "text" as const,
    placeholder: "Contains...",
  },
  {
    id: "erp_vendor_id",
    label: "ERP Vendor ID",
    type: "text" as const,
    placeholder: "Contains...",
  },
  {
    id: "created_at",
    label: "Date Added",
    type: "dateRange" as const,
  },
  {
    id: "updated_at",
    label: "Last Updated",
    type: "dateRange" as const,
  },
  {
    id: "primary_contact_id",
    label: "Primary Contact ID",
    type: "text" as const,
    placeholder: "Contains...",
  },
  {
    id: "logo_url",
    label: "Logo URL",
    type: "text" as const,
    placeholder: "Contains...",
  },
];

interface GlobalCompaniesResponse {
  data: CompanyRow[];
  pagination: {
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
  };
}

export function createGlobalCompaniesTableDefinition(options: {
  entityKey: string;
  forcedCompanyType?: string;
}): ServerTableDefinition<CompanyRow, CompanyFilterState> {
  const { entityKey, forcedCompanyType } = options;

  return {
    entityKey,
    allowedViews: ["table", "card", "list"],
    defaultView: "table",
    defaultPerPage: 50,
    defaultSortBy: "updated_at",
    defaultSortDirection: "desc",
    searchPlaceholder: "Search name, phone, email, ERP ID...",
    columns: companyColumns,
    defaultVisibleColumns: companyDefaultVisibleColumns,
    filters: companyFilters,
    defaultFilters: {
      ...EMPTY_COMPANY_FILTERS,
      ...(forcedCompanyType ? { company_type: forcedCompanyType } : {}),
    },
    parseFiltersFromSearchParams(searchParams) {
      return {
        status: searchParams.get("status") ?? undefined,
        company_type:
          forcedCompanyType ?? searchParams.get("company_type") ?? undefined,
        source: searchParams.get("source") ?? undefined,
        has_w9: searchParams.get("has_w9") ?? undefined,
        company_name: searchParams.get("company_name") ?? undefined,
        contact_count_min:
          searchParams.get("contact_count_min") ?? undefined,
        project_count_min:
          searchParams.get("project_count_min") ?? undefined,
        business_phone: searchParams.get("business_phone") ?? undefined,
        website: searchParams.get("website") ?? undefined,
        email_address: searchParams.get("email_address") ?? undefined,
        erp_vendor_id: searchParams.get("erp_vendor_id") ?? undefined,
        created_at_from: searchParams.get("created_at_from") ?? undefined,
        created_at_to: searchParams.get("created_at_to") ?? undefined,
        updated_at_from: searchParams.get("updated_at_from") ?? undefined,
        updated_at_to: searchParams.get("updated_at_to") ?? undefined,
        primary_contact_id:
          searchParams.get("primary_contact_id") ?? undefined,
        logo_url: searchParams.get("logo_url") ?? undefined,
      };
    },
    serializeFiltersToSearchParams(filters) {
      return {
        status: typeof filters.status === "string" ? filters.status : null,
        company_type: forcedCompanyType
          ? forcedCompanyType
          : typeof filters.company_type === "string"
            ? filters.company_type
            : null,
        source: typeof filters.source === "string" ? filters.source : null,
        has_w9: typeof filters.has_w9 === "string" ? filters.has_w9 : null,
        company_name:
          typeof filters.company_name === "string"
            ? filters.company_name
            : null,
        contact_count_min:
          typeof filters.contact_count_min === "string"
            ? filters.contact_count_min
            : null,
        project_count_min:
          typeof filters.project_count_min === "string"
            ? filters.project_count_min
            : null,
        business_phone:
          typeof filters.business_phone === "string"
            ? filters.business_phone
            : null,
        website:
          typeof filters.website === "string" ? filters.website : null,
        email_address:
          typeof filters.email_address === "string"
            ? filters.email_address
            : null,
        erp_vendor_id:
          typeof filters.erp_vendor_id === "string"
            ? filters.erp_vendor_id
            : null,
        created_at_from:
          typeof filters.created_at_from === "string"
            ? filters.created_at_from
            : null,
        created_at_to:
          typeof filters.created_at_to === "string"
            ? filters.created_at_to
            : null,
        updated_at_from:
          typeof filters.updated_at_from === "string"
            ? filters.updated_at_from
            : null,
        updated_at_to:
          typeof filters.updated_at_to === "string"
            ? filters.updated_at_to
            : null,
        primary_contact_id:
          typeof filters.primary_contact_id === "string"
            ? filters.primary_contact_id
            : null,
        logo_url:
          typeof filters.logo_url === "string" ? filters.logo_url : null,
      };
    },
    async fetchPage(query) {
      const params = new URLSearchParams();

      if (query.search.trim()) params.set("search", query.search.trim());
      // Omitting `status` is what tells the API to hide archived companies.
      // Never fall back to "all" here — that would un-hide the soft-deleted.
      if (typeof query.filters.status === "string" && query.filters.status) {
        params.set("status", query.filters.status);
      }

      const effectiveCompanyType =
        forcedCompanyType ||
        (typeof query.filters.company_type === "string"
          ? query.filters.company_type
          : "");
      if (effectiveCompanyType) {
        params.set("company_type", effectiveCompanyType);
      }

      const filterParamKeys: Array<keyof CompanyFilterState> = [
        "source",
        "has_w9",
        "company_name",
        "contact_count_min",
        "project_count_min",
        "business_phone",
        "website",
        "email_address",
        "erp_vendor_id",
        "created_at_from",
        "created_at_to",
        "updated_at_from",
        "updated_at_to",
        "primary_contact_id",
        "logo_url",
      ];
      for (const key of filterParamKeys) {
        const value = query.filters[key];
        if (typeof value === "string" && value.trim()) {
          params.set(key, value.trim());
        }
      }

      params.set("page", String(query.page));
      params.set("per_page", String(query.perPage));

      const sortBy = ALLOWED_SERVER_SORT_FIELDS.has(query.sortBy ?? "")
        ? query.sortBy
        : "updated_at";
      params.set("sort", `${sortBy}:${query.sortDirection}`);

      const result = await apiFetch<GlobalCompaniesResponse>(
        `/api/directory/project-companies?${params.toString()}`,
        { cache: "no-store" },
      );

      return {
        items: result.data ?? [],
        total: result.pagination?.total ?? result.data?.length ?? 0,
        totalPages: result.pagination?.total_pages ?? 1,
      };
    },
  };
}
