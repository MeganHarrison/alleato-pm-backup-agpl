import type { TableColumn, FilterConfig } from "@/components/tables/unified";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AiAgentRun {
  id: string;
  project_id: number | null;
  started_at: string | null;
  completed_at: string | null;
  status: "success" | "failure" | "partial" | "skipped" | null;
  confidence_score: number | null;
  output_count: number | null;
  tokens_used: number | null;
  error_message: string | null;
  metadata: unknown;
  created_at: string;
}

export interface AiAgent {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  layer: string | null;
  status: "planned" | "building" | "beta" | "production" | "deprecated";
  trigger_type: string | null;
  trigger_detail: string | null;
  purpose: string | null;
  data_sources: string[];
  output_type: string | null;
  output_destination: string | null;
  approval_required: boolean | null;
  confidence_threshold: number | null;
  failure_behavior: string | null;
  success_metric: string | null;
  dependencies: string[];
  blockers: string | null;
  priority_score: number | null;
  estimated_effort: "S" | "M" | "L" | "XL" | null;
  estimated_impact: "low" | "medium" | "high" | "critical" | null;
  data_freshness_requirement: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // computed by API
  runStats: {
    lastRun: string | null;
    successRate: number;
    totalRuns: number;
  };
  recentRuns: AiAgentRun[];
  gapCount: number;
}

// ─── Status helpers ───────────────────────────────────────────────────────────

export const STATUS_LABELS: Record<AiAgent["status"], string> = {
  planned: "Planned",
  building: "Building",
  beta: "Beta",
  production: "Production",
  deprecated: "Deprecated",
};

