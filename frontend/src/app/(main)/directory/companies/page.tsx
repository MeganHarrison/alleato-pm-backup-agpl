"use client";

import * as React from "react";
import type { ReactElement } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Globe,
  Mail,
  Phone,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { getDirectoryTabs } from "@/config/directory-tabs";
import {
  UnifiedTablePage,
  CellBadge,
  CellText,
  CellLink,
  TableDateValue,
  type FilterValue,
  type CellColorMap,
} from "@/components/tables/unified";
import type { ColumnConfig, FilterConfig, TableColumn } from "@/components/tables/unified";
import { useServerTableDefinition } from "@/features/tables/server-table";
import {
  companyColumns,
  companyFilters,
  createGlobalCompaniesTableDefinition,
  EMPTY_COMPANY_FILTERS,
  type CompanyFilterState,
  type CompanyRow,
} from "@/features/companies/directory-companies-table-definition";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-client";
import { acumaticaVendorUrl } from "@/lib/acumatica/vendor-url";
import { formatPhoneNumber } from "@/lib/format";

const STATUS_COLORS: CellColorMap = {
  active: "bg-success/10 text-success",
  inactive: "bg-muted text-muted-foreground",
  archived: "bg-warning/10 text-warning",
};

const SOURCE_COLORS: CellColorMap = {
  Acumatica: "bg-primary/10 text-primary",
  Other: "bg-muted text-muted-foreground",
};

const TYPE_COLORS: CellColorMap = {
  subcontractor: "bg-primary/10 text-primary",
  supplier: "bg-warning/10 text-warning",
  vendor: "bg-primary/10 text-primary",
  "connected company": "bg-success/10 text-success",
};

function booleanCellValue(value: boolean | null): string | null {
  if (value === null) return null;
  return value ? "Yes" : "No";
}

