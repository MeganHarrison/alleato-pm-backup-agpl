"use client";

import * as React from "react";
import type { ReactElement } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Mail,
  Phone,
  Plus,
  User,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { apiFetch } from "@/lib/api-client";
import { getDirectoryTabs } from "@/config/directory-tabs";
import { formatPhoneNumber } from "@/lib/format";
import {
  UnifiedTablePage,
  CellBadge,
  CellEmail,
  CellLink,
  CellText,
  InlineSelectEditor,
  TableDateValue,
  type CellColorMap,
} from "@/components/tables/unified";
import type { ColumnConfig, TableColumn } from "@/components/tables/unified";
import { Button } from "@/components/ui/button";
import { DetailField } from "@/components/ds";
import { InviteAppUserDialog } from "@/components/domain/permissions/invite-app-user-dialog";
import { useCurrentUserProfile } from "@/hooks/use-current-user-profile";
import { useServerTableDefinition } from "@/features/tables/server-table";
import {
  ALLEATO_COMPANY,
  EMPTY_EMPLOYEE_FILTERS,
  employeeColumns,
  employeesTableDefinition,
  type EmployeeFilterState,
  type EmployeeRow,
} from "@/features/employees/directory-employees-table-definition";

const STATUS_COLORS: CellColorMap = {
  active: "bg-success/10 text-success",
  inactive: "bg-muted text-muted-foreground",
};

const ACCESS_STATUS_COLORS: CellColorMap = {
  active: "bg-success/10 text-success",
  invited: "bg-warning/10 text-warning",
};

const EMPLOYEE_STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

const EMPLOYEE_TYPE_OPTIONS = [
  { value: "employee", label: "Employee" },
  { value: "user", label: "User" },
  { value: "contact", label: "Contact" },
];

function buildEmployeeTableColumns(
  onInlineEdit: (employee: EmployeeRow, field: string, value: string) => Promise<void>,
): TableColumn<EmployeeRow>[] {
  return [
    {
      ...employeeColumns[0],
      render: (item) => (
        <CellLink
          value={item.full_name}
          href={`/directory/employees?detail=${item.id}`}
          className="font-medium"
        />
      ),
      sortValue: (item) => item.full_name,
    },
    {
      ...employeeColumns[1],
      render: (item) => <CellText value={item.job_title} emptyLabel="-" />,
      sortValue: (item) => item.job_title || "",
      editable: true,
      editValue: (item) => item.job_title || "",
      onEdit: (item, value) => onInlineEdit(item, "job_title", value),
    },
    {
      ...employeeColumns[2],
      render: (item) => <CellText value={item.business_unit} emptyLabel="-" />,
      sortValue: (item) => item.business_unit || "",
      editable: true,
      editValue: (item) => item.business_unit || "",
      onEdit: (item, value) => onInlineEdit(item, "business_unit", value),
    },
    {
      ...employeeColumns[3],
      render: (item) => <CellText value={item.email} emptyLabel="-" />,
      sortValue: (item) => item.email || "",
      editable: true,
      editInputType: "email",
      editValue: (item) => item.email || "",
      onEdit: (item, value) => onInlineEdit(item, "email", value),
    },
    {
      ...employeeColumns[4],
      render: (item) => <CellText value={formatPhoneNumber(item.phone)} emptyLabel="-" />,
      sortValue: (item) => item.phone || "",
      editable: true,
      editInputType: "tel",
      editValue: (item) => item.phone || "",
      onEdit: (item, value) => onInlineEdit(item, "phone", value),
    },
    {
      ...employeeColumns[5],
      render: (item) => <CellBadge value={item.status} colorMap={STATUS_COLORS} emptyLabel="-" />,
      sortValue: (item) => item.status || "",
      editable: true,
      editValue: (item) => item.status || "active",
      onEdit: (item, value) => onInlineEdit(item, "status", value),
      renderEditor: ({ value, onChange, onCommit }) => (
        <InlineSelectEditor
          value={value || "active"}
          options={EMPLOYEE_STATUS_OPTIONS}
          placeholder="Select status"
          onChange={onChange}
          onCommit={onCommit}
        />
      ),
    },
    {
      ...employeeColumns[6],
      render: (item) => <CellText value={item.person_type} emptyLabel="-" />,
      sortValue: (item) => item.person_type || "",
      editable: true,
      editValue: (item) => item.person_type || "employee",
      onEdit: (item, value) => onInlineEdit(item, "type", value),
      renderEditor: ({ value, onChange, onCommit }) => (
        <InlineSelectEditor
          value={value || "employee"}
          options={EMPLOYEE_TYPE_OPTIONS}
          placeholder="Select employee type"
          onChange={onChange}
          onCommit={onCommit}
        />
      ),
    },
    {
      ...employeeColumns[7],
      render: (item) => <TableDateValue value={item.created_at} emptyLabel="-" />,
      sortValue: (item) => (item.created_at ? new Date(item.created_at).getTime() : 0),
    },
    {
      ...employeeColumns[8],
      render: (item) =>
        item.access_status ? (
          <CellBadge value={item.access_status} colorMap={ACCESS_STATUS_COLORS} />
        ) : null,
      sortValue: (item) => item.access_status ?? "",
    },
  ];
}

