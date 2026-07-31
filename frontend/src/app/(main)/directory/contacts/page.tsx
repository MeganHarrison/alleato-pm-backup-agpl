"use client";

import * as React from "react";
import type { ReactElement } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { formatDate, formatPhoneNumber } from "@/lib/format";
import { MoreVertical, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import { apiFetch } from "@/lib/api-client";
import { useConfirm } from "@/hooks/use-confirm";
import { getDirectoryTabs } from "@/config/directory-tabs";
import { ContactFormSheet } from "@/components/domain/contacts/ContactFormSheet";
import {
  UnifiedTablePage,
  CellBadge,
  CellLink,
  CellText,
  createInlinePatchHandler,
  editableSelectColumn,
  editableTextColumn,
  type CellColorMap,
} from "@/components/tables/unified";
import type { ColumnConfig, TableColumn } from "@/components/tables/unified";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useServerTableDefinition } from "@/features/tables/server-table";
import {
  contactColumns,
  contactsTableDefinition,
  EMPTY_CONTACT_FILTERS,
  type ContactFilterState,
  type ContactTableRow,
} from "@/features/contacts/directory-contacts-table-definition";

const CONTACT_TYPE_COLORS: CellColorMap = {
  user: "bg-primary/10 text-primary",
  employee: "bg-success/10 text-success",
  contact: "bg-muted text-muted-foreground",
};

const CONTACT_TYPE_OPTIONS = [
  { value: "contact", label: "Contact" },
  { value: "employee", label: "Employee" },
  { value: "user", label: "User" },
];

const NO_COMPANY_VALUE = "__no_company__";
type ContactEditableField = "email" | "type" | "company_id" | "phone";

interface CompanyOption {
  id: string;
  name: string;
}

