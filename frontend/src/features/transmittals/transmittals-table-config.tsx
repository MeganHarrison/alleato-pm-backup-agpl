import * as React from "react";
import type { ReactElement } from "react";

import { formatDate } from "@/lib/format";
import type {
  ColumnConfig,
  FilterConfig,
  TableColumn,
} from "@/components/tables/unified";
import { Badge } from "@/components/ui/badge";

export interface TransmittalTableRow {
  id: number;
  number: string;
  subject: string;
  status: string;
  to_company: string | null;
  from_company: string | null;
  delivery_method: string | null;
  sent_date: string | null;
  due_date: string | null;
  ball_in_court: string | null;
  is_private: boolean | null;
  deleted_at: string | null;
}

// ─── Status badge map ────────────────────────────────────────────────────────

const statusVariantMap: Record<
  string,
  "default" | "secondary" | "destructive" | "outline" | "success"
> = {
  Draft: "secondary",
  Open: "default",
  Closed: "success",
  Void: "destructive",
};

// ─── Column definitions ───────────────────────────────────────────────────────

export const transmittalColumns: ColumnConfig[] = [
  { id: "number", label: "#", alwaysVisible: true },
  { id: "subject", label: "Subject", defaultVisible: true },
  { id: "status", label: "Status", defaultVisible: true },
  { id: "to_company", label: "To Company", defaultVisible: true },
  { id: "from_company", label: "From Company", defaultVisible: true },
  { id: "delivery_method", label: "Delivery Method", defaultVisible: true },
  { id: "sent_date", label: "Sent Date", defaultVisible: true },
  { id: "due_date", label: "Due Date", defaultVisible: true },
];

export const transmittalDefaultVisibleColumns = transmittalColumns
  .filter((c) => c.defaultVisible !== false || c.alwaysVisible)
  .map((c) => c.id);

// ─── Filters ─────────────────────────────────────────────────────────────────

export const transmittalFilters: FilterConfig[] = [
  {
    id: "status",
    label: "Status",
    type: "select",
    options: ["Draft", "Open", "Closed", "Void"].map((v) => ({
      value: v,
      label: v,
    })),
  },
  {
    id: "delivery_method",
    label: "Delivery Method",
    type: "select",
    options: [
      "Email",
      "Hand Delivery",
      "Mail",
      "Courier",
      "Fax",
      "Other",
    ].map((v) => ({ value: v, label: v })),
  },
];

// ─── Table columns ────────────────────────────────────────────────────────────

export interface TransmittalInlineEditHandlers {
  /** Persists a single-field change for one transmittal. Throws on failure so the cell can revert. */
  onUpdate: (
    transmittalId: string,
    data: Record<string, unknown>,
  ) => Promise<void>;
}

const STATUS_OPTIONS = ["Draft", "Open", "Closed", "Void"].map((v) => ({
  value: v,
  label: v,
}));

const DELIVERY_METHOD_OPTIONS = [
  "Email",
  "Hand Delivery",
  "Mail",
  "Courier",
  "Fax",
  "Other",
].map((v) => ({ value: v, label: v }));