function EmployeePreviewPane({
  employee,
  employees,
  onSelectEmployee,
  onClose,
  canInvite,
  resendingId,
  onResendInvite,
}: {
  employee: EmployeeRow | null;
  employees: EmployeeRow[];
  onSelectEmployee: (id: string) => void;
  onClose: () => void;
  canInvite: boolean;
  resendingId: string | null;
  onResendInvite: (employee: EmployeeRow) => void;
}): ReactElement {
  const currentIndex = employee ? employees.findIndex((e) => e.id === employee.id) : -1;
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < employees.length - 1;

  if (!employee) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        <p>Select an employee to preview details.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between gap-1 px-4 h-11">
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            className="h-5 w-5"
            disabled={!hasPrev}
            onClick={() => hasPrev && onSelectEmployee(employees[currentIndex - 1].id)}
            aria-label="Previous employee"
          >
            <ChevronLeft />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-5 w-5"
            disabled={!hasNext}
            onClick={() => hasNext && onSelectEmployee(employees[currentIndex + 1].id)}
            aria-label="Next employee"
          >
            <ChevronRight />
          </Button>
          <span className="text-xs text-muted-foreground ml-1">
            {currentIndex + 1} of {employees.length}
          </span>
        </div>
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

      <div className="flex-1 overflow-y-auto">
        <div className="px-5 pt-5 pb-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <User className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              {/* eslint-disable-next-line design-system/no-raw-heading */}
              <h3 className="text-sm font-semibold leading-tight truncate">{employee.full_name}</h3>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                {employee.job_title && (
                  <span className="text-xs text-muted-foreground">{employee.job_title}</span>
                )}
                {employee.status && (
                  <CellBadge value={employee.status} colorMap={STATUS_COLORS} />
                )}
                {employee.access_status && (
                  <CellBadge
                    value={employee.access_status}
                    colorMap={ACCESS_STATUS_COLORS}
                  />
                )}
              </div>
            </div>
          </div>
        </div>

        {employee.business_unit && (
          <div className="px-5 pb-4">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-2">
              Business Unit
            </p>
            <p className="text-sm">{employee.business_unit}</p>
          </div>
        )}

        {(employee.email || employee.phone) && (
          <div className="px-5 pb-4">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-2">
              Contact
            </p>
            <div className="space-y-2">
              {employee.email && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <CellEmail value={employee.email} />
                </div>
              )}
              {employee.phone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <CellText value={formatPhoneNumber(employee.phone)} />
                </div>
              )}
            </div>
          </div>
        )}

        {employee.created_at && (
          <div className="px-5 pb-5">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-2">
              Details
            </p>
            <DetailField
              label="Added"
              value={<TableDateValue value={employee.created_at} />}
            />
          </div>
        )}

        {canInvite && employee.access_status === "invited" && (
          <div className="px-5 pb-5">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-2">
              App access
            </p>
            <p className="text-sm text-muted-foreground mb-3">
              Invited but hasn&apos;t logged in yet. Resend the invite email so
              they can set a password and sign in.
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onResendInvite(employee)}
              disabled={resendingId === employee.id}
            >
              <Mail className="h-4 w-4" />
              {resendingId === employee.id ? "Sending…" : "Resend invite"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function DirectoryEmployeesPage(): ReactElement {
  const pathname = usePathname()! ?? "";
  const router = useRouter();
  const searchParams = (useSearchParams() ?? new URLSearchParams()) as NonNullable<ReturnType<typeof useSearchParams>>;

  const { profile } = useCurrentUserProfile();
  const canInvite = profile?.isAdmin === true;
  const [showInvite, setShowInvite] = React.useState(false);
  const [resendingId, setResendingId] = React.useState<string | null>(null);

  const {
    tableState,
    items: tableData,
    totalItems,
    totalPages,
    isLoading,
    isFetching,
    error,
    activeFilters,
    isFiltered,
    refresh,
    handleViewChange,
    handleFilterChange,
    handleSortChange,
    handlePageChange,
    handlePerPageChange,
  } = useServerTableDefinition<EmployeeRow, EmployeeFilterState>({
    definition: employeesTableDefinition,
    searchParams,
    pathname,
    router,
  });

  const uniqueBusinessUnits = React.useMemo(
    () => Array.from(new Set(tableData.map((employee) => employee.business_unit).filter(Boolean))),
    [tableData],
  );

  const selectedEmployeeId = searchParams.get("detail");
  const selectedEmployee = selectedEmployeeId
    ? tableData.find((e) => e.id === selectedEmployeeId) ?? null
    : null;

  const tabs = getDirectoryTabs(pathname);
  const handleInlineEmployeeEdit = React.useCallback(
    async (employee: EmployeeRow, field: string, value: string) => {
      await apiFetch(`/api/directory/employees/${employee.id}`, {
        method: "PATCH",
        body: JSON.stringify({ [field]: value || null }),
      });
      await refresh();
    },
    [refresh],
  );

  const tableColumns = React.useMemo(
    () => buildEmployeeTableColumns(handleInlineEmployeeEdit),
    [handleInlineEmployeeEdit],
  );

  const handleResendInvite = React.useCallback(
    async (employee: EmployeeRow) => {
      setResendingId(employee.id);
      try {
        await apiFetch(`/api/directory/employees/${employee.id}/resend-invite`, {
          method: "POST",
        });
        toast.success(`Invite sent to ${employee.full_name}`);
        await refresh();
      } catch {
        toast.error("Could not resend the invite");
      } finally {
        setResendingId(null);
      }
    },
    [refresh],
  );

  return (
    <>
    <UnifiedTablePage
      header={{
        title: "Employees",
        description: "Alleato Group employees",
        actions: canInvite ? (
          <Button
            className="bg-primary hover:bg-primary/90"
            onClick={() => setShowInvite(true)}
          >
            <Plus />
            New Employee
          </Button>
        ) : undefined,
      }}
      tabs={tabs}
      toolbar={{
        totalItems,
        filteredItems: tableData.length,
        searchValue: tableState.searchInput,
        onSearchChange: tableState.setSearchInput,
        searchPlaceholder: employeesTableDefinition.searchPlaceholder,
        currentView: tableState.currentView,
        onViewChange: handleViewChange,
        enabledViews: employeesTableDefinition.allowedViews,
        filters: [
          {
            id: "status",
            label: "Status",
            type: "select",
            options: [
              { value: "active", label: "Active" },
              { value: "inactive", label: "Inactive" },
            ],
          },
          ...(uniqueBusinessUnits.length > 0
            ? [
                {
                  id: "business_unit",
                  label: "Business Unit",
                  type: "select" as const,
                  options: uniqueBusinessUnits.map((unit) => ({ value: unit, label: unit })),
                },
              ]
            : []),
        ],
        activeFilters,
        onFilterChange: (filters) => handleFilterChange(filters as EmployeeFilterState),
        onClearFilters: () => handleFilterChange(EMPTY_EMPLOYEE_FILTERS),
        columns: employeeColumns,
        visibleColumns: tableState.visibleColumns,
        onColumnVisibilityChange: tableState.setVisibleColumns,
        savedViewsScope: employeesTableDefinition.entityKey,
        savedViewsDefaults: {
          visibleColumns: employeesTableDefinition.defaultVisibleColumns,
          columnOrder: employeeColumns.map((column) => column.id),
          columnWidths: {},
          sortBy: employeesTableDefinition.defaultSortBy,
          sortDirection: employeesTableDefinition.defaultSortDirection,
          filters: employeesTableDefinition.defaultFilters,
        },
      }}
      data={{
        items: tableData,
        isLoading,
        isFetching,
        error: error ?? undefined,
      }}
      table={{
        columns: tableColumns,
        getRowId: (item) => item.id,
        activeRowId: selectedEmployee?.id ?? null,
        onRowClick: (item) => tableState.setSearchParams({ detail: item.id }),
      }}
      sidePanel={{
        content: (
          <EmployeePreviewPane
            employee={selectedEmployee}
            employees={tableData}
            onSelectEmployee={(id) => tableState.setSearchParams({ detail: id })}
            onClose={() => tableState.setSearchParams({ detail: null })}
            canInvite={canInvite}
            resendingId={resendingId}
            onResendInvite={handleResendInvite}
          />
        ),
      }}
      sorting={{
        sortBy: tableState.sortBy,
        sortDirection: tableState.sortDirection,
        onSortChange: handleSortChange,
      }}
      emptyState={{
        title: "No employees found",
        description: `No people with company set to "${ALLEATO_COMPANY}".`,
        filteredDescription: "Try adjusting your search or filters.",
        isFiltered,
      }}
      pagination={{
        page: tableState.page,
        totalPages,
        perPage: tableState.perPage,
        clientSide: false,
        onPageChange: handlePageChange,
        onPerPageChange: handlePerPageChange,
      }}
      features={{
        enableExport: false,
        enableBulkDelete: false,
        enableInlineEditing: true,
      }}
      layout={{
        fullBleedTable: true,
        removeTableFrame: true,
      }}
    />
    {canInvite ? (
      <InviteAppUserDialog
        open={showInvite}
        onOpenChange={setShowInvite}
        onInvited={() => void refresh()}
        peopleScope="alleato-employees"
      />
    ) : null}
    </>
  );
}
