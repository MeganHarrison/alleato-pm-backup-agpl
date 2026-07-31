"use client";

import Link from "next/link";

import {
  CellDate,
  CellStatus,
  type ColumnConfig,
  type TableColumn,
} from "@/components/tables/unified";
import type { AdminDailyBriefHistoryItem } from "@/lib/daily-briefs/admin-history";

export const adminDailyBriefColumns: ColumnConfig[] = [
  { id: "businessDate", label: "Brief date", alwaysVisible: true },
  { id: "packetType", label: "Packet", defaultVisible: true },
  { id: "rag", label: "RAG sources", defaultVisible: true },
  { id: "briefFormat", label: "Brief format", defaultVisible: true },
  { id: "compilerVersion", label: "Compiler", defaultVisible: true },
  { id: "generatedAt", label: "Generated", defaultVisible: false },
];

export const adminDailyBriefDefaultVisibleColumns = adminDailyBriefColumns
  .filter((column) => column.defaultVisible || column.alwaysVisible)
  .map((column) => column.id);

function ragStatus(item: AdminDailyBriefHistoryItem) {
  if (item.sourceCount === 0) return "No sources";
  if (item.missingSourceCount > 0) return "Needs review";
  if (item.terminalSourceCount > 0) return "Limited";
  return "Ready";
}

export function buildAdminDailyBriefTableColumns(): TableColumn<AdminDailyBriefHistoryItem>[] {
  return [
    {
      id: "businessDate",
      label: "Brief date",
      alwaysVisible: true,
      sortable: true,
      sortValue: (item) => item.businessDate,
      render: (item) => (
        <Link
          href={`/admin/daily-briefs/${item.id}`}
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          {item.businessDate}
        </Link>
      ),
      csvValue: (item) => item.businessDate,
      width: 150,
    },
    {
      id: "packetType",
      label: "Packet",
      defaultVisible: true,
      sortable: true,
      sortValue: (item) => item.packetType,
      render: (item) => <CellStatus value={item.packetType} />,
      csvValue: (item) => item.packetType,
      width: 130,
    },
    {
      id: "rag",
      label: "RAG sources",
      defaultVisible: true,
      sortable: true,
      sortValue: (item) => item.missingSourceCount * -1 + item.embeddedSourceCount,
      render: (item) => (
        <span className="whitespace-nowrap text-sm tabular-nums text-foreground">
          {item.embeddedSourceCount}/{item.sourceCount} embedded · {ragStatus(item)}
        </span>
      ),
      csvValue: (item) => `${item.embeddedSourceCount}/${item.sourceCount} embedded; ${ragStatus(item)}`,
      width: 180,
    },
    {
      id: "briefFormat",
      label: "Brief format",
      defaultVisible: true,
      sortable: true,
      sortValue: (item) => item.briefFormat,
      render: (item) => <span className="text-sm capitalize text-muted-foreground">{item.briefFormat}</span>,
      csvValue: (item) => item.briefFormat,
      width: 130,
    },
    {
      id: "compilerVersion",
      label: "Compiler",
      defaultVisible: true,
      sortable: true,
      sortValue: (item) => item.compilerVersion ?? "",
      render: (item) => <span className="text-sm text-muted-foreground">{item.compilerVersion ?? "Unknown"}</span>,
      csvValue: (item) => item.compilerVersion ?? "",
      width: 180,
    },
    {
      id: "generatedAt",
      label: "Generated",
      defaultVisible: false,
      sortable: true,
      sortValue: (item) => item.generatedAt ?? "",
      render: (item) => <CellDate value={item.generatedAt} />,
      csvValue: (item) => item.generatedAt ?? "",
      width: 160,
    },
  ];
}