export function buildTransmittalTableColumns(
  inlineEdit?: TransmittalInlineEditHandlers,
): TableColumn<TransmittalTableRow>[] {
  const editable = Boolean(inlineEdit);
  return [
    {
      ...transmittalColumns[0],
      render: (item) => (
        <span className="font-medium">{item.number || "-"}</span>
      ),
      sortValue: (item) => item.number,
      csvValue: (item) => item.number,
    },
    {
      ...transmittalColumns[1],
      render: (item) => (
        <span className="max-w-[240px] truncate block" title={item.subject}>
          {item.subject || "Untitled"}
        </span>
      ),
      sortValue: (item) => item.subject,
      csvValue: (item) => item.subject,
      // Subject is the row's primary label / link to detail — never inline-editable.
    },
    {
      ...transmittalColumns[2],
      render: (item) => (
        <Badge variant={statusVariantMap[item.status] ?? "outline"}>
          {item.status || "-"}
        </Badge>
      ),
      sortValue: (item) => item.status,
      csvValue: (item) => item.status,
      editable,
      editType: "select",
      editValue: (item) => item.status ?? "",
      editOptions: STATUS_OPTIONS,
      editEmptyLabel: "Select status",
      onEdit: async (item, value) => {
        await inlineEdit!.onUpdate(String(item.id), { status: value });
      },
    },
    {
      ...transmittalColumns[3],
      render: (item) => <span>{item.to_company || "-"}</span>,
      sortValue: (item) => item.to_company ?? "",
      csvValue: (item) => item.to_company ?? "",
      editable,
      editType: "text",
      editValue: (item) => item.to_company ?? "",
      editEmptyLabel: "Add company",
      onEdit: async (item, value) => {
        await inlineEdit!.onUpdate(String(item.id), { to_company: value });
      },
    },
    {
      ...transmittalColumns[4],
      render: (item) => <span>{item.from_company || "-"}</span>,
      sortValue: (item) => item.from_company ?? "",
      csvValue: (item) => item.from_company ?? "",
      editable,
      editType: "text",
      editValue: (item) => item.from_company ?? "",
      editEmptyLabel: "Add company",
      onEdit: async (item, value) => {
        await inlineEdit!.onUpdate(String(item.id), { from_company: value });
      },
    },
    {
      ...transmittalColumns[5],
      render: (item) => <span>{item.delivery_method || "-"}</span>,
      sortValue: (item) => item.delivery_method ?? "",
      csvValue: (item) => item.delivery_method ?? "",
      editable,
      editType: "select",
      editValue: (item) => item.delivery_method ?? "",
      editOptions: DELIVERY_METHOD_OPTIONS,
      editEmptyLabel: "Select method",
      onEdit: async (item, value) => {
        await inlineEdit!.onUpdate(String(item.id), { delivery_method: value });
      },
    },
    {
      ...transmittalColumns[6],
      render: (item) => <span>{formatDate(item.sent_date)}</span>,
      sortValue: (item) =>
        item.sent_date ? new Date(item.sent_date).getTime() : 0,
      csvValue: (item) => item.sent_date ?? "",
      editable,
      editType: "date",
      editValue: (item) => (item.sent_date ? item.sent_date.slice(0, 10) : ""),
      editEmptyLabel: "Set date",
      onEdit: async (item, value) => {
        await inlineEdit!.onUpdate(String(item.id), { sent_date: value });
      },
    },
    {
      ...transmittalColumns[7],
      render: (item) => <span>{formatDate(item.due_date)}</span>,
      sortValue: (item) =>
        item.due_date ? new Date(item.due_date).getTime() : 0,
      csvValue: (item) => item.due_date ?? "",
      editable,
      editType: "date",
      editValue: (item) => (item.due_date ? item.due_date.slice(0, 10) : ""),
      editEmptyLabel: "Set date",
      onEdit: async (item, value) => {
        await inlineEdit!.onUpdate(String(item.id), { due_date: value });
      },
    },
  ];
}

// ─── Card / List views ────────────────────────────────────────────────────────

export function renderTransmittalCard(
  item: TransmittalTableRow,
  onClick: (item: TransmittalTableRow) => void,
): ReactElement {
  return (
    <div
      className="cursor-pointer rounded-lg border p-4 transition-colors hover:bg-muted/50"
      onClick={() => onClick(item)}
    >
      <div className="mb-2 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase text-muted-foreground">
            {item.number}
          </p>
          {/* eslint-disable-next-line design-system/no-raw-heading */}
          <h3 className="font-medium">{item.subject || "Untitled"}</h3>
        </div>
        <Badge variant={statusVariantMap[item.status] ?? "outline"}>
          {item.status}
        </Badge>
      </div>
      <p className="text-sm text-muted-foreground">
        {item.to_company ? `To: ${item.to_company}` : "-"}
        {item.from_company ? ` / From: ${item.from_company}` : ""}
      </p>
      {item.delivery_method && (
        <p className="mt-2 text-xs text-muted-foreground">
          {item.delivery_method}
          {item.sent_date ? ` - Sent ${formatDate(item.sent_date)}` : ""}
        </p>
      )}
    </div>
  );
}

export function renderTransmittalList(
  item: TransmittalTableRow,
  onClick: (item: TransmittalTableRow) => void,
): ReactElement {
  return (
    <div
      className="flex cursor-pointer items-center justify-between rounded-md px-4 py-2 transition-colors hover:bg-muted/50"
      onClick={() => onClick(item)}
    >
      <div>
        <p className="text-sm font-medium">
          {item.number} — {item.subject || "Untitled"}
        </p>
        <p className="text-xs text-muted-foreground">
          {item.to_company ? `To: ${item.to_company}` : "-"}
          {item.delivery_method ? ` / ${item.delivery_method}` : ""}
        </p>
      </div>
      <Badge variant={statusVariantMap[item.status] ?? "outline"}>
        {item.status}
      </Badge>
    </div>
  );
}
