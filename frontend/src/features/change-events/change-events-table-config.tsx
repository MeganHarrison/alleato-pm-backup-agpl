import { ChevronRight, Eye, MoreVertical, Pencil, RotateCcw, Send, Trash2 } from "lucide-react";
import type { ReactElement } from "react";

import { formatDate } from "@/lib/format";

import { StatusBadge } from "@/components/ds";
import {
  CellLink,
  type ColumnConfig,
  type FilterConfig,
  type TableColumn,
} from "@/components/tables/unified";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { ChangeEvent } from "@/hooks/use-change-events";
import {
  CHANGE_EVENT_SCOPE_VALUES,
  CHANGE_EVENT_TYPE_VALUES,
  CHANGE_EVENT_REASON_VALUES,
  CHANGE_EVENT_ORIGIN_VALUES,
} from "@/app/api/projects/[projectId]/change-events/validation";

const STATUS_FILTER_OPTIONS = [
  { value: "open", label: "Open" },
  { value: "pending_approval", label: "Pending Approval" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "closed", label: "Closed" },
  { value: "converted", label: "Converted" },
];

const SCOPE_FILTER_OPTIONS = [
  { value: "tbd", label: "TBD" },
  { value: "in_scope", label: "In Scope" },
  { value: "out_of_scope", label: "Out of Scope" },
  { value: "allowance", label: "Allowance" },
];

const TYPE_FILTER_OPTIONS = [
  { value: "Owner Change", label: "Owner Change" },
  { value: "Design Change", label: "Design Change" },
  { value: "Allowance", label: "Allowance" },
  { value: "Contingency", label: "Contingency" },
  { value: "TBD", label: "TBD" },
  { value: "Transfer", label: "Transfer" },
  { value: "Unforeseen Condition", label: "Unforeseen Condition" },
  { value: "Value Engineering", label: "Value Engineering" },
];

export const changeEventColumns: ColumnConfig[] = [
  { id: "number_title", label: "CE Number - Title", alwaysVisible: true },
  { id: "revenue_prime_pco", label: "Prime PCO", defaultVisible: true },
  { id: "prime_pco_title", label: "Prime PCO Title", defaultVisible: true },
  { id: "cost_rom", label: "Cost ROM", defaultVisible: true },
  { id: "rfq_title", label: "RFQ Title", defaultVisible: true },
  { id: "commitment", label: "Commitment", defaultVisible: true },
  { id: "commitment_title", label: "Commitment Title", defaultVisible: true },
  { id: "status", label: "Status", defaultVisible: true },
  { id: "scope", label: "Scope", defaultVisible: true },
  { id: "type", label: "Type", defaultVisible: true },
  { id: "reason", label: "Change Reason", defaultVisible: true },
  { id: "origin", label: "Origin", defaultVisible: true },
  { id: "created_at", label: "Created", defaultVisible: true },
];

const ORIGIN_FILTER_OPTIONS = [
  { value: "Emails", label: "Emails" },
  { value: "Meetings", label: "Meetings" },
  { value: "RFI's", label: "RFI's" },
  { value: "Internal", label: "Internal" },
  { value: "Field", label: "Field" },
];

const EXPECTING_REVENUE_FILTER_OPTIONS = [
  { value: "true", label: "Yes" },
  { value: "false", label: "No" },
];

const CONVERSION_STATE_FILTER_OPTIONS = [
  { value: "unlinked", label: "Unlinked" },
  { value: "partially_linked", label: "Partially Linked" },
  { value: "fully_linked", label: "Fully Linked" },
];

export const changeEventFilters: FilterConfig[] = [
  {
    id: "status",
    label: "Status",
    type: "select",
    options: STATUS_FILTER_OPTIONS,
  },
  {
    id: "scope",
    label: "Scope",
    type: "select",
    options: SCOPE_FILTER_OPTIONS,
  },
  {
    id: "type",
    label: "Type",
    type: "select",
    options: TYPE_FILTER_OPTIONS,
  },
  {
    id: "origin",
    label: "Origin",
    type: "select",
    options: ORIGIN_FILTER_OPTIONS,
  },
  {
    id: "expecting_revenue",
    label: "Expecting Revenue",
    type: "select",
    options: EXPECTING_REVENUE_FILTER_OPTIONS,
  },
  {
    id: "conversion_state",
    label: "Conversion State",
    type: "select",
    options: CONVERSION_STATE_FILTER_OPTIONS,
  },
  {
    id: "over_under",
    label: "Over/Under",
    type: "select",
    options: [
      { value: "over", label: "Over Budget" },
      { value: "under", label: "Under Budget" },
    ],
  },
  {
    id: "budget",
    label: "Budget",
    type: "text",
  },
  {
    id: "budget_code_segments",
    label: "Budget Code Segments",
    type: "text",
  },
];

