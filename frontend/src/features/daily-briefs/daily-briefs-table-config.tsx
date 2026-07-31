"use client";

import Link from "next/link";

import {
  CellDate,
  CellStatus,
  type ColumnConfig,
  type FilterConfig,
  type TableColumn,
} from "@/components/tables/unified";
import type { DailyBriefHistoryItem } from "@/lib/daily-briefs/types";

export const dailyBriefColumns: ColumnConfig[] = [
  { id: "recapDate", label: "Brief Date", alwaysVisible: true },
  { id: "workflowStatus", label: "Status", defaultVisible: true },
  { id: "items", label: "Items", defaultVisible: true },
  { id: "sourceCoverage", label: "Sources", defaultVisible: true },
  { id: "modelUsed", label: "Model", defaultVisible: false },
  { id: "createdAt", label: "Created", defaultVisible: false },
];

export const dailyBriefDefaultVisibleColumns = dailyBriefColumns
  .filter((column) => column.defaultVisible || column.alwaysVisible)
  .map((column) => column.id);

export const dailyBriefFilters: FilterConfig[] = [
  {
    id: "workflowStatus",
    label: "Status",
    type: "select",
    options: [
      { value: "current", label: "Current" },
      { value: "snapshot", label: "Snapshot" },
    ],
  },
];

function formatDateForExport(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString();
}

function SourceCoverageCell({ item }: { item: DailyBriefHistoryItem }) {
  return (
    <span className="text-sm text-muted-foreground">
      {item.sourceCoverageCount} source{item.sourceCoverageCount === 1 ? "" : "s"}
    </span>
  );
}

export function buildDailyBriefTableColumns(): TableColumn<DailyBriefHistoryItem>[] {
  return [
    {
      id: "recapDate",
      label: "Brief Date",
      alwaysVisible: true,
      sortable: true,
      sortValue: (item) => item.recapDate,
      render: (item) => (
        <Link
          href={`/daily-briefs/${item.id}`}
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          {item.recapDate}
        </Link>
      ),
      csvValue: (item) => item.recapDate,
      width: 160,
    },
    {
      id: "workflowStatus",
      label: "Status",
      defaultVisible: true,
      sortable: true,
      sortValue: (item) => item.workflowStatus,
      render: (item) => <CellStatus value={item.workflowStatus} />,
      csvValue: (item) => item.workflowStatus,
      width: 140,
    },
    {
      id: "items",
      label: "Items",
      defaultVisible: true,
      sortable: true,
      sortValue: (item) => item.itemCounts.total,
      align: "right",
      render: (item) => (
        <span className="tabular-nums text-sm">{item.itemCounts.total}</span>
      ),
      csvValue: (item) => `${item.itemCounts.total}`,
      width: 120,
    },
    {
      id: "sourceCoverage",
      label: "Sources",
      defaultVisible: true,
      sortable: true,
      sortValue: (item) => item.sourceCoverageCount,
      render: (item) => <SourceCoverageCell item={item} />,
      csvValue: (item) => `${item.sourceCoverageCount} sources`,
      width: 140,
    },
    {
      id: "modelUsed",
      label: "Model",
      defaultVisible: false,
      sortable: true,
      sortValue: (item) => item.modelUsed,
      render: (item) => (
        <span className="text-sm text-muted-foreground">
          {item.modelUsed ?? "Unknown"}
        </span>
      ),
      csvValue: (item) => item.modelUsed ?? "",
      width: 160,
    },
    {
      id: "createdAt",
      label: "Created",
      defaultVisible: false,
      sortable: true,
      sortValue: (item) => item.createdAt,
      render: (item) => <CellDate value={item.createdAt} />,
      csvValue: (item) => formatDateForExport(item.createdAt),
      width: 160,
    },
  ];
}