function escapeCsvValue(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function buildContactTableColumns(
  onInlineEdit: (
    contact: ContactTableRow,
    field: ContactEditableField,
    value: string,
  ) => void | Promise<void>,
  companyOptions: CompanyOption[],
): TableColumn<ContactTableRow>[] {
  return [
    {
      ...contactColumns[0],
      render: (item) => (
        <CellLink
          value={item.full_name}
          href={`/directory/contacts/${item.id}`}
          className="font-medium"
        />
      ),
      sortValue: (item) => item.full_name,
      csvValue: (item) => item.full_name,
    },
    editableTextColumn(
      {
        ...contactColumns[1],
        render: (item) => <CellText value={item.email} emptyLabel="-" />,
        sortValue: (item) => item.email || "",
        csvValue: (item) => item.email || "",
      },
      {
        inputType: "email",
        getValue: (item) => item.email,
        onEdit: (item, value) => onInlineEdit(item, "email", value),
      },
    ),
    editableSelectColumn(
      {
        ...contactColumns[2],
        render: (item) => (
          <CellBadge
            value={item.type}
            colorMap={CONTACT_TYPE_COLORS}
            emptyLabel="-"
          />
        ),
        sortValue: (item) => item.type || "",
        csvValue: (item) => item.type || "",
      },
      {
        getValue: (item) => item.type || "contact",
        onEdit: (item, value) => onInlineEdit(item, "type", value),
        options: CONTACT_TYPE_OPTIONS,
        emptyLabel: "Select contact type",
      },
    ),
    editableSelectColumn(
      {
        ...contactColumns[3],
        render: (item) => <CellText value={item.company} emptyLabel="-" />,
        sortValue: (item) => item.company || "",
        csvValue: (item) => item.company || "",
      },
      {
        getValue: (item) => item.company_id || NO_COMPANY_VALUE,
        onEdit: (item, value) =>
          onInlineEdit(
            item,
            "company_id",
            value === NO_COMPANY_VALUE ? "" : value,
          ),
        emptyLabel: "Select company",
        options: (item) => {
          const options = [
            { value: NO_COMPANY_VALUE, label: "No company" },
            ...companyOptions.map((company) => ({
              value: company.id,
              label: company.name,
            })),
          ];
          const currentOptionMissing =
            item.company_id &&
            item.company &&
            !options.some((option) => option.value === item.company_id);
          const resolvedOptions = currentOptionMissing
            ? [
                ...options,
                { value: item.company_id || "", label: item.company || "" },
              ]
            : options;

          return resolvedOptions;
        },
      },
    ),
    editableTextColumn(
      {
        ...contactColumns[4],
        render: (item) => <CellText value={formatPhoneNumber(item.phone)} emptyLabel="-" />,
        sortValue: (item) => item.phone || "",
        csvValue: (item) => formatPhoneNumber(item.phone),
      },
      {
        inputType: "tel",
        getValue: (item) => item.phone,
        onEdit: (item, value) => onInlineEdit(item, "phone", value),
      },
    ),
    {
      ...contactColumns[5],
      render: (item) =>
        item.is_admin ? <Badge variant="default">Admin</Badge> : null,
      sortValue: (item) => (item.is_admin ? 1 : 0),
      csvValue: (item) => (item.is_admin ? "Admin" : "Standard"),
    },
    {
      ...contactColumns[6],
      render: (item) => <span>{formatDate(item.created_at)}</span>,
      sortValue: (item) =>
        item.created_at ? new Date(item.created_at).getTime() : 0,
      csvValue: (item) => formatDate(item.created_at),
    },
  ];
}

export default function DirectoryContactsPage(): ReactElement {
  const pathname = usePathname()! ?? "";
  const router = useRouter();
  const searchParams = (useSearchParams() ??
    new URLSearchParams()) as NonNullable<ReturnType<typeof useSearchParams>>;
  const { confirm, ConfirmDialog } = useConfirm();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [companyOptions, setCompanyOptions] = React.useState<CompanyOption[]>(
    [],
  );

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
  } = useServerTableDefinition<ContactTableRow, ContactFilterState>({
    definition: contactsTableDefinition,
    searchParams,
    pathname,
    router,
  });

  const uniqueTypes = React.useMemo(
    () =>
      Array.from(
        new Set(tableData.map((contact) => contact.type).filter(Boolean)),
      ),
    [tableData],
  );

  const tabs = getDirectoryTabs(pathname);

  React.useEffect(() => {
    let cancelled = false;

    void apiFetch<CompanyOption[]>("/api/companies")
      .then((companies) => {
        if (cancelled) return;
        setCompanyOptions(
          companies
            .filter((company) => company.id && company.name)
            .map((company) => ({ id: company.id, name: company.name })),
        );
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const message =
          error instanceof Error
            ? error.message
            : "Failed to load company options.";
        toast.error(message);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleInlineContactEdit = React.useCallback(
    createInlinePatchHandler<ContactTableRow, ContactEditableField>({
      update: async (contact, patch) => {
        await apiFetch(`/api/directory/contacts/${contact.id}`, {
          method: "PATCH",
          body: JSON.stringify(patch),
        });
        await refresh();
      },
    }),
    [refresh],
  );

  const tableColumns = React.useMemo(
    () => buildContactTableColumns(handleInlineContactEdit, companyOptions),
    [companyOptions, handleInlineContactEdit],
  );

  const deleteContacts = React.useCallback(
    async (ids: string[]): Promise<boolean> => {
      if (ids.length === 0) return true;

      const supabase = createClient();

      const { error: unlinkError } = await supabase
        .from("users_auth")
        .delete()
        .in("person_id", ids);
      if (unlinkError) {
        toast.error(unlinkError.message || "Failed to remove user links.");
        return false;
      }

      const { error: deleteError } = await supabase
        .from("people")
        .delete()
        .in("id", ids);
      if (deleteError) {
        toast.error(deleteError.message || "Failed to delete contact.");
        return false;
      }

      return true;
    },
    [],
  );

  const handleDeleteContact = async (contact: ContactTableRow) => {
    const confirmed = await confirm({
      description: `Delete ${contact.full_name}? This cannot be undone.`,
      variant: "destructive",
      confirmLabel: "Delete",
    });
    if (!confirmed) return;

    const deleted = await deleteContacts([contact.id]);
    if (!deleted) return;
    toast.success("Contact deleted.");
    tableState.setSelectedIds((prev) => prev.filter((id) => id !== contact.id));
    await refresh();
  };

  const handleBulkDelete = async () => {
    const selectedIds = tableState.selectedIds;
    if (selectedIds.length === 0) return;

    const confirmed = await confirm({
      description: `Delete ${selectedIds.length} selected contact(s)? This cannot be undone.`,
      variant: "destructive",
      confirmLabel: "Delete",
    });
    if (!confirmed) return;

    const deleted = await deleteContacts(selectedIds);
    if (!deleted) return;
    toast.success(`${selectedIds.length} contact(s) deleted.`);
    tableState.setSelectedIds([]);
    await refresh();
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      tableState.setSelectedIds(tableData.map((contact) => contact.id));
      return;
    }
    tableState.setSelectedIds([]);
  };

  const handleSelectRow = (id: string, checked: boolean) => {
    if (checked) {
      tableState.setSelectedIds((prev) => [...new Set([...prev, id])]);
      return;
    }
    tableState.setSelectedIds((prev) => prev.filter((itemId) => itemId !== id));
  };

  const handleExport = () => {
    const rowsToExport = tableData;
    if (rowsToExport.length === 0) {
      toast.info("No contacts to export.");
      return;
    }

    const visibleColumns = tableColumns.filter((column) =>
      tableState.visibleColumns.includes(column.id),
    );

    const headers = visibleColumns.map((column) =>
      escapeCsvValue(column.label),
    );
    const rows = rowsToExport.map((item) =>
      visibleColumns
        .map((column) => {
          const value = column.csvValue
            ? column.csvValue(item)
            : String(column.sortValue?.(item) ?? "");
          return escapeCsvValue(value);
        })
        .join(","),
    );

    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "directory-contacts.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const renderRowActions = (contact: ContactTableRow) => {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreVertical />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            className="text-destructive"
            onClick={() => void handleDeleteContact(contact)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete Contact
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  return (
    <>
      <UnifiedTablePage
        header={{
          title: "Contacts",
          description:
            "Manage companies, clients, contacts, users, and employees across your organization",
          actions: (
            <Button
              onClick={() => setDialogOpen(true)}
              className="bg-primary hover:bg-primary/90"
            >
              <Plus />
              New Contact
            </Button>
          ),
        }}
        tabs={tabs}
        toolbar={{
          totalItems,
          filteredItems: tableData.length,
          selectedCount: tableState.selectedIds.length,
          searchValue: tableState.searchInput,
          onSearchChange: tableState.setSearchInput,
          searchPlaceholder: contactsTableDefinition.searchPlaceholder,
          currentView: tableState.currentView,
          onViewChange: handleViewChange,
          enabledViews: contactsTableDefinition.allowedViews,
          filters: [
            {
              id: "type",
              label: "Type",
              type: "select",
              options: uniqueTypes.map((type) => ({
                value: type,
                label: type,
              })),
            },
            {
              id: "is_admin",
              label: "Admin Access",
              type: "select",
              options: [
                { value: "true", label: "Admin" },
                { value: "false", label: "Standard" },
              ],
            },
          ],
          activeFilters,
          onFilterChange: (filters) =>
            handleFilterChange(filters as ContactFilterState),
          onClearFilters: () => handleFilterChange(EMPTY_CONTACT_FILTERS),
          columns: contactColumns,
          visibleColumns: tableState.visibleColumns,
          onColumnVisibilityChange: tableState.setVisibleColumns,
          savedViewsScope: contactsTableDefinition.entityKey,
          savedViewsDefaults: {
            visibleColumns: contactsTableDefinition.defaultVisibleColumns,
            columnOrder: contactColumns.map((column) => column.id),
            columnWidths: {},
            sortBy: contactsTableDefinition.defaultSortBy,
            sortDirection: contactsTableDefinition.defaultSortDirection,
            filters: contactsTableDefinition.defaultFilters,
          },
          onExport: handleExport,
          onBulkDelete: handleBulkDelete,
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
          rowActions: renderRowActions,
        }}
        sorting={{
          sortBy: tableState.sortBy,
          sortDirection: tableState.sortDirection,
          onSortChange: handleSortChange,
        }}
        selection={{
          selectedIds: tableState.selectedIds,
          onSelectAll: handleSelectAll,
          onSelectRow: handleSelectRow,
        }}
        emptyState={{
          title: "No contacts found",
          description: "No contacts are available yet.",
          filteredDescription: "Try adjusting your search or filters.",
          isFiltered,
          action: (
            <Button
              onClick={() => setDialogOpen(true)}
              className="bg-primary hover:bg-primary/90"
            >
              <Plus />
              Add Contact
            </Button>
          ),
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
          enableExport: true,
          enableBulkDelete: true,
          enableRowSelection: true,
          enableRowActions: true,
          enableInlineEditing: true,
        }}
        layout={{
          fullBleedTable: true,
          removeTableFrame: true,
        }}
      />

      <ContactFormSheet
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={() => {
          void refresh();
        }}
      />
      {ConfirmDialog}
    </>
  );
}