export const changeEventDefaultVisibleColumns = changeEventColumns
  .filter((column) => column.defaultVisible !== false)
  .map((column) => column.id);

function statusLabel(status: string | null | undefined): string {
  switch ((status ?? "").toLowerCase().replace(/\s+/g, "_")) {
    case "open":
      return "Open";
    case "pending_approval":
      return "Pending Approval";
    case "approved":
      return "Approved";
    case "rejected":
      return "Rejected";
    case "closed":
      return "Closed";
    case "converted":
      return "Converted";
    default:
      return status || "-";
  }
}

function scopeLabel(scope: string | null | undefined): string {
  switch ((scope ?? "").toLowerCase()) {
    case "tbd":
      return "TBD";
    case "in_scope":
      return "In Scope";
    case "out_of_scope":
      return "Out of Scope";
    default:
      return scope || "-";
  }
}

function typeLabel(type: string | null | undefined): string {
  switch ((type ?? "").toLowerCase()) {
    case "owner_change":
    case "owner change":
      return "Owner Change";
    case "design_change":
    case "design change":
      return "Design Change";
    case "allowance":
      return "Allowance";
    case "contingency":
      return "Contingency";
    case "scope_gap":
    case "scope gap":
      return "Scope Gap";
    case "tbd":
      return "TBD";
    case "transfer":
      return "Transfer";
    case "unforeseen_condition":
    case "unforeseen condition":
      return "Unforeseen Condition";
    case "value_engineering":
    case "value engineering":
      return "Value Engineering";
    default:
      return type || "-";
  }
}

function formatMoney(value: number | string | null | undefined): string {
  const numeric =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : NaN;
  if (!Number.isFinite(numeric)) return "$0.00";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(numeric);
}

// Inline-edit option lists, derived from the canonical validation enums so the
// values sent on PATCH are exactly the Title Case strings the zod schema accepts.
const SCOPE_EDIT_OPTIONS = CHANGE_EVENT_SCOPE_VALUES.map((value) => ({
  value,
  label: value,
}));
const TYPE_EDIT_OPTIONS = CHANGE_EVENT_TYPE_VALUES.map((value) => ({
  value,
  label: value,
}));
const REASON_EDIT_OPTIONS = CHANGE_EVENT_REASON_VALUES.map((value) => ({
  value,
  label: value,
}));
const ORIGIN_EDIT_OPTIONS = CHANGE_EVENT_ORIGIN_VALUES.map((value) => ({
  value,
  label: value,
}));

export interface ChangeEventInlineEditHandlers {
  /** Persists a single-field change for one change event. Throws on failure so the cell can revert. */
  onUpdate: (
    changeEventId: string,
    data: Record<string, unknown>,
  ) => Promise<void>;
}