function buildCompanyTableColumns(): TableColumn<CompanyRow>[] {
  const colMap = Object.fromEntries(companyColumns.map((c) => [c.id, c]));
  const col = (id: string) => colMap[id];

  return [
    {
      ...col("company_name"),
      render: (item) => (
        <CellLink
          value={item.company_name || item.company_id}
          href={`/directory/companies/${item.company_id}`}
        />
      ),
      sortValue: (item) => item.company_name || item.company_id,
    },
    {
      ...col("company_type"),
      render: (item) => <CellBadge value={item.company_type} colorMap={TYPE_COLORS} emptyLabel="-" />,
      sortValue: (item) => item.company_type || "",
    },
    {
      ...col("status"),
      render: (item) => <CellBadge value={item.status} colorMap={STATUS_COLORS} emptyLabel="-" />,
      sortValue: (item) => item.status || "",
    },
    {
      ...col("source"),
      sortable: false,
      // Acumatica holds vendors AND customers — a company is ERP-backed if it
      // carries either id. Keying this off erp_vendor_id alone labelled every
      // Acumatica customer "Other".
      render: (item) => (
        <CellBadge
          value={item.erp_vendor_id || item.erp_customer_id ? "Acumatica" : "Other"}
          colorMap={SOURCE_COLORS}
        />
      ),
    },
    {
      ...col("w9"),
      sortable: false,
      render: (item) =>
        item.has_w9 ? (
          <a
            href={`/directory/companies/${item.company_id}`}
            className="text-primary hover:underline"
          >
            View
          </a>
        ) : (
          <span className="text-warning">Missing</span>
        ),
    },
    {
      ...col("contact_count"),
      render: (item) => (
        <span className={item.contact_count > 0 ? "text-foreground" : "text-muted-foreground"}>
          {item.contact_count}
        </span>
      ),
      sortValue: (item) => item.contact_count,
    },
    {
      ...col("project_count"),
      render: (item) => (
        <span className={item.project_count > 0 ? "text-foreground" : "text-muted-foreground"}>
          {item.project_count}
        </span>
      ),
      sortValue: (item) => item.project_count,
    },
    {
      ...col("business_phone"),
      render: (item) => <CellText value={formatPhoneNumber(item.business_phone)} emptyLabel="-" />,
      sortValue: (item) => item.business_phone || "",
    },
    {
      ...col("website"),
      render: (item) => {
        if (!item.website) return <span className="text-muted-foreground">-</span>;
        const display = item.website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
        return <CellText value={display} />;
      },
      sortValue: (item) => item.website || "",
    },
    {
      ...col("email_address"),
      render: (item) => <CellText value={item.email_address} emptyLabel="-" />,
      sortValue: (item) => item.email_address || "",
    },
    {
      ...col("erp_vendor_id"),
      render: (item) =>
        item.erp_vendor_id ? (
          <a
            href={acumaticaVendorUrl(item.erp_vendor_id)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-primary hover:underline"
          >
            {item.erp_vendor_id}
          </a>
        ) : (
          <span className="text-muted-foreground">-</span>
        ),
      sortValue: (item) => item.erp_vendor_id || "",
    },
    {
      ...col("tax_id"),
      render: (item) => <CellText value={item.tax_id} emptyLabel="-" />,
      sortValue: (item) => item.tax_id || "",
    },
    {
      ...col("legal_name"),
      render: (item) => <CellText value={item.legal_name} emptyLabel="-" />,
      sortValue: (item) => item.legal_name || "",
    },
    {
      ...col("vendor_class"),
      render: (item) => <CellText value={item.vendor_class} emptyLabel="-" />,
      sortValue: (item) => item.vendor_class || "",
    },
    {
      ...col("terms"),
      render: (item) => <CellText value={item.terms} emptyLabel="-" />,
      sortValue: (item) => item.terms || "",
    },
    {
      ...col("payment_method"),
      render: (item) => <CellText value={item.payment_method} emptyLabel="-" />,
      sortValue: (item) => item.payment_method || "",
    },
    {
      ...col("ap_account"),
      render: (item) => <CellText value={item.ap_account} emptyLabel="-" />,
      sortValue: (item) => item.ap_account || "",
    },
    {
      ...col("cash_account"),
      render: (item) => <CellText value={item.cash_account} emptyLabel="-" />,
      sortValue: (item) => item.cash_account || "",
    },
    {
      ...col("is_1099_vendor"),
      render: (item) => <CellText value={booleanCellValue(item.is_1099_vendor)} emptyLabel="-" />,
      sortValue: (item) => booleanCellValue(item.is_1099_vendor) || "",
    },
    {
      ...col("is_foreign_entity"),
      render: (item) => <CellText value={booleanCellValue(item.is_foreign_entity)} emptyLabel="-" />,
      sortValue: (item) => booleanCellValue(item.is_foreign_entity) || "",
    },
    {
      ...col("is_labor_union"),
      render: (item) => <CellText value={booleanCellValue(item.is_labor_union)} emptyLabel="-" />,
      sortValue: (item) => booleanCellValue(item.is_labor_union) || "",
    },
    {
      ...col("is_tax_agency"),
      render: (item) => <CellText value={booleanCellValue(item.is_tax_agency)} emptyLabel="-" />,
      sortValue: (item) => booleanCellValue(item.is_tax_agency) || "",
    },
    {
      ...col("acumatica_sync_at"),
      render: (item) => <TableDateValue value={item.acumatica_sync_at} emptyLabel="-" />,
      sortValue: (item) =>
        item.acumatica_sync_at ? new Date(item.acumatica_sync_at).getTime() : 0,
    },
    {
      ...col("license_number"),
      render: (item) => <CellText value={item.license_number} emptyLabel="-" />,
      sortValue: (item) => item.license_number || "",
    },
    {
      ...col("created_at"),
      render: (item) => <TableDateValue value={item.created_at} emptyLabel="-" />,
      sortValue: (item) => (item.created_at ? new Date(item.created_at).getTime() : 0),
    },
    {
      ...col("updated_at"),
      render: (item) => <TableDateValue value={item.updated_at} emptyLabel="-" />,
      sortValue: (item) => (item.updated_at ? new Date(item.updated_at).getTime() : 0),
    },
    {
      ...col("primary_contact_id"),
      render: (item) => <CellText value={item.primary_contact_id} emptyLabel="-" className="font-mono text-xs" />,
      sortValue: (item) => item.primary_contact_id || "",
    },
    {
      ...col("logo_url"),
      render: (item) => <CellText value={item.logo_url} emptyLabel="-" />,
      sortValue: (item) => item.logo_url || "",
    },
  ];
}

function CompanyPreviewPane({
  company,
  companies,
  onOpenCompanyPage,
  onSelectCompany,
  onClose,
}: {
  company: CompanyRow | null;
  companies: CompanyRow[];
  onOpenCompanyPage: (company: CompanyRow) => void;
  onSelectCompany: (id: string) => void;
  onClose: () => void;
}): ReactElement {
  const currentIndex = company ? companies.findIndex((c) => c.id === company.id) : -1;
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < companies.length - 1;

  if (!company) {
    return (
      <div className="p-6 space-y-3 text-sm text-muted-foreground">
        <p>Select a company to preview details.</p>
        <p className="text-xs">Arrow Up/Down to move, Enter to open.</p>
      </div>
    );
  }

  const displayName = company.company_name || company.company_id;
  const typeLabel = company.company_type
    ? company.company_type.replace(/_/g, " ").split(" ").map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ")
    : null;

  return (
    <div className="flex flex-col h-full">
      {/* Panel header with navigation */}
      <div className="flex items-center justify-between gap-1 px-4 h-11">
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            className="h-5 w-5"
            disabled={!hasPrev}
            onClick={() => hasPrev && onSelectCompany(companies[currentIndex - 1].id)}
            aria-label="Previous company"
          >
            <ChevronLeft />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-5 w-5"
            disabled={!hasNext}
            onClick={() => hasNext && onSelectCompany(companies[currentIndex + 1].id)}
            aria-label="Next company"
          >
            <ChevronRight />
          </Button>
          <span className="text-xs text-muted-foreground ml-1">
            {currentIndex + 1} of {companies.length}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            className="h-5 w-5"
            onClick={onClose}
            aria-label="Close panel"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
        {/* Company header */}
        <div className="space-y-2">
          <div className="min-w-0">
            {/* eslint-disable-next-line design-system/no-raw-heading */}
            <h3 className="text-sm font-semibold leading-tight truncate">{displayName}</h3>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              {typeLabel && (
                <span className="text-xs text-muted-foreground">
                  {typeLabel}
                </span>
              )}
              {company.status && (
                <CellBadge value={company.status} colorMap={STATUS_COLORS} />
              )}
            </div>
          </div>
        </div>

        {/* Identity section */}
        {(company.business_phone || company.email_address || company.website) && (
          <div className="space-y-3 border-t border-border pt-4">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Contact
            </p>
            <div className="space-y-2.5">
              {company.business_phone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span>{formatPhoneNumber(company.business_phone)}</span>
                </div>
              )}
              {company.email_address && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <a href={`mailto:${company.email_address}`} className="text-primary hover:underline truncate">
                    {company.email_address}
                  </a>
                </div>
              )}
              {company.website && (
                <div className="flex items-center gap-2 text-sm">
                  <Globe className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <a href={company.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate">
                    {company.website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}
                  </a>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Additional details */}
        {(company.erp_vendor_id || company.created_at) && (
          <div className="space-y-3 border-t border-border pt-4">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Details
            </p>
            <dl className="space-y-2 text-sm">
              {company.erp_vendor_id && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">ERP Vendor ID</dt>
                  <dd>
                    <a
                      href={acumaticaVendorUrl(company.erp_vendor_id)}
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono text-xs text-primary hover:underline"
                    >
                      {company.erp_vendor_id}
                    </a>
                  </dd>
                </div>
              )}
              {company.created_at && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Added</dt>
                  <dd><TableDateValue value={company.created_at} /></dd>
                </div>
              )}
            </dl>
          </div>
        )}
      </div>

      <div className="shrink-0 px-5 pb-5">
        <Button className="w-full" variant="outline" onClick={() => onOpenCompanyPage(company)}>
          View Company
        </Button>
      </div>
    </div>
  );
}

export default function GlobalCompanyDirectoryPage(): ReactElement {
  const pathname = usePathname()!;
  const router = useRouter();
  const searchParams = useSearchParams()!;
  const isClientsRoute =
    pathname === "/directory/clients" || pathname.endsWith("/directory/clients");
  const forcedCompanyType = isClientsRoute ? "client" : undefined;
  const definition = React.useMemo(
    () =>
      createGlobalCompaniesTableDefinition({
        entityKey: isClientsRoute
          ? "global-directory-clients-v3"
          : "global-directory-companies-v3",
        forcedCompanyType,
      }),
    [forcedCompanyType, isClientsRoute],
  );

  const {
    tableState,
    items: companies,
    totalItems,
    totalPages,
    isLoading,
    isFetching,
    error,
    activeFilters,
    refresh,
    handleViewChange,
    handleFilterChange,
    handleSortChange,
    handlePageChange,
    handlePerPageChange,
  } = useServerTableDefinition<CompanyRow, CompanyFilterState>({
    definition,
    searchParams,
    pathname,
    router,
  });

  const filters: FilterConfig[] = React.useMemo(() => {
    if (forcedCompanyType) {
      return companyFilters.filter((filter) => filter.id !== "company_type");
    }

    return companyFilters;
  }, [forcedCompanyType]);

  const tableColumns = React.useMemo(() => buildCompanyTableColumns(), []);
  const selectedCompanyId = searchParams.get("detail");
  const selectedCompany =
    selectedCompanyId ? companies.find((company) => company.id === selectedCompanyId) ?? null : null;
  const activeCompanyId = selectedCompany?.id ?? null;

  const handleDeleteCompany = React.useCallback(
    async (company: CompanyRow) => {
      try {
        await apiFetch(`/api/directory/companies/${company.id}`, { method: "DELETE" });
        toast.success("Company deleted");
        await refresh();
      } catch (err) {
        toast.error("Failed to delete company");
      }
    },
    [refresh],
  );

  const openCompanyPage = React.useCallback(
    (company: CompanyRow) => {
      // Company detail pages are keyed by global companies.id.
      router.push(`/directory/companies/${company.company_id}`);
    },
    [router],
  );

  const handleCompanyFilterChange = (nextFilters: CompanyFilterState) => {
    const mergedFilters: CompanyFilterState = forcedCompanyType
      ? {
          ...nextFilters,
          company_type: forcedCompanyType,
        }
      : nextFilters;

    handleFilterChange(mergedFilters);
  };

  const handleTableKeyDown = (
    event: React.KeyboardEvent<HTMLDivElement>,
    visibleItems: CompanyRow[],
  ) => {
    const target = event.target as HTMLElement | null;
    if (target && ["INPUT", "TEXTAREA", "SELECT", "BUTTON", "A"].includes(target.tagName)) {
      return;
    }

    if (visibleItems.length === 0) return;

    const currentIndex = visibleItems.findIndex((company) => company.id === activeCompanyId);
    const hasSelection = currentIndex >= 0;
    const fallbackIndex = hasSelection ? currentIndex : 0;

    if (event.key === "ArrowDown" || event.key === "j") {
      event.preventDefault();
      const nextIndex = hasSelection ? Math.min(visibleItems.length - 1, fallbackIndex + 1) : 0;
      tableState.setSearchParams({ detail: visibleItems[nextIndex].id });
      return;
    }

    if (event.key === "ArrowUp" || event.key === "k") {
      event.preventDefault();
      const nextIndex = hasSelection ? Math.max(0, fallbackIndex - 1) : 0;
      tableState.setSearchParams({ detail: visibleItems[nextIndex].id });
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      const company = visibleItems[fallbackIndex];
      if (company) {
        openCompanyPage(company);
      }
    }
  };

  const tabs = getDirectoryTabs(pathname);
  const isFiltered =
    Boolean(tableState.searchInput) ||
    Object.entries(activeFilters).some(([key, value]) => {
      if (forcedCompanyType && key === "company_type") return false;
      return value !== undefined && value !== "" && value !== null;
    });

  return (
    <UnifiedTablePage
      header={{
        title: isClientsRoute ? "Clients" : "Companies",
      }}
      tabs={tabs}
      toolbar={{
        totalItems,
        filteredItems: totalItems,
        searchValue: tableState.searchInput,
        onSearchChange: tableState.setSearchInput,
        searchPlaceholder: definition.searchPlaceholder,
        currentView: tableState.currentView,
        onViewChange: handleViewChange,
        enabledViews: definition.allowedViews,
        filters,
        activeFilters,
        onFilterChange: (filters) =>
          handleCompanyFilterChange(filters as CompanyFilterState),
        onClearFilters: () =>
          handleCompanyFilterChange({
            ...EMPTY_COMPANY_FILTERS,
            ...(forcedCompanyType ? { company_type: forcedCompanyType } : {}),
          }),
        columns: companyColumns,
        visibleColumns: tableState.visibleColumns,
        onColumnVisibilityChange: tableState.setVisibleColumns,
        savedViewsScope: definition.entityKey,
        savedViewsDefaults: {
          visibleColumns: definition.defaultVisibleColumns,
          columnOrder: companyColumns.map((column) => column.id),
          columnWidths: {},
          sortBy: definition.defaultSortBy,
          sortDirection: definition.defaultSortDirection,
          filters: definition.defaultFilters,
        },
      }}
      data={{
        items: companies,
        isLoading,
        isFetching,
        error: error ?? undefined,
      }}
      table={{
        columns: tableColumns,
        getRowId: (item) => item.id,
        activeRowId: activeCompanyId,
        onTableKeyDown: handleTableKeyDown,
        onRowClick: (item) => tableState.setSearchParams({ detail: item.id }),
        onDelete: handleDeleteCompany,
      }}
      sidePanel={{
        content: (
          <CompanyPreviewPane
            company={selectedCompany}
            companies={companies}
            onOpenCompanyPage={openCompanyPage}
            onSelectCompany={(id) => tableState.setSearchParams({ detail: id })}
            onClose={() => tableState.setSearchParams({ detail: null })}
          />
        ),
      }}
      sorting={{
        sortBy: tableState.sortBy,
        sortDirection: tableState.sortDirection,
        onSortChange: handleSortChange,
      }}
      emptyState={{
        title: isClientsRoute ? "No clients found" : "No companies found",
        description: isClientsRoute
          ? "No clients are available yet."
          : "No companies are available yet.",
        filteredDescription: "Try adjusting your search or filters.",
        isFiltered,
      }}
      pagination={{
        page: tableState.page,
        totalPages,
        perPage: tableState.perPage,
        onPageChange: handlePageChange,
        onPerPageChange: handlePerPageChange,
      }}
      features={{
        enableExport: false,
      }}
      layout={{
        fullBleedTable: true,
        removeTableFrame: true,
      }}
    />
  );
}
