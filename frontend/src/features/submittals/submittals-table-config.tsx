import * as React from "react";
import type { ReactElement } from "react";

import { formatDate } from "@/lib/format";
import type {
  ColumnConfig,
  FilterConfig,
  TableColumn,
} from "@/components/tables/unified";
import { StatusBadge } from "@/components/ds";

export interface SubmittalTableRow {
  id: string;
  // Procore-aligned columns (12)
  specification_section: string | null;
  submittal_number: string;
  revision: number;
  title: string;
  submittal_type_name: string | null;
  status: string;
  responsible_contractor: string | null;
  received_from: string | null;
  ball_in_court: string | null;
  approvers: string | null;
  latest_response: string | null;
  sent_date: string | null;
  // Extra display helpers
  is_private: boolean;
  division: string | null;
  final_due_date: string | null;
  deleted_at: string | null;
}

// ─── Urgency helper ───────────────────────────────────────────────────────────

function getDaysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  return Math.ceil(
    (new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  );
}

// ─── Column definitions ───────────────────────────────────────────────────────

export const submittalColumns: ColumnConfig[] = [
  { id: "specification_section", label: "Spec Section", defaultVisible: true },
  { id: "submittal_number", label: "#", alwaysVisible: true },
  { id: "revision", label: "Rev.", defaultVisible: true },
  { id: "title", label: "Title", defaultVisible: true },
  { id: "submittal_type_name", label: "Type", defaultVisible: true },
  { id: "status", label: "Status", defaultVisible: true },
  { id: "responsible_contractor", label: "Responsible C.", defaultVisible: true },
  { id: "received_from", label: "Received From", defaultVisible: false },
  { id: "ball_in_court", label: "Ball In Court", defaultVisible: true },
  { id: "approvers", label: "Approvers", defaultVisible: false },
  { id: "latest_response", label: "Response", defaultVisible: true },
  { id: "final_due_date", label: "Due Date", defaultVisible: true },
  { id: "sent_date", label: "Sent Date", defaultVisible: false },
];

export const submittalDefaultVisibleColumns = submittalColumns
  .filter((c) => c.defaultVisible !== false || c.alwaysVisible)
  .map((c) => c.id);

// ─── Filters ─────────────────────────────────────────────────────────────────

export const submittalFilters: FilterConfig[] = [
  {
    id: "status",
    label: "Status",
    type: "select",
    options: ["Draft", "Open", "Distributed", "Closed"].map((v) => ({
      value: v,
      label: v,
    })),
  },
  {
    id: "latest_response",
    label: "Response",
    type: "select",
    options: [
      "Submitted",
      "Pending",
      "Approved",
      "Approved as Noted",
      "Revise",
      "Rejected",
    ].map((v) => ({ value: v, label: v })),
  },
  {
    id: "division",
    label: "Division",
    type: "text",
  },
];

// ─── Table columns ────────────────────────────────────────────────────────────

export interface SubmittalInlineEditHandlers {
  /** Persists a single-field change for one submittal. Throws on failure so the cell can revert. */
  onUpdate: (
    submittalId: string,
    data: Record<string, unknown>,
  ) => Promise<void>;
}

const SUBMITTAL_STATUS_OPTIONS = ["Draft", "Open", "Distributed", "Closed"].map(
  (v) => ({ value: v, label: v }),
);