export function buildChangeEventTableColumns(
  expandedIds?: Set<string>,
  onToggleExpand?: (id: string) => void,
  inlineEdit?: ChangeEventInlineEditHandlers,
): TableColumn<ChangeEvent>[] {
  const byId = (columnId: string): ColumnConfig => {
    const column = changeEventColumns.find((candidate) => candidate.id === columnId);
    if (!column) {
      throw new Error(
        `[change-events-table-config] Missing column definition for ${columnId}`,
      );
    }
    return column;
  };

  return [
    {
      ...byId("number_title"),
      render: (item) => (
        <div className="flex items-center gap-1.5">
          {onToggleExpand && (
            <Button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleExpand(String(item.id));
              }}
              variant="ghost"
              size="icon"
              className="h-5 w-5 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label={
                expandedIds?.has(String(item.id))
                  ? "Collapse change event"
                  : "Expand change event"
              }
            >
              <ChevronRight
                className={`h-3.5 w-3.5 transition-transform ${
                  expandedIds?.has(String(item.id)) ? "rotate-90" : ""
                }`}
              />
            </Button>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="cursor-default">
                <span className="font-mono text-muted-foreground">{item.number || `CE-${item.id}`}</span>
                {" - "}
                <span className="font-medium">{item.title}</span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-xs space-y-1 text-xs">
              <p className="font-semibold text-sm">{item.number || `CE-${item.id}`} — {item.title}</p>
              <p><span className="text-muted-foreground">Status:</span> {statusLabel(item.status)}</p>
              <p><span className="text-muted-foreground">Scope:</span> {scopeLabel(item.scope)}</p>
              {item.reason && <p><span className="text-muted-foreground">Change Reason:</span> {item.reason}</p>}
              <p><span className="text-muted-foreground">Type:</span> {typeLabel(item.type)}</p>
            </TooltipContent>
          </Tooltip>
        </div>
      ),
      sortValue: (item) => `${item.number ?? ""} ${item.title}`,
    },
    {
      // Revenue > Prime PCO (dollar amount)
      ...byId("revenue_prime_pco"),
      align: "right" as const,
      render: (item) => (
        <span className="tabular-nums">{formatMoney(item.rom)}</span>
      ),
      sortValue: (item) => Number(item.rom ?? 0),
    },
    {
      ...byId("prime_pco_title"),
      render: (item) => (
        <span className="line-clamp-1">
          {item.prime_pco_title
            ? item.prime_pco_title
            : item.prime_pco
              ? `${item.prime_pco}`
              : "--"}
        </span>
      ),
      sortValue: (item) => item.prime_pco_title ?? item.prime_pco ?? "",
    },
    {
      // Cost > Cost ROM
      ...byId("cost_rom"),
      align: "right" as const,
      render: (item) => (
        <span className="tabular-nums">{formatMoney(item.cost_rom)}</span>
      ),
      sortValue: (item) => Number(item.cost_rom ?? 0),
    },
    {
      ...byId("rfq_title"),
      render: (item) => <span className="line-clamp-1">{item.rfq_title || "--"}</span>,
      sortValue: (item) => item.rfq_title ?? "",
    },
    {
      // Cost > Commitment (dollar amount)
      ...byId("commitment"),
      align: "right" as const,
      render: (item) => (
        <span className="tabular-nums">{formatMoney(item.commitment)}</span>
      ),
      sortValue: (item) => Number(item.commitment ?? 0),
    },
    {
      ...byId("commitment_title"),
      render: (item) => (
        <CellLink
          value={item.commitment_title}
          href={
            item.commitment_id
              ? `/${item.project_id}/commitments/${item.commitment_id}`
              : null
          }
          className="line-clamp-1"
        />
      ),
      sortValue: (item) => item.commitment_title ?? "",
    },
    {
      ...byId("status"),
      render: (item) => <StatusBadge status={statusLabel(item.status)} />,
      sortValue: (item) => item.status ?? "",
      // Read-only inline: status transitions are owned by the approvals +
      // convert-to-change-order routes, not free user choice.
      editable: false,
    },
    {
      ...byId("scope"),
      render: (item) => <span>{scopeLabel(item.scope)}</span>,
      sortValue: (item) => scopeLabel(item.scope),
      editable: Boolean(inlineEdit),
      editType: "select",
      editValue: (item) => item.scope ?? "",
      editOptions: SCOPE_EDIT_OPTIONS,
      editEmptyLabel: "Select scope",
      onEdit: async (item, value) => {
        await inlineEdit!.onUpdate(String(item.id), { scope: value });
      },
    },
    {
      ...byId("type"),
      render: (item) => <span>{typeLabel(item.type)}</span>,
      sortValue: (item) => typeLabel(item.type),
      editable: Boolean(inlineEdit),
      editType: "select",
      editValue: (item) => item.type ?? "",
      editOptions: TYPE_EDIT_OPTIONS,
      editEmptyLabel: "Select type",
      onEdit: async (item, value) => {
        await inlineEdit!.onUpdate(String(item.id), { type: value });
      },
    },
    {
      ...byId("reason"),
      render: (item) => <span className="line-clamp-1">{item.reason || "--"}</span>,
      sortValue: (item) => item.reason ?? "",
      editable: Boolean(inlineEdit),
      editType: "select",
      editValue: (item) => item.reason ?? "",
      editOptions: REASON_EDIT_OPTIONS,
      editEmptyLabel: "Select change reason",
      onEdit: async (item, value) => {
        await inlineEdit!.onUpdate(String(item.id), { reason: value });
      },
    },
    {
      ...byId("origin"),
      render: (item) => <span>{item.origin || "--"}</span>,
      sortValue: (item) => item.origin ?? "",
      editable: Boolean(inlineEdit),
      editType: "select",
      editValue: (item) => item.origin ?? "",
      editOptions: ORIGIN_EDIT_OPTIONS,
      editEmptyLabel: "Select origin",
      onEdit: async (item, value) => {
        await inlineEdit!.onUpdate(String(item.id), { origin: value });
      },
    },
    {
      ...byId("created_at"),
      render: (item) => <span>{formatDate(item.created_at)}</span>,
      sortValue: (item) => (item.created_at ? new Date(item.created_at).getTime() : 0),
    },
  ];
}

