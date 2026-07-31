"use client";

import * as React from "react";
import type { ReactElement } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { formatDate, formatPhoneNumber } from "@/lib/format";
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  Mail,
  Phone,
  Plus,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import { getDirectoryTabs } from "@/config/directory-tabs";
import type { Database } from "@/types/database.types";
import {
  DataQualityCell,
  UnifiedTablePage,
  useUnifiedTableState,
  type FilterValue,
} from "@/components/tables/unified";
import type { ColumnConfig, FilterConfig, TableColumn } from "@/components/tables/unified";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ds";
import { apiFetch } from "@/lib/api-client";
import {
  formatDataQualitySummary,
  getVendorDataQualityIssues,
} from "@/features/directory/data-quality";

type Vendor = Database["public"]["Tables"]["companies"]["Row"];

type VendorFilterState = Record<string, FilterValue>;

const EMPTY_FILTERS: VendorFilterState = {
  status: undefined,
  vendor_class: undefined,
  payment_method: undefined,
};

const vendorColumns: ColumnConfig[] = [
  { id: "name", label: "Vendor Name", alwaysVisible: true },
  { id: "legal_name", label: "Legal Name", defaultVisible: false },
  { id: "contact_name", label: "Contact", defaultVisible: true },
  { id: "contact_email", label: "Email", defaultVisible: true },
  { id: "contact_phone", label: "Phone", defaultVisible: true },
  { id: "city", label: "City", defaultVisible: true },
  { id: "state", label: "State", defaultVisible: true },
  { id: "status", label: "Status", defaultVisible: true },
  { id: "data_quality", label: "Data Quality", defaultVisible: true },
  { id: "vendor_class", label: "Class", defaultVisible: true },
  { id: "payment_method", label: "Payment Method", defaultVisible: false },
  { id: "terms", label: "Terms", defaultVisible: false },
  { id: "is_1099_vendor", label: "1099", defaultVisible: false },
  { id: "acumatica_vendor_id", label: "Acumatica ID", defaultVisible: false },
  { id: "created_at", label: "Created", defaultVisible: false },
];

const vendorDefaultVisibleColumns = vendorColumns
  .filter((col) => col.defaultVisible !== false)
  .map((col) => col.id);

function normalizeVendorField(value: string | null | undefined): string {
  if (!value) return "";
  const trimmed = value.trim();
  if (!trimmed) return "";

  // Supabase/Postgres empty-array/object text artifacts sometimes appear as "{}"/"[]".
  if (
    trimmed === "{}" ||
    trimmed === "[]" ||
    trimmed.toLowerCase() === "null" ||
    trimmed.toLowerCase() === "undefined"
  ) {
    return "";
  }

  return trimmed;
}

type VendorFieldType = "text" | "boolean" | "date" | "email" | "phone";

const vendorPreviewFields: Array<{
  key: keyof Vendor;
  label: string;
  type?: VendorFieldType;
}> = [
  { key: "name", label: "Name" },
  { key: "legal_name", label: "Legal Name" },
  { key: "status", label: "Status" },
  { key: "vendor_class", label: "Vendor Class" },
  { key: "acumatica_vendor_id", label: "Acumatica Vendor ID" },
  { key: "acumatica_sync_at", label: "Acumatica Sync At", type: "date" },
  { key: "address", label: "Address" },
  { key: "city", label: "City" },
  { key: "state", label: "State" },
  { key: "zip_code", label: "Zip Code" },
  { key: "payment_method", label: "Payment Method" },
  { key: "terms", label: "Terms" },
  { key: "tax_id", label: "Tax ID" },
  { key: "notes", label: "Notes" },
  { key: "created_at", label: "Created At", type: "date" },
  { key: "updated_at", label: "Updated At", type: "date" },
];