export const STATUS_COLORS: Record<AiAgent["status"], string> = {
  planned: "bg-muted text-muted-foreground",
  building: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  beta: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  production: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  deprecated: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

export const IMPACT_COLORS: Record<NonNullable<AiAgent["estimated_impact"]>, string> = {
  low: "text-muted-foreground",
  medium: "text-foreground",
  high: "text-orange-600 dark:text-orange-400",
  critical: "text-red-600 dark:text-red-400 font-medium",
};

// ─── Inline editing ────────────────────────────────────────────────────────────

export interface AiAgentInlineEditHandlers {
  /** Persists a single-field change for one agent. Throws on failure so the cell can revert. */
  onUpdate: (id: string, data: Record<string, unknown>) => Promise<void>;
}

const STATUS_EDIT_OPTIONS = (
  Object.entries(STATUS_LABELS) as [AiAgent["status"], string][]
).map(([value, label]) => ({ value, label }));

// ─── Columns ─────────────────────────────────────────────────────────────────

export function buildAiAgentColumns(
  inlineEdit?: AiAgentInlineEditHandlers,
): TableColumn<AiAgent>[] {
  return [
    {
      id: "name",
      label: "Agent",
      alwaysVisible: true,
      sortable: true,
      sortValue: (a) => a.name,
      csvValue: (a) => a.name,
      render: (a) => (
        <span className="block truncate text-sm font-medium">{a.name}</span>
      ),
    },
    {
      id: "status",
      label: "Status",
      defaultVisible: true,
      sortable: true,
      sortValue: (a) => a.status,
      csvValue: (a) => STATUS_LABELS[a.status],
      render: (a) => (
        <span
          className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[a.status]}`}
        >
          {STATUS_LABELS[a.status]}
        </span>
      ),
      editable: Boolean(inlineEdit),
      editType: "select",
      editValue: (a) => a.status,
      editOptions: STATUS_EDIT_OPTIONS,
      editEmptyLabel: "Select status",
      onEdit: async (a, value) => {
        await inlineEdit!.onUpdate(a.id, { status: value });
      },
    },
    {
      id: "domain",
      label: "Domain",
      defaultVisible: true,
      sortable: true,
      sortValue: (a) => a.domain ?? "",
      csvValue: (a) => a.domain ?? "",
      render: (a) => (
        <span className="text-sm capitalize text-muted-foreground">{a.domain ?? "—"}</span>
      ),
    },
    {
      id: "trigger",
      label: "Trigger",
      defaultVisible: true,
      csvValue: (a) => `${a.trigger_type ?? ""}: ${a.trigger_detail ?? ""}`,
      render: (a) => (
        <span className="block max-w-48 truncate text-xs capitalize">
          {a.trigger_detail ?? a.trigger_type}
        </span>
      ),
    },
    {
      id: "impact",
      label: "Impact",
      defaultVisible: true,
      sortable: true,
      sortValue: (a) => {
        const order = { critical: 4, high: 3, medium: 2, low: 1 };
        return a.estimated_impact ? (order[a.estimated_impact] ?? 0) : 0;
      },
      csvValue: (a) => a.estimated_impact ?? "",
      render: (a) => (
        <span
          className={`text-sm capitalize ${a.estimated_impact ? IMPACT_COLORS[a.estimated_impact] : "text-muted-foreground"}`}
        >
          {a.estimated_impact ?? "—"}
        </span>
      ),
    },
    {
      id: "priority",
      label: "Priority",
      defaultVisible: true,
      sortable: true,
      sortValue: (a) => a.priority_score ?? 0,
      csvValue: (a) => String(a.priority_score ?? ""),
      render: (a) => (
        <span className="text-sm tabular-nums">
          {a.priority_score != null ? a.priority_score : "—"}
        </span>
      ),
      editable: Boolean(inlineEdit),
      editType: "number",
      editValue: (a) => (a.priority_score != null ? String(a.priority_score) : ""),
      editEmptyLabel: "Set priority",
      onEdit: async (a, value) => {
        const parsed = Math.round(Number(value));
        if (!Number.isFinite(parsed)) return;
        const clamped = Math.min(100, Math.max(1, parsed));
        await inlineEdit!.onUpdate(a.id, { priority_score: clamped });
      },
    },
    {
      id: "approval",
      label: "Approval",
      defaultVisible: true,
      csvValue: (a) => (a.approval_required ? "Required" : "Auto"),
      render: (a) => (
        <span
          className={`text-xs ${a.approval_required ? "text-orange-600 dark:text-orange-400" : "text-muted-foreground"}`}
        >
          {a.approval_required == null ? "—" : a.approval_required ? "Required" : "Auto"}
        </span>
      ),
      editable: Boolean(inlineEdit),
      editType: "boolean",
      editValue: (a) => (a.approval_required ? "true" : "false"),
      onEdit: async (a, value) => {
        await inlineEdit!.onUpdate(a.id, { approval_required: value === "true" });
      },
    },
    {
      id: "gaps",
      label: "Gaps",
      defaultVisible: true,
      sortable: true,
      sortValue: (a) => a.gapCount,
      csvValue: (a) => String(a.gapCount),
      render: (a) => (
        <span
          className={`text-sm font-medium tabular-nums ${
            a.gapCount === 0
              ? "text-green-600 dark:text-green-400"
              : a.gapCount >= 3
                ? "text-red-600 dark:text-red-400"
                : "text-orange-600 dark:text-orange-400"
          }`}
        >
          {a.gapCount === 0 ? "✓" : `${a.gapCount} undefined`}
        </span>
      ),
    },
    {
      id: "last_run",
      label: "Last Run",
      defaultVisible: false,
      sortable: true,
      sortValue: (a) => a.runStats.lastRun ?? "",
      csvValue: (a) => a.runStats.lastRun ?? "Never",
      render: (a) => (
        <span className="text-xs text-muted-foreground">
          {a.runStats.lastRun
            ? new Date(a.runStats.lastRun).toLocaleDateString()
            : "Never"}
        </span>
      ),
    },
    {
      id: "success_rate",
      label: "Success Rate",
      defaultVisible: false,
      sortable: true,
      sortValue: (a) => a.runStats.successRate,
      csvValue: (a) => `${a.runStats.successRate}%`,
      render: (a) => (
        <span className="text-xs tabular-nums text-muted-foreground">
          {a.runStats.totalRuns > 0 ? `${a.runStats.successRate}%` : "—"}
        </span>
      ),
    },
    {
      id: "effort",
      label: "Effort",
      defaultVisible: false,
      csvValue: (a) => a.estimated_effort ?? "",
      render: (a) => (
        <span className="text-sm text-muted-foreground">{a.estimated_effort ?? "—"}</span>
      ),
    },
  ];
}

export const aiAgentDefaultVisibleColumns = [
  "name",
  "status",
  "domain",
  "trigger",
  "impact",
  "priority",
  "approval",
  "gaps",
];

// ─── Filters ──────────────────────────────────────────────────────────────────

export const aiAgentFilters: FilterConfig[] = [
  {
    id: "status",
    label: "Status",
    type: "select",
    options: [
      { value: "production", label: "Production" },
      { value: "beta", label: "Beta" },
      { value: "building", label: "Building" },
      { value: "planned", label: "Planned" },
      { value: "deprecated", label: "Deprecated" },
    ],
  },
  {
    id: "domain",
    label: "Domain",
    type: "select",
    options: [
      { value: "pipeline", label: "Pipeline" },
      { value: "chat", label: "Chat" },
      { value: "write", label: "Write" },
    ],
  },
  {
    id: "impact",
    label: "Impact",
    type: "select",
    options: [
      { value: "critical", label: "Critical" },
      { value: "high", label: "High" },
      { value: "medium", label: "Medium" },
      { value: "low", label: "Low" },
    ],
  },
];