export function buildSubmittalTableColumns(
  inlineEdit?: SubmittalInlineEditHandlers,
): TableColumn<SubmittalTableRow>[] {
  return [
    {
      ...submittalColumns[0],
      render: (item) => (
        <span className="text-xs text-muted-foreground">
          {item.specification_section || "-"}
        </span>
      ),
      sortValue: (item) => item.specification_section ?? "",
      editable: Boolean(inlineEdit),
      editType: "text",
      editValue: (item) => item.specification_section ?? "",
      editEmptyLabel: "Add spec section",
      onEdit: async (item, value) => {
        await inlineEdit!.onUpdate(item.id, { specification_section: value });
      },
    },
    {
      ...submittalColumns[1],
      render: (item) => (
        <span className="font-medium">{item.submittal_number || "-"}</span>
      ),
      sortValue: (item) => item.submittal_number,
    },
    {
      ...submittalColumns[2],
      render: (item) => <span>{item.revision ?? 0}</span>,
      sortValue: (item) => item.revision ?? 0,
      editable: Boolean(inlineEdit),
      editType: "number",
      editValue: (item) => String(item.revision ?? 0),
      onEdit: async (item, value) => {
        const parsed = Number.parseInt(value, 10);
        if (Number.isNaN(parsed)) return;
        await inlineEdit!.onUpdate(item.id, { revision: parsed });
      },
    },
    {
      ...submittalColumns[3],
      render: (item) => (
        <span className="max-w-[240px] truncate block" title={item.title}>
          {item.title || "Untitled"}
        </span>
      ),
      sortValue: (item) => item.title,
      // Title is the link to the detail page — never inline-editable.
    },
    {
      ...submittalColumns[4],
      render: (item) => (
        <span>{item.submittal_type_name || "-"}</span>
      ),
      sortValue: (item) => item.submittal_type_name ?? "",
    },
    {
      ...submittalColumns[5],
      render: (item) => (
        <StatusBadge status={item.status || "-"} />
      ),
      sortValue: (item) => item.status,
      editable: Boolean(inlineEdit),
      editType: "select",
      editValue: (item) => item.status ?? "",
      editOptions: SUBMITTAL_STATUS_OPTIONS,
      editEmptyLabel: "Select status",
      onEdit: async (item, value) => {
        await inlineEdit!.onUpdate(item.id, { status: value });
      },
    },
    {
      ...submittalColumns[6],
      render: (item) => (
        <span>{item.responsible_contractor || "-"}</span>
      ),
      sortValue: (item) => item.responsible_contractor ?? "",
    },
    {
      ...submittalColumns[7],
      render: (item) => <span>{item.received_from || "-"}</span>,
      sortValue: (item) => item.received_from ?? "",
    },
    {
      ...submittalColumns[8],
      render: (item) =>
        item.ball_in_court ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
            {item.ball_in_court}
          </span>
        ) : (
          <span className="text-muted-foreground">-</span>
        ),
      sortValue: (item) => item.ball_in_court ?? "",
    },
    {
      ...submittalColumns[9],
      render: (item) => <span>{item.approvers || "-"}</span>,
      sortValue: (item) => item.approvers ?? "",
    },
    {
      ...submittalColumns[10],
      render: (item) =>
        item.latest_response ? (
          <StatusBadge status={item.latest_response} />
        ) : (
          <span className="text-muted-foreground">-</span>
        ),
      sortValue: (item) => item.latest_response ?? "",
      // Read-only: latest_response is derived from the submittal workflow steps,
      // not a free user choice. Explicit opt-out per require-editable-status-column.
      editable: false,
    },
    {
      ...submittalColumns[11],
      render: (item) => {
        if (!item.final_due_date)
          return <span className="text-muted-foreground">-</span>;
        const days = getDaysUntil(item.final_due_date);
        const isOverdue = days !== null && days < 0;
        const isSoon = days !== null && days >= 0 && days <= 5;
        return (
          <span
            className={
              isOverdue
                ? "text-destructive font-medium"
                : isSoon
                  ? "text-destructive/80"
                  : "text-foreground"
            }
          >
            {formatDate(item.final_due_date)}
          </span>
        );
      },
      sortValue: (item) =>
        item.final_due_date ? new Date(item.final_due_date).getTime() : 0,
      editable: Boolean(inlineEdit),
      editType: "date",
      editValue: (item) =>
        item.final_due_date ? item.final_due_date.slice(0, 10) : "",
      editEmptyLabel: "Set due date",
      onEdit: async (item, value) => {
        await inlineEdit!.onUpdate(item.id, { final_due_date: value });
      },
    },
    {
      ...submittalColumns[12],
      render: (item) => <span>{formatDate(item.sent_date)}</span>,
      sortValue: (item) =>
        item.sent_date ? new Date(item.sent_date).getTime() : 0,
    },
  ];
}

// ─── Card / List views ────────────────────────────────────────────────────────

export function renderSubmittalCard(
  item: SubmittalTableRow,
  onClick: (item: SubmittalTableRow) => void,
): ReactElement {
  return (
    <div
      className="cursor-pointer rounded-lg bg-muted/30 p-4 transition-colors hover:bg-muted/50"
      onClick={() => onClick(item)}
    >
      <div className="mb-2 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase text-muted-foreground">
            {item.submittal_number} Rev.&nbsp;{item.revision ?? 0}
          </p>
          {/* eslint-disable-next-line design-system/no-raw-heading */}
          <h3 className="font-medium">{item.title || "Untitled"}</h3>
        </div>
        <StatusBadge status={item.status} />
      </div>
      <p className="text-sm text-muted-foreground">
        {item.specification_section || item.submittal_type_name || "-"}
      </p>
      {item.ball_in_court && (
        <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
          {item.ball_in_court}
        </p>
      )}
      {item.final_due_date && (
        <p className="mt-1.5 text-xs text-muted-foreground">
          Due {formatDate(item.final_due_date)}
        </p>
      )}
    </div>
  );
}

export function renderSubmittalList(
  item: SubmittalTableRow,
  onClick: (item: SubmittalTableRow) => void,
): ReactElement {
  return (
    <div
      className="flex cursor-pointer items-center justify-between rounded-md px-4 py-2 transition-colors hover:bg-muted/50"
      onClick={() => onClick(item)}
    >
      <div>
        <p className="text-sm font-medium">
          {item.submittal_number} — {item.title || "Untitled"}
        </p>
        <p className="text-xs text-muted-foreground">
          Rev.&nbsp;{item.revision ?? 0} &middot;{" "}
          {item.specification_section || item.submittal_type_name || "-"}
          {item.ball_in_court && ` · ${item.ball_in_court}`}
        </p>
      </div>
      <StatusBadge status={item.status} />
    </div>
  );
}