export function renderChangeEventRowActions(
  item: ChangeEvent,
  onView: (item: ChangeEvent) => void,
  onEdit: (item: ChangeEvent) => void,
  onDelete: (item: ChangeEvent) => void,
  onSendRfqs?: (item: ChangeEvent) => void,
  onRestore?: (item: ChangeEvent) => void,
): ReactElement {
  const isDeleted = Boolean(item.deleted_at);
  return (
    <div className="flex items-center gap-1">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => onView(item)}>
            <Eye className="mr-2 h-4 w-4" />
            View
          </DropdownMenuItem>
          {!isDeleted && (
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(item); }}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </DropdownMenuItem>
          )}
          {!isDeleted && onSendRfqs && (
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onSendRfqs(item); }}>
              <Send className="mr-2 h-4 w-4" />
              Send RFQs
            </DropdownMenuItem>
          )}
          {isDeleted && onRestore && (
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onRestore(item); }}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Restore
            </DropdownMenuItem>
          )}
          <DropdownMenuItem className="text-destructive" onClick={() => onDelete(item)}>
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export function renderChangeEventCard(
  item: ChangeEvent,
  onClick: (item: ChangeEvent) => void,
): ReactElement {
  const hasPrimePco = Boolean(item.rom && Number(item.rom) !== 0);
  const hasCostRom = Boolean(item.cost_rom && Number(item.cost_rom) !== 0);
  const hasCommitment = Boolean(item.commitment && Number(item.commitment) !== 0);
  const hasFinancials = hasPrimePco || hasCostRom || hasCommitment;

  return (
    <Button
      type="button"
      variant="ghost"
      className="h-auto w-full flex-col items-start justify-start gap-0 whitespace-normal rounded-lg border border-border bg-card p-4 text-left shadow-xs hover:bg-muted/40 transition-colors"
      onClick={() => onClick(item)}
    >
      {/* Header: CE number + status badge */}
      <div className="mb-3 flex w-full items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <span className="font-mono text-xs text-muted-foreground">
            {item.number || `CE-${item.id}`}
          </span>
          <p className="mt-1 line-clamp-2 text-sm font-medium leading-snug text-foreground">
            {item.title || "Untitled Change Event"}
          </p>
        </div>
        <div className="shrink-0">
          <StatusBadge status={statusLabel(item.status)} />
        </div>
      </div>

      {/* Meta: scope · type · origin */}
      <div className="mb-3 flex w-full flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        <span>{scopeLabel(item.scope)}</span>
        {item.type && (
          <>
            <span className="opacity-40" aria-hidden>·</span>
            <span>{typeLabel(item.type)}</span>
          </>
        )}
        {item.origin && (
          <>
            <span className="opacity-40" aria-hidden>·</span>
            <span>{item.origin}</span>
          </>
        )}
      </div>

      {/* Financials: Prime PCO / Cost ROM / Commitment */}
      {hasFinancials && (
        <div className="mb-3 grid w-full grid-cols-3 rounded-md bg-muted/50 p-3">
          <div>
            <p className="text-xs text-muted-foreground">Prime PCO</p>
            <p className="mt-1 text-sm font-medium tabular-nums text-foreground">
              {formatMoney(item.rom)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Cost ROM</p>
            <p className="mt-1 text-sm font-medium tabular-nums text-foreground">
              {formatMoney(item.cost_rom)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Commitment</p>
            <p className="mt-1 text-sm font-medium tabular-nums text-foreground">
              {formatMoney(item.commitment)}
            </p>
          </div>
        </div>
      )}

      {/* Footer: created date + change reason */}
      <div className="flex w-full items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>{item.created_at ? formatDate(item.created_at) : "—"}</span>
        {item.reason && (
          <span className="min-w-0 truncate text-right">{item.reason}</span>
        )}
      </div>
    </Button>
  );
}

export function renderChangeEventList(
  item: ChangeEvent,
  onClick: (item: ChangeEvent) => void,
): ReactElement {
  return (
    <Button
      type="button"
      variant="ghost"
      className="h-auto w-full items-center justify-between gap-4 whitespace-normal rounded-md px-4 py-3 text-left hover:bg-muted/50"
      onClick={() => onClick(item)}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-muted-foreground">
            {item.number || `CE-${item.id}`}
          </span>
          {item.scope && (
            <span className="text-xs text-muted-foreground opacity-60">
              {scopeLabel(item.scope)}
            </span>
          )}
        </div>
        <p className="mt-1 truncate text-sm font-medium text-foreground">
          {item.title || "Untitled Change Event"}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-4">
        {item.rom ? (
          <span className="hidden text-sm tabular-nums text-foreground sm:block">
            {formatMoney(item.rom)}
          </span>
        ) : null}
        <StatusBadge status={statusLabel(item.status)} />
      </div>
    </Button>
  );
}

export { formatMoney };