function formatVendorFieldValue(vendor: Vendor, field: (typeof vendorPreviewFields)[number]): ReactElement {
  const value = vendor[field.key];

  if (field.type === "boolean") {
    if (value === null || value === undefined) {
      return <span className="text-muted-foreground">-</span>;
    }
    return <span>{value ? "Yes" : "No"}</span>;
  }

  if (field.type === "date") {
    if (typeof value !== "string" || !value) {
      return <span className="text-muted-foreground">-</span>;
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return <span className="text-muted-foreground">-</span>;
    }
    return <span>{parsed.toLocaleString()}</span>;
  }

  if (field.type === "email") {
    const email = normalizeVendorField(typeof value === "string" ? value : "");
    if (!email) {
      return <span className="text-muted-foreground">-</span>;
    }
    return (
      <a href={`mailto:${email}`} className="text-primary hover:underline break-all">
        {email}
      </a>
    );
  }

  if (field.type === "phone") {
    const phone = formatPhoneNumber(
      normalizeVendorField(typeof value === "string" ? value : ""),
    );
    if (!phone) {
      return <span className="text-muted-foreground">-</span>;
    }
    return <span>{phone}</span>;
  }

  const text = normalizeVendorField(typeof value === "string" ? value : value == null ? "" : String(value));
  if (!text) {
    return <span className="text-muted-foreground">-</span>;
  }
  return <span className="break-words">{text}</span>;
}

function buildVendorTableColumns(): TableColumn<Vendor>[] {
  return [
    {
      ...vendorColumns[0],
      render: (item) => (
        <Link
          href={`/directory/vendors/${encodeURIComponent(item.id)}`}
          className="font-medium text-primary hover:underline"
          onClick={(event) => event.stopPropagation()}
        >
          {item.name}
        </Link>
      ),
      sortValue: (item) => item.name,
    },
    {
      ...vendorColumns[1],
      render: (item) => <span>{item.legal_name || "-"}</span>,
      sortValue: (item) => item.legal_name || "",
    },
    {
      ...vendorColumns[2],
      render: (item) => <span>{item.contact_name || "-"}</span>,
      sortValue: (item) => item.contact_name || "",
    },
    {
      ...vendorColumns[3],
      render: (item) => <span>{normalizeVendorField(item.contact_email) || "-"}</span>,
      sortValue: (item) => normalizeVendorField(item.contact_email),
    },
    {
      ...vendorColumns[4],
      render: (item) => <span>{formatPhoneNumber(normalizeVendorField(item.contact_phone)) || "-"}</span>,
      sortValue: (item) => normalizeVendorField(item.contact_phone),
    },
    {
      ...vendorColumns[5],
      render: (item) => <span>{item.city || "-"}</span>,
      sortValue: (item) => item.city || "",
    },
    {
      ...vendorColumns[6],
      render: (item) => <span>{item.state || "-"}</span>,
      sortValue: (item) => item.state || "",
    },
    {
      ...vendorColumns[7],
      render: (item) => (
        <StatusBadge status={item.status === "active" ? "Active" : "Inactive"} />
      ),
      sortValue: (item) => (item.status === "active" ? "Active" : "Inactive"),
    },
    {
      ...vendorColumns[8],
      sortable: false,
      render: (item) => (
        <DataQualityCell issues={getVendorDataQualityIssues(item)} />
      ),
      csvValue: (item) => formatDataQualitySummary(getVendorDataQualityIssues(item)),
    },
    {
      ...vendorColumns[9],
      render: (item) => <span>{item.vendor_class || "-"}</span>,
      sortValue: (item) => item.vendor_class || "",
    },
    {
      ...vendorColumns[10],
      render: (item) => <span>{item.payment_method || "-"}</span>,
      sortValue: (item) => item.payment_method || "",
    },
    {
      ...vendorColumns[11],
      render: (item) => <span>{item.terms || "-"}</span>,
      sortValue: (item) => item.terms || "",
    },
    {
      ...vendorColumns[12],
      render: (item) => <span>{item.is_1099_vendor ? "Yes" : "No"}</span>,
      sortValue: (item) => (item.is_1099_vendor ? "Yes" : "No"),
    },
    {
      ...vendorColumns[13],
      render: (item) => (
        <span className="font-mono text-xs">{item.acumatica_vendor_id || "-"}</span>
      ),
      sortValue: (item) => item.acumatica_vendor_id || "",
    },
    {
      ...vendorColumns[14],
      render: (item) => <span>{formatDate(item.created_at)}</span>,
      sortValue: (item) => (item.created_at ? new Date(item.created_at).getTime() : 0),
    },
  ];
}

