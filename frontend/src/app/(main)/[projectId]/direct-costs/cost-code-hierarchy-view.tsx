"use client";

import * as React from "react";
import type { ReactElement } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { UnifiedTablePage, type ViewMode } from "@/components/tables/unified";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  COST_CODE_COLUMNS,
  type CostCodeDetailRow,
  formatAmount,
  formatDate,
  getStatusVariant,
} from "./direct-costs-table-utils";

type TabItem = {
  label: string;
  href: string;
  count?: number;
  isActive?: boolean;
};

type HierarchyRow = {
  id: string;
  rowType: "group" | "detail";
  groupId?: string;
  parentGroupIds: string[];
  level: number;
  label: string;
  detail?: CostCodeDetailRow;
};

interface CostCodeHierarchyViewProps {
  projectName: string;
  tabs: TabItem[];
  costCodeDetails: CostCodeDetailRow[];
  searchValue: string;
  onSearchChange: (value: string) => void;
  currentView: ViewMode;
  onViewChange: (view: ViewMode) => void;
  visibleColumns: string[];
  onColumnVisibilityChange: (columns: string[]) => void;
  onView: (costId: string) => void;
}

export function CostCodeHierarchyView({
  projectName,
  tabs,
  costCodeDetails,
  searchValue,
  onSearchChange,
  currentView,
  onViewChange,
  visibleColumns,
  onColumnVisibilityChange,
  onView,
}: CostCodeHierarchyViewProps): ReactElement {
  const [expandedGroups, setExpandedGroups] = React.useState<Set<string>>(new Set());

  const filteredCostCodeItems = React.useMemo(() => {
    const normalizedSearch = searchValue.trim().toLowerCase();
    if (!normalizedSearch) return costCodeDetails;

    return costCodeDetails.filter((item) => {
      const budgetCode = item.budget_code?.toLowerCase() ?? "";
      const division = item.division_label?.toLowerCase() ?? "";
      const description = item.budget_description?.toLowerCase() ?? "";
      const vendorName = item.vendor_name.toLowerCase();
      const invoiceNumber = (item.invoice_number ?? "").toLowerCase();
      return (
        budgetCode.includes(normalizedSearch) ||
        division.includes(normalizedSearch) ||
        description.includes(normalizedSearch) ||
        vendorName.includes(normalizedSearch) ||
        invoiceNumber.includes(normalizedSearch)
      );
    });
  }, [costCodeDetails, searchValue]);

  const hierarchyRows = React.useMemo<HierarchyRow[]>(() => {
    if (filteredCostCodeItems.length === 0) return [];

    const sortedItems = [...filteredCostCodeItems].sort((a, b) => {
      const divisionCompare = a.division_label.localeCompare(b.division_label);
      if (divisionCompare !== 0) return divisionCompare;

      const budgetCompare = a.budget_code.localeCompare(b.budget_code);
      if (budgetCompare !== 0) return budgetCompare;

      const typeCompare = a.cost_type.localeCompare(b.cost_type);
      if (typeCompare !== 0) return typeCompare;

      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });

    const rows: HierarchyRow[] = [];
    const seenGroups = new Set<string>();
    const projectGroupId = `project:${projectName}`;

    const addGroup = (
      groupId: string,
      parentGroupIds: string[],
      level: number,
      label: string,
    ): void => {
      if (seenGroups.has(groupId)) return;
      seenGroups.add(groupId);
      rows.push({
        id: `group:${groupId}`,
        rowType: "group",
        groupId,
        parentGroupIds,
        level,
        label,
      });
    };

    addGroup(projectGroupId, [], 0, projectName);

    sortedItems.forEach((item) => {
      const divisionGroupId = `${projectGroupId}|division:${item.division_label}`;
      const costCodeGroupId = `${divisionGroupId}|code:${item.budget_code}`;
      const typeGroupId = `${costCodeGroupId}|type:${item.cost_type}`;

      addGroup(divisionGroupId, [projectGroupId], 1, item.division_label || "Uncategorized");
      addGroup(costCodeGroupId, [projectGroupId, divisionGroupId], 2, item.budget_code || "Unassigned Code");
      addGroup(typeGroupId, [projectGroupId, divisionGroupId, costCodeGroupId], 3, item.cost_type || "Uncategorized Type");

      rows.push({
        id: `detail:${item.id}`,
        rowType: "detail",
        parentGroupIds: [projectGroupId, divisionGroupId, costCodeGroupId, typeGroupId],
        level: 4,
        label: item.budget_description || "",
        detail: item,
      });
    });

    return rows;
  }, [filteredCostCodeItems, projectName]);

  React.useEffect(() => {
    const allGroupIds = hierarchyRows
      .filter((row) => row.rowType === "group" && row.groupId)
      .map((row) => row.groupId as string);

    setExpandedGroups((prev) => {
      if (allGroupIds.length === 0) return new Set<string>();
      if (prev.size === 0) return new Set(allGroupIds);

      const next = new Set<string>();
      allGroupIds.forEach((id) => {
        if (prev.has(id)) next.add(id);
      });

      return next.size > 0 ? next : new Set(allGroupIds);
    });
  }, [hierarchyRows]);

  const visibleHierarchyRows = React.useMemo(() => {
    return hierarchyRows.filter((row) => row.parentGroupIds.every((groupId) => expandedGroups.has(groupId)));
  }, [expandedGroups, hierarchyRows]);

  const costCodeTableColumns = React.useMemo(
    () => [
      {
        id: "group",
        label: "",
        defaultVisible: true,
        render: (row: HierarchyRow) => {
          const paddingLeft = `${row.level * 18}px`;

          if (row.rowType === "group") {
            const groupId = row.groupId;
            const isExpanded = groupId ? expandedGroups.has(groupId) : false;

            return (
              <Button
                type="button"
                variant="ghost"
                onClick={(event) => {
                  event.stopPropagation();
                  if (!groupId) return;
                  setExpandedGroups((prev) => {
                    const next = new Set(prev);
                    if (next.has(groupId)) {
                      next.delete(groupId);
                    } else {
                      next.add(groupId);
                    }
                    return next;
                  });
                }}
                className="flex items-center gap-2 text-left font-semibold h-auto p-0"
                style={{ paddingLeft }}
              >
                {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                <span>{row.label}</span>
              </Button>
            );
          }

          const detail = row.detail;
          if (!detail) {
            return <div style={{ paddingLeft }}>{row.label || "-"}</div>;
          }

          return (
            <div style={{ paddingLeft }} className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 px-2"
                onClick={(event) => {
                  event.stopPropagation();
                  onView(detail.direct_cost_id);
                }}
              >
                View
              </Button>
              <span>{row.label || "-"}</span>
            </div>
          );
        },
      },
      { id: "date", label: "Date", defaultVisible: true, render: (row: HierarchyRow) => (row.detail ? formatDate(row.detail.date) : "") },
      { id: "employee_name", label: "Employee", defaultVisible: true, render: (row: HierarchyRow) => (row.detail ? (row.detail.employee_name ?? "-") : "") },
      { id: "vendor_name", label: "Vendor", defaultVisible: true, render: (row: HierarchyRow) => (row.detail ? row.detail.vendor_name : "") },
      { id: "cost_type", label: "Type", defaultVisible: true, render: (row: HierarchyRow) => (row.detail ? row.detail.cost_type : "") },
      { id: "invoice_number", label: "Invoice #", defaultVisible: true, render: (row: HierarchyRow) => (row.detail ? (row.detail.invoice_number ?? "-") : "") },
      { id: "status", label: "Status", defaultVisible: true, render: (row: HierarchyRow) => (row.detail ? <Badge variant={getStatusVariant(row.detail.status)}>{row.detail.status}</Badge> : "") },
      { id: "description", label: "Description", defaultVisible: true, render: (row: HierarchyRow) => (row.detail ? (row.detail.description ?? "-") : "") },
      { id: "amount", label: "Amount", defaultVisible: true, render: (row: HierarchyRow) => (row.detail ? formatAmount(row.detail.amount) : "") },
      { id: "received_date", label: "Received", defaultVisible: true, render: (row: HierarchyRow) => (row.detail ? formatDate(row.detail.received_date) : "") },
    ],
    [expandedGroups],
  );

  return (
    <UnifiedTablePage
      header={{
        title: "Direct Costs",
        description: "Track and manage direct project costs",
      }}
      tabs={tabs}
      toolbar={{
        totalItems: costCodeDetails.length,
        filteredItems: visibleHierarchyRows.filter((row) => row.rowType === "detail").length,
        selectedCount: 0,
        searchValue,
        onSearchChange,
        searchPlaceholder: "Search cost codes...",
        currentView,
        onViewChange,
        enabledViews: ["table"],
        activeFilters: {},
        onFilterChange: () => undefined,
        onClearFilters: () => undefined,
        columns: COST_CODE_COLUMNS,
        visibleColumns,
        onColumnVisibilityChange,
      }}
      data={{ items: visibleHierarchyRows, isLoading: false, isFetching: false }}
      table={{
        columns: costCodeTableColumns,
        getRowId: (item) => item.id,
        onRowClick: (item) => {
          if (item.rowType === "detail" && item.detail) {
            onView(item.detail.direct_cost_id);
          }
        },
      }}
      emptyState={{
        title: "No cost code summary found",
        description: "No direct costs have been grouped by cost code yet.",
        filteredDescription: "Try adjusting your search.",
        isFiltered: Boolean(searchValue),
      }}
      features={{
        enableFilters: false,
        enableBulkDelete: false,
        enableRowSelection: false,
        enableRowActions: false,
        enableViews: false,
        enableExport: false,
      }}
    />
  );
}