function VendorPreviewPane({
  vendor,
  vendors,
  onSelectVendor,
  onClose,
}: {
  vendor: Vendor | null;
  vendors: Vendor[];
  onSelectVendor: (id: string) => void;
  onClose: () => void;
}): ReactElement {
  const currentIndex = vendor ? vendors.findIndex((v) => v.id === vendor.id) : -1;
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < vendors.length - 1;

  if (!vendor) {
    return (
      <div className="p-6 space-y-3 text-sm text-muted-foreground">
        <p>Select a vendor to preview details.</p>
      </div>
    );
  }

  const email = normalizeVendorField(vendor.contact_email);
  const phone = formatPhoneNumber(normalizeVendorField(vendor.contact_phone));
  const contactName = normalizeVendorField(vendor.contact_name);

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
            onClick={() => hasPrev && onSelectVendor(vendors[currentIndex - 1].id)}
            aria-label="Previous vendor"
          >
            <ChevronLeft />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-5 w-5"
            disabled={!hasNext}
            onClick={() => hasNext && onSelectVendor(vendors[currentIndex + 1].id)}
            aria-label="Next vendor"
          >
            <ChevronRight />
          </Button>
          <span className="text-xs text-muted-foreground ml-1">
            {currentIndex + 1} of {vendors.length}
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
      <div className="flex-1 overflow-y-auto">
        {/* Vendor header */}
        <div className="px-5 pt-5 pb-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Building2 className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              {/* eslint-disable-next-line design-system/no-raw-heading */}
              <h3 className="text-sm font-semibold leading-tight truncate">{vendor.name}</h3>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <StatusBadge status={vendor.status === "active" ? "Active" : "Inactive"} />
                {vendor.vendor_class && (
                  <StatusBadge status={vendor.vendor_class} />
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Contact section */}
        {(contactName || email || phone) && (
          <div className="px-5 pb-4">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-2">
              Contact
            </p>
            <div className="rounded-md border border-border/60 bg-background px-3 py-3 space-y-2">
              {contactName && (
                <div className="text-sm font-medium leading-tight">{contactName}</div>
              )}
              {phone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span>{phone}</span>
                </div>
              )}
              {email && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <a href={`mailto:${email}`} className="text-primary hover:underline truncate">
                    {email}
                  </a>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Full vendor field set */}
        <div className="px-5 pb-5">
          <div className="space-y-3 text-sm">
            {vendorPreviewFields.map((field) => (
              <div
                key={String(field.key)}
                className="flex items-start justify-between gap-3"
              >
                <span className="w-36 shrink-0 text-foreground/80">{field.label}</span>
                <div className="min-w-0 flex-1 text-right break-words">
                  {formatVendorFieldValue(vendor, field)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer action */}
      <div className="px-5 pb-5 shrink-0">
        <Button asChild className="w-full" variant="outline" size="sm">
          <Link href={`/directory/vendors/${encodeURIComponent(vendor.id)}`}>
            View Vendor
          </Link>
        </Button>
      </div>
    </div>
  );
}

export default function DirectoryVendorsPage(): ReactElement {
  const pathname = usePathname()! ?? "";
  const router = useRouter();
  const searchParams = (useSearchParams() ?? new URLSearchParams()) as NonNullable<ReturnType<typeof useSearchParams>>;

  const initialFilters: VendorFilterState = {
    status: searchParams.get("status") || undefined,
    vendor_class: searchParams.get("vendor_class") || undefined,
    payment_method: searchParams.get("payment_method") || undefined,
  };

  const tableState = useUnifiedTableState({
    entityKey: "global-directory-vendors",
    searchParams,
    pathname,
    router,
    defaults: {
      view: "table",
      allowedViews: ["table", "card", "list"],
      page: 1,
      perPage: 50,
      search: "",
      sortBy: "name",
      sortDirection: "asc",
      visibleColumns: vendorDefaultVisibleColumns,
      filters: initialFilters,
    },
  });

  const [vendors, setVendors] = React.useState<Vendor[]>([]);
  const [pagination, setPagination] = React.useState({
    page: 1,
    per_page: 50,
    total: 0,
    total_pages: 1,
  });
  const [isLoading, setIsLoading] = React.useState(true);
  const [isFetching, setIsFetching] = React.useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);
  const latestRequestIdRef = React.useRef(0);
  const abortControllerRef = React.useRef<AbortController | null>(null);
  const activeFilters = tableState.activeFilters as VendorFilterState;

  const fetchVendors = React.useCallback(async () => {
    const requestId = ++latestRequestIdRef.current;
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      if (hasLoadedOnce) {
        setIsFetching(true);
      } else {
        setIsLoading(true);
      }
      setError(null);
      const params = new URLSearchParams({
        page: String(tableState.page),
        per_page: String(tableState.perPage),
        sort: tableState.sortBy ?? "name",
        sort_dir: tableState.sortDirection,
      });

      if (tableState.debouncedSearch.trim()) {
        params.set("search", tableState.debouncedSearch.trim());
      }

      if (typeof activeFilters.status === "string" && activeFilters.status) {
        params.set("status", activeFilters.status);
      }
      if (typeof activeFilters.vendor_class === "string" && activeFilters.vendor_class) {
        params.set("vendor_class", activeFilters.vendor_class);
      }
      if (typeof activeFilters.payment_method === "string" && activeFilters.payment_method) {
        params.set("payment_method", activeFilters.payment_method);
      }

      const payload = await apiFetch<{
        data?: Vendor[];
        pagination?: { page: number; per_page: number; total: number; total_pages: number };
      }>(`/api/directory/vendors?${params.toString()}`, {
        signal: controller.signal,
      });

      // Ignore stale responses from older, slower requests.
      if (requestId !== latestRequestIdRef.current) {
        return;
      }

      setVendors(payload.data || []);
      setHasLoadedOnce(true);
      setPagination(
        payload.pagination || {
          page: tableState.page,
          per_page: tableState.perPage,
          total: payload.data?.length || 0,
          total_pages: 1,
        },
      );
    } catch (fetchError) {
      if (fetchError instanceof DOMException && fetchError.name === "AbortError") {
        return;
      }
      if (requestId !== latestRequestIdRef.current) {
        return;
      }
      setError(fetchError as Error);
    } finally {
      if (requestId === latestRequestIdRef.current) {
        setIsLoading(false);
        setIsFetching(false);
      }
    }
  }, [
    activeFilters.status,
    activeFilters.payment_method,
    activeFilters.vendor_class,
    tableState.debouncedSearch,
    tableState.page,
    tableState.perPage,
    tableState.sortBy,
    tableState.sortDirection,
    hasLoadedOnce,
  ]);

  React.useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  React.useEffect(() => {
    fetchVendors();
  }, [fetchVendors]);

  // Sync URL filters to table state
  React.useEffect(() => {
    const nextStatus = searchParams.get("status") || undefined;
    const nextClass = searchParams.get("vendor_class") || undefined;
    const nextPayment = searchParams.get("payment_method") || undefined;
    tableState.setActiveFilters((prev) => {
      if (
        prev.status === nextStatus &&
        prev.vendor_class === nextClass &&
        prev.payment_method === nextPayment
      ) {
        return prev;
      }
      return { status: nextStatus, vendor_class: nextClass, payment_method: nextPayment };
    });
  }, [searchParams, tableState.setActiveFilters]);

  // Derive filter options from data
  const filterOptions = React.useMemo(() => {
    const classes = Array.from(new Set(vendors.map((v) => v.vendor_class).filter(Boolean)));
    const methods = Array.from(new Set(vendors.map((v) => v.payment_method).filter(Boolean)));
    return { classes, methods };
  }, [vendors]);

  const filters: FilterConfig[] = React.useMemo(
    () => [
      {
        id: "status",
        label: "Status",
        type: "select",
        options: [
          { value: "active", label: "Active" },
          { value: "inactive", label: "Inactive" },
        ],
      },
      {
        id: "vendor_class",
        label: "Class",
        type: "select",
        options: filterOptions.classes.map((c) => ({ value: String(c), label: String(c) })),
      },
      {
        id: "payment_method",
        label: "Payment Method",
        type: "select",
        options: filterOptions.methods.map((m) => ({ value: String(m), label: String(m) })),
      },
    ],
    [filterOptions],
  );

  const tableColumns = React.useMemo(() => buildVendorTableColumns(), []);
  const tabs = getDirectoryTabs(pathname);
  const selectedVendorId = searchParams.get("detail");
  const selectedVendor =
    selectedVendorId ? vendors.find((vendor) => vendor.id === selectedVendorId) ?? null : null;
  const activeVendorId = selectedVendor?.id ?? null;
  const isFiltered =
    Boolean(tableState.searchInput) ||
    Boolean(activeFilters.status) ||
    Boolean(activeFilters.vendor_class) ||
    Boolean(activeFilters.payment_method);

  const handleDeleteVendor = React.useCallback(
    async (vendor: Vendor) => {
      try {
        const supabase = createClient();
        const { error: deleteError } = await supabase
          .from("companies")
          .delete()
          .eq("id", vendor.id);
        if (deleteError) throw deleteError;
        toast.success("Vendor deleted");
        setVendors((prev) => prev.filter((v) => v.id !== vendor.id));
      } catch {
        toast.error("Failed to delete vendor");
      }
    },
    [],
  );

  const handleFilterChange = (nextFilters: VendorFilterState) => {
    tableState.setActiveFilters(nextFilters);
    tableState.setSearchParams({
      status: typeof nextFilters.status === "string" ? nextFilters.status : null,
      vendor_class: typeof nextFilters.vendor_class === "string" ? nextFilters.vendor_class : null,
      payment_method: typeof nextFilters.payment_method === "string" ? nextFilters.payment_method : null,
      page: "1",
    });
    tableState.setPage(1);
  };

  const handleSelectAll = (checked: boolean) => {
    tableState.setSelectedIds(
      checked ? vendors.map((v) => v.id) : [],
    );
  };

  const handleSelectRow = (id: string, checked: boolean) => {
    tableState.setSelectedIds((prev) =>
      checked ? [...prev, id] : prev.filter((i) => i !== id),
    );
  };

  return (
    <UnifiedTablePage
      header={{
        title: "Company Directory: Vendors",
        description:
          "Manage vendors, payment terms, and accounting integration across your organization",
        actions: (
          <Button className="bg-primary hover:bg-primary/90">
            <Plus />
            New Vendor
          </Button>
        ),
      }}
      tabs={tabs}
      toolbar={{
        totalItems: pagination.total,
        filteredItems: pagination.total,
        selectedCount: tableState.selectedIds.length,
        searchValue: tableState.searchInput,
        onSearchChange: tableState.setSearchInput,
        searchPlaceholder: "Search name, contact, email, city, Acumatica ID...",
        currentView: tableState.currentView,
        onViewChange: (view) => {
          tableState.setCurrentView(view);
          tableState.setSearchParams({ view });
        },
        enabledViews: ["table", "card", "list"],
        filters,
        activeFilters,
        onFilterChange: handleFilterChange,
        onClearFilters: () => handleFilterChange(EMPTY_FILTERS),
        columns: vendorColumns,
        visibleColumns: tableState.visibleColumns,
        onColumnVisibilityChange: tableState.setVisibleColumns,
      }}
      data={{
        items: vendors,
        isLoading,
        isFetching,
        error: error ?? undefined,
      }}
      table={{
        columns: tableColumns,
        getRowId: (item) => item.id,
        activeRowId: activeVendorId,
        onRowClick: (item) => tableState.setSearchParams({ detail: item.id }),
        onDelete: handleDeleteVendor,
      }}
      sidePanel={{
        sticky: false,
        content: (
          <VendorPreviewPane
            vendor={selectedVendor}
            vendors={vendors}
            onSelectVendor={(id) => tableState.setSearchParams({ detail: id })}
            onClose={() => tableState.setSearchParams({ detail: null })}
          />
        ),
      }}
      sorting={{
        sortBy: tableState.sortBy,
        sortDirection: tableState.sortDirection,
        onSortChange: (sortBy, direction) => {
          tableState.setSortBy(sortBy);
          tableState.setSortDirection(direction);
          tableState.setSearchParams({ sort: sortBy, sort_dir: direction, page: "1" });
          tableState.setPage(1);
        },
      }}
      selection={{
        selectedIds: tableState.selectedIds,
        onSelectAll: handleSelectAll,
        onSelectRow: handleSelectRow,
      }}
      emptyState={{
        title: "No vendors found",
        description: "No vendors have been added yet.",
        filteredDescription: "Try adjusting your search or filters.",
        isFiltered,
      }}
      features={{
        enableExport: false,
        enableBulkDelete: true,
      }}
      layout={{
        fullBleedTable: true,
        removeTableFrame: true,
      }}
      pagination={{
        page: tableState.page,
        totalPages: pagination.total_pages,
        perPage: tableState.perPage,
        onPageChange: (nextPage) => {
          tableState.setPage(nextPage);
          tableState.setSearchParams({ page: String(nextPage) });
        },
        onPerPageChange: (nextPerPage) => {
          const parsed = Number(nextPerPage);
          if (!Number.isFinite(parsed) || parsed <= 0) return;
          tableState.setPerPage(parsed);
          tableState.setSearchParams({ per_page: String(parsed), page: "1" });
          tableState.setPage(1);
        },
      }}
    />
  );
}
