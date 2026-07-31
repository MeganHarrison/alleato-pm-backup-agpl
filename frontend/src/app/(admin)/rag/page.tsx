"use client";

import * as React from "react";
import { format } from "date-fns";
import { AlertTriangle, CalendarIcon, ChevronDown, RefreshCw, X } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { DateRange } from "react-day-picker";

import { PageShell, PageTabs } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  InfoAlert,
  InlineTable,
  InlineTableHeader,
  InlineTableHeaderRow,
  InlineTableHeaderCell,
  InlineTableBody,
  InlineTableRow,
  InlineTableCell,
} from "@/components/ds";
import { apiFetch } from "@/lib/api-client";
import { cn } from "@/lib/utils";

import type { DailySyncRow } from "@/app/api/admin/rag-snapshots/route";
import type {
  LifecycleDocumentsResponse,
  SourceSyncStatus,
} from "@/app/api/admin/source-sync/_contracts";

type LifecycleDocument = LifecycleDocumentsResponse["documents"][number];

const SOURCES = [
  { key: "sharepoint", label: "SharePoint" },
  { key: "outlook", label: "Outlook" },
  { key: "meetings", label: "Meetings" },
  { key: "teams", label: "Teams" },
  { key: "acumatica", label: "Acumatica" },
] as const;

const STAGE_ORDER = [
  "synced",
  "vectorized",
  "projectAssigned",
  "tasksExtracted",
  "projectIntelligenceUpdated",
] as const;

// Short, scannable labels for the funnel + matrix. The full labels live on the
// lifecycle payload (stage.label) and are used in the detail panel.
const STAGE_SHORT: Record<(typeof STAGE_ORDER)[number], string> = {
  synced: "Synced",
  vectorized: "Vectorized",
  projectAssigned: "Assigned",
  tasksExtracted: "Tasks",
  projectIntelligenceUpdated: "Intelligence",
};

// The lifecycle payload keys sources as meetings/teams/emails/sharepoint.
const SOURCE_SHORT: Record<string, string> = {
  meetings: "Meetings",
  teams: "Teams",
  emails: "Outlook",
  sharepoint: "SharePoint",
};

const TASK_OUTCOME_LABELS: Record<string, string> = {
  tasks_created: "Tasks created",
  no_actionable_tasks: "No actionable tasks",
  task_signal_staged: "Signal staged",
  not_extracted: "Not extracted",
};

type SourceKey = (typeof SOURCES)[number]["key"];

type Lifecycle = NonNullable<SourceSyncStatus["ragLifecycle"]>;
type LifecycleSource = Lifecycle["sources"][number];
type LifecycleStage = LifecycleSource["stages"][number];
type StageStatus = LifecycleStage["status"];

type Tone = {
  bar: string;
  text: string;
  chip: string;
  label: string;
};

const TONE: Record<StageStatus, Tone> = {
  healthy: {
    bar: "bg-status-success",
    text: "text-status-success",
    chip: "bg-status-success/10 text-status-success",
    label: "On track",
  },
  warning: {
    bar: "bg-status-warning",
    text: "text-status-warning",
    chip: "bg-status-warning/10 text-status-warning",
    label: "Lagging",
  },
  critical: {
    bar: "bg-status-error",
    text: "text-status-error",
    chip: "bg-status-error/10 text-status-error",
    label: "Stuck",
  },
  unknown: {
    bar: "bg-muted-foreground/40",
    text: "text-muted-foreground",
    chip: "bg-muted text-muted-foreground",
    label: "No data",
  },
};

function formatNumber(value: number): string {
  if (!value) return "0";
  return new Intl.NumberFormat("en-US").format(value);
}

function formatSyncedNumber(value: number): string {
  if (!value) return "0";
  return new Intl.NumberFormat("en-US").format(value);
}

function formatFailedNumber(value: number): string {
  if (!value) return "0";
  return new Intl.NumberFormat("en-US").format(value);
}

function formatDate(value: string | null): string {
  if (!value) return "Never";
  const date = value.length === 10 ? new Date(`${value}T12:00:00Z`) : new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", {
    weekday: value.length === 10 ? "short" : undefined,
    month: "short",
    day: "numeric",
    hour: value.length === 10 ? undefined : "numeric",
    minute: value.length === 10 ? undefined : "2-digit",
  });
}

function isToday(value: string): boolean {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  return value === today.toISOString().slice(0, 10);
}

function syncedFor(row: DailySyncRow, source: SourceKey): number {
  return row[`${source}_synced` as keyof DailySyncRow] as number;
}

function failedFor(row: DailySyncRow, source: SourceKey): number {
  return row[`${source}_failed` as keyof DailySyncRow] as number;
}

function runsFor(row: DailySyncRow, source: SourceKey): number {
  return row[`${source}_runs` as keyof DailySyncRow] as number;
}

function firstColumnLabel(source: SourceKey): string {
  return source === "meetings" || source === "outlook" ? "Added" : "Synced";
}

function secondColumnLabel(source: SourceKey): string {
  return source === "meetings" || source === "outlook" ? "Complete" : "Failed";
}

function firstValueFor(row: DailySyncRow, source: SourceKey): number {
  if (source === "outlook") return row.outlook_added;
  return source === "meetings" ? row.meetings_added : syncedFor(row, source);
}

function secondValueFor(row: DailySyncRow, source: SourceKey): number {
  if (source === "outlook") return row.outlook_complete;
  return source === "meetings" ? row.meetings_complete : failedFor(row, source);
}

function rowTotalSynced(row: DailySyncRow): number {
  return SOURCES.reduce((sum, source) => sum + firstValueFor(row, source.key), 0);
}

function rowTotalFailed(row: DailySyncRow): number {
  return SOURCES.reduce((sum, source) => {
    if (source.key === "meetings") {
      return sum + Math.max(row.meetings_added - row.meetings_complete, 0);
    }
    if (source.key === "outlook") {
      return sum + Math.max(row.outlook_added - row.outlook_complete, 0);
    }
    return sum + failedFor(row, source.key);
  }, 0);
}

// ---------------------------------------------------------------------------
// RAG lifecycle: date window
// ---------------------------------------------------------------------------

type LifecycleWindow = { days: number | null; start: string | null; end: string | null };

const PRESETS: Array<{ label: string; days: number }> = [
  { label: "Today", days: 1 },
  { label: "Last 7 days", days: 7 },
  { label: "Last 30 days", days: 30 },
];

function parseLocalDate(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function isoDaysAgo(days: number): string {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

function windowQuery(window: LifecycleWindow): string {
  if (window.start && window.end) {
    return `?start=${window.start}&end=${window.end}`;
  }
  return `?days=${window.days ?? 7}`;
}

function windowBounds(window: LifecycleWindow): { start: string; end: string; days: number } {
  if (window.start && window.end) {
    const [lo, hi] =
      window.start <= window.end ? [window.start, window.end] : [window.end, window.start];
    const days = Math.max(
      1,
      Math.round(
        (new Date(`${hi}T00:00:00Z`).getTime() - new Date(`${lo}T00:00:00Z`).getTime()) /
          (24 * 60 * 60 * 1000),
      ) + 1,
    );
    return { start: lo, end: hi, days };
  }
  const days = window.days ?? 7;
  return { start: isoDaysAgo(days - 1), end: todayISO(), days };
}

function LifecyclePicker({
  window,
  onChange,
  disabled,
}: {
  window: LifecycleWindow;
  onChange: (next: LifecycleWindow) => void;
  disabled: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const bounds = windowBounds(window);
  const activeDays = !window.start && !window.end ? window.days : null;
  const range: DateRange = {
    from: parseLocalDate(bounds.start),
    to: parseLocalDate(bounds.end),
  };
  const label =
    activeDays != null
      ? PRESETS.find((preset) => preset.days === activeDays)?.label ?? `${bounds.days} days`
      : `${format(range.from as Date, "MMM d")} – ${format(range.to as Date, "MMM d, yyyy")}`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled} className="gap-2 font-normal">
          <CalendarIcon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="flex w-auto p-0" align="start">
        <div className="flex w-36 flex-col gap-0.5 border-r border-border p-2">
          {PRESETS.map((preset) => (
            <Button
              key={preset.days}
              variant="ghost"
              size="sm"
              onClick={() => {
                onChange({ days: preset.days, start: null, end: null });
                setOpen(false);
              }}
              className={cn(
                "justify-start font-normal",
                activeDays === preset.days
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground",
              )}
            >
              {preset.label}
            </Button>
          ))}
        </div>
        <Calendar
          mode="range"
          selected={range}
          defaultMonth={range.from}
          numberOfMonths={1}
          disabled={{ after: new Date() }}
          onSelect={(next) => {
            if (next?.from && next?.to) {
              onChange({
                days: null,
                start: format(next.from, "yyyy-MM-dd"),
                end: format(next.to, "yyyy-MM-dd"),
              });
              setOpen(false);
            }
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

// ---------------------------------------------------------------------------
// RAG lifecycle: funnel + matrix
// ---------------------------------------------------------------------------

function stageByKey(
  source: LifecycleSource,
  key: (typeof STAGE_ORDER)[number],
): LifecycleStage | null {
  return source.stages.find((stage) => stage.key === key) ?? null;
}

function aggregateFunnel(lifecycle: Lifecycle) {
  return STAGE_ORDER.map((key, index) => {
    let count = 0;
    for (const source of lifecycle.sources) {
      const stage = stageByKey(source, key);
      if (stage) count += stage.count;
    }
    return { key, index, label: STAGE_SHORT[key], count };
  });
}

function FunnelStrip({ lifecycle }: { lifecycle: Lifecycle }) {
  const stages = aggregateFunnel(lifecycle);
  const top = stages[0]?.count ?? 0;

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5 lg:gap-0">
      {stages.map((stage, index) => {
        const prev = index === 0 ? stage.count : stages[index - 1].count;
        const drop = prev - stage.count;
        const dropPct = prev > 0 ? Math.round((drop / prev) * 100) : 0;
        const retained = top > 0 ? Math.round((stage.count / top) * 100) : 0;
        const bad = dropPct >= 10;
        return (
          <div
            key={stage.key}
            className={cn(
              "relative rounded-lg bg-muted/50 px-3 py-3.5",
              "lg:rounded-none lg:border-r lg:border-border",
              index === 0 && "lg:rounded-l-lg",
              index === stages.length - 1 && "lg:rounded-r-lg lg:border-r-0",
            )}
          >
            {index > 0 ? (
              <span
                className={cn(
                  "absolute left-0 top-1/2 z-10 hidden -translate-x-1/2 -translate-y-1/2 items-center rounded-md px-1.5 py-0.5 text-[10.5px] font-medium lg:inline-flex",
                  bad
                    ? "bg-status-error/10 text-status-error"
                    : "border border-border bg-background text-muted-foreground",
                )}
                title={`${formatNumber(drop)} did not advance from ${stages[index - 1].label}`}
              >
                {drop > 0 ? `−${formatNumber(drop)}` : "0"}
              </span>
            ) : null}
            <div className="text-[11.5px] font-medium text-muted-foreground">{stage.label}</div>
            <div className="mt-1.5 text-xl font-medium text-foreground">
              {formatNumber(stage.count)}
            </div>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-border">
              <div
                className={cn(
                  "h-full rounded-full",
                  retained < 70 ? "bg-status-warning" : "bg-status-success",
                )}
                style={{ width: `${retained}%` }}
              />
            </div>
            <div className="mt-1.5 text-[11px] text-muted-foreground">{retained}% retained</div>
          </div>
        );
      })}
    </div>
  );
}

type CellRef = { sourceKey: string; stageKey: (typeof STAGE_ORDER)[number] };

function MatrixCell({
  stage,
  syncedTotal,
  selected,
  onSelect,
}: {
  stage: LifecycleStage | null;
  syncedTotal: number;
  selected: boolean;
  onSelect: () => void;
}) {
  if (!stage) {
    return <div className="px-2 py-3 text-right text-xs text-muted-foreground/50">—</div>;
  }
  const tone = TONE[stage.status];
  const pct = syncedTotal > 0 ? Math.round((stage.count / syncedTotal) * 100) : 0;
  const behind = Math.max(stage.total - stage.count, 0);
  const showBehind = (stage.status === "critical" || stage.status === "warning") && behind > 0;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
      className={cn(
        "group relative cursor-pointer px-2 py-2.5 text-right outline-none transition-colors",
        stage.status === "critical" ? "bg-status-error/5" : "hover:bg-muted/60",
        selected && "ring-2 ring-inset ring-primary",
      )}
    >
      <ChevronDown
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute left-1 top-1 h-3 w-3 transition-all",
          selected
            ? "rotate-180 text-primary"
            : "text-muted-foreground/25 group-hover:text-muted-foreground/70",
        )}
      />
      <div className="text-sm font-medium text-foreground">{formatNumber(stage.count)}</div>
      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-border">
        <div className={cn("h-full rounded-full", tone.bar)} style={{ width: `${pct}%` }} />
      </div>
      {showBehind ? (
        <div className={cn("mt-1 text-[10.5px] font-medium", tone.text)}>
          {formatNumber(behind)} behind
        </div>
      ) : (
        <div className="mt-1 text-[10.5px] text-muted-foreground">{pct}%</div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted/50 px-2.5 py-2">
      <div className="mb-0.5 text-[11px] text-muted-foreground">{label}</div>
      <div className="text-sm font-medium text-foreground">{value}</div>
    </div>
  );
}

// Five-segment lifecycle progress for a single document. The stage the operator
// clicked is ringed so the row reads against the cell that opened it.
function StageDots({
  stages,
  activeKey,
}: {
  stages: LifecycleDocument["stages"];
  activeKey: (typeof STAGE_ORDER)[number];
}) {
  return (
    <span className="flex shrink-0 items-center gap-1">
      {STAGE_ORDER.map((key) => {
        const cleared = stages[key];
        const active = key === activeKey;
        return (
          <span
            key={key}
            title={`${STAGE_SHORT[key]}: ${cleared ? "complete" : "not yet"}`}
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              cleared ? "bg-status-success" : "bg-border",
              active && "ring-2 ring-offset-1 ring-offset-background",
              active && (cleared ? "ring-status-success/40" : "ring-status-error/40"),
            )}
          />
        );
      })}
    </span>
  );
}

function LifecycleDocuments({
  source,
  stageKey,
  windowQS,
}: {
  source: LifecycleSource;
  stageKey: (typeof STAGE_ORDER)[number];
  windowQS: string;
}) {
  const [data, setData] = React.useState<LifecycleDocumentsResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setData(null);
    const query = `${windowQS}&source=${source.key}&stage=${stageKey}`;
    void apiFetch<LifecycleDocumentsResponse>(
      `/api/admin/source-sync/lifecycle-documents${query}`,
    )
      .then((result) => {
        if (active) setData(result);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "Failed to load documents.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [source.key, stageKey, windowQS]);

  if (loading) {
    return <p className="py-3 text-sm text-muted-foreground">Loading documents…</p>;
  }
  if (error) {
    return (
      <InfoAlert variant="error" role="alert">
        {error}
      </InfoAlert>
    );
  }
  if (!data || data.documents.length === 0) {
    return (
      <p className="py-3 text-sm text-muted-foreground">
        No {SOURCE_SHORT[source.key] ?? source.label} documents in this window.
      </p>
    );
  }

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
        <span>
          Showing {data.returned} of {formatNumber(data.total)} documents
          {data.truncated ? " (first 500)" : ""}
        </span>
        <span className="hidden sm:inline">
          Dots: synced · vectorized · assigned · tasks · intelligence
        </span>
      </div>
      <div className="divide-y divide-border">
        {data.documents.map((doc) => (
          <div key={doc.id} className="flex items-center gap-3 py-1.5">
            <StageDots stages={doc.stages} activeKey={stageKey} />
            {doc.detailHref ? (
              <Link
                href={doc.detailHref}
                className="min-w-0 flex-1 truncate text-sm text-foreground hover:text-primary hover:underline"
              >
                {doc.title || "Untitled"}
              </Link>
            ) : (
              <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                {doc.title || "Untitled"}
              </span>
            )}
            <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
              {doc.projectName ?? "Unassigned"}
            </span>
            <span className="hidden shrink-0 text-xs text-muted-foreground md:inline">
              {TASK_OUTCOME_LABELS[doc.taskOutcome] ?? doc.taskOutcome}
            </span>
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
              {formatDate(doc.date)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DetailPanel({
  source,
  stage,
  windowQS,
  onClose,
}: {
  source: LifecycleSource;
  stage: LifecycleStage;
  windowQS: string;
  onClose: () => void;
}) {
  const tone = TONE[stage.status];
  const behind = Math.max(stage.total - stage.count, 0);
  return (
    <div className="rounded-lg bg-muted/30 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-foreground">
            {SOURCE_SHORT[source.key] ?? source.label}
          </span>
          <span className="text-muted-foreground">→</span>
          <span className="text-sm font-medium text-foreground">{stage.label}</span>
          <span
            className={cn(
              "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium",
              tone.chip,
            )}
          >
            {tone.label}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={onClose}
          aria-label="Close detail"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="mb-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <Metric label="Complete" value={`${formatNumber(stage.count)} / ${formatNumber(stage.total)}`} />
        <Metric label="Behind" value={formatNumber(behind)} />
        <Metric label="Owner" value={stage.ownerHint} />
        <Metric label="Latest" value={formatDate(stage.latestAt)} />
      </div>
      <p className="text-sm leading-relaxed text-muted-foreground">{stage.message}</p>
      <div className="mt-4 border-t border-border pt-3">
        <LifecycleDocuments source={source} stageKey={stage.key} windowQS={windowQS} />
      </div>
    </div>
  );
}

function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("h-2 w-2 rounded-[2px]", className)} />
      {label}
    </span>
  );
}

function LifecycleView({
  lifecycle,
  windowQS,
  controls,
}: {
  lifecycle: Lifecycle | undefined;
  windowQS: string;
  controls?: React.ReactNode;
}) {
  const [selected, setSelected] = React.useState<CellRef | null>(null);

  // Reset selection whenever the underlying window/data changes.
  const generatedAt = lifecycle?.generatedAt;
  React.useEffect(() => {
    setSelected(null);
  }, [generatedAt]);

  if (!lifecycle) {
    return (
      <InfoAlert variant="error" role="alert">
        RAG lifecycle data did not load. Refresh the page or check the source-sync status API.
      </InfoAlert>
    );
  }

  const sources = lifecycle.sources;
  const bottlenecks = sources.reduce(
    (sum, source) =>
      sum +
      source.stages.filter((stage) => stage.status === "critical" || stage.status === "warning")
        .length,
    0,
  );

  const selectedSource = selected
    ? sources.find((source) => source.key === selected.sourceKey) ?? null
    : null;
  const selectedStage =
    selected && selectedSource ? stageByKey(selectedSource, selected.stageKey) : null;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          {controls}
          {bottlenecks > 0 ? (
            <span className="inline-flex items-center gap-1.5 rounded-md bg-status-warning/10 px-2.5 py-1 text-xs font-medium text-status-warning">
              <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
              {bottlenecks} {bottlenecks === 1 ? "bottleneck" : "bottlenecks"}
            </span>
          ) : (
            <span className="inline-flex items-center rounded-md bg-status-success/10 px-2.5 py-1 text-xs font-medium text-status-success">
              All stages flowing
            </span>
          )}
        </div>
        <span className="text-sm text-muted-foreground">
          Updated {formatDate(lifecycle.generatedAt)}
        </span>
      </div>

      <FunnelStrip lifecycle={lifecycle} />

      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">
          By source{" "}
          <span className="font-normal text-muted-foreground/70">· click a cell for detail</span>
        </span>
        <div className="flex gap-3.5 text-[11px] text-muted-foreground">
          <LegendDot className="bg-status-success" label="On track" />
          <LegendDot className="bg-status-warning" label="Lagging" />
          <LegendDot className="bg-status-error" label="Stuck" />
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-border">
        <div className="grid grid-cols-[120px_repeat(5,1fr)] border-b border-border bg-muted/50">
          <div className="px-3 py-2 text-[11px] font-medium text-muted-foreground">Source</div>
          {STAGE_ORDER.map((key) => (
            <div
              key={key}
              className="px-2 py-2 text-right text-[11px] font-medium text-muted-foreground"
            >
              {STAGE_SHORT[key]}
            </div>
          ))}
        </div>
        {sources.map((source, rowIndex) => {
          const syncedTotal = stageByKey(source, "synced")?.count ?? 0;
          return (
            <div
              key={source.key}
              className={cn(
                "grid grid-cols-[120px_repeat(5,1fr)] items-stretch bg-card",
                rowIndex < sources.length - 1 && "border-b border-border",
              )}
            >
              <div className="flex items-center border-r border-border px-3 py-2.5">
                <span className="text-[13px] font-medium text-foreground">
                  {SOURCE_SHORT[source.key] ?? source.label}
                </span>
              </div>
              {STAGE_ORDER.map((key) => {
                const stage = stageByKey(source, key);
                const isSelected =
                  selected?.sourceKey === source.key && selected?.stageKey === key;
                return (
                  <MatrixCell
                    key={key}
                    stage={stage}
                    syncedTotal={syncedTotal}
                    selected={isSelected}
                    onSelect={() =>
                      setSelected(isSelected ? null : { sourceKey: source.key, stageKey: key })
                    }
                  />
                );
              })}
            </div>
          );
        })}
      </div>

      {selectedSource && selectedStage ? (
        <DetailPanel
          source={selectedSource}
          stage={selectedStage}
          windowQS={windowQS}
          onClose={() => setSelected(null)}
        />
      ) : null}
    </section>
  );
}

function DailySyncHistory({ days, loading }: { days: DailySyncRow[]; loading: boolean }) {
  const columnCount = 1 + SOURCES.length * 2 + 2;

  return (
    <section>
      <InlineTable variant="read">
        <InlineTableHeader>
          <InlineTableHeaderRow type="group">
            <InlineTableHeaderCell rowSpan={2}>Date</InlineTableHeaderCell>
            <InlineTableHeaderCell colSpan={2} align="center" divider>
              SharePoint
            </InlineTableHeaderCell>
            <InlineTableHeaderCell colSpan={2} align="center" divider>
              Outlook
            </InlineTableHeaderCell>
            <InlineTableHeaderCell colSpan={2} align="center" divider>
              Meetings
            </InlineTableHeaderCell>
            <InlineTableHeaderCell colSpan={2} align="center" divider>
              Teams
            </InlineTableHeaderCell>
            <InlineTableHeaderCell colSpan={2} align="center" divider>
              Acumatica
            </InlineTableHeaderCell>
            <InlineTableHeaderCell colSpan={2} align="center" divider>
              Day total
            </InlineTableHeaderCell>
          </InlineTableHeaderRow>
          <InlineTableHeaderRow>
            {SOURCES.map((source, index) => (
              <React.Fragment key={source.key}>
                <InlineTableHeaderCell align="right" divider={index === 0}>
                  {firstColumnLabel(source.key)}
                </InlineTableHeaderCell>
                <InlineTableHeaderCell align="right">
                  {secondColumnLabel(source.key)}
                </InlineTableHeaderCell>
              </React.Fragment>
            ))}
            <InlineTableHeaderCell align="right" divider>
              Added / synced
            </InlineTableHeaderCell>
            <InlineTableHeaderCell align="right">Open</InlineTableHeaderCell>
          </InlineTableHeaderRow>
        </InlineTableHeader>

        <InlineTableBody>
          {loading && days.length === 0 ? (
            <InlineTableRow>
              <InlineTableCell colSpan={columnCount} align="center" className="py-8 text-muted-foreground">
                Loading sync history...
              </InlineTableCell>
            </InlineTableRow>
          ) : null}

          {!loading && days.length === 0 ? (
            <InlineTableRow>
              <InlineTableCell colSpan={columnCount} align="center" className="py-8 text-muted-foreground">
                No sync runs recorded in the selected window.
              </InlineTableCell>
            </InlineTableRow>
          ) : null}

          {days.map((day) => {
            const totalSynced = rowTotalSynced(day);
            const totalFailed = rowTotalFailed(day);
            const hasActivity = totalSynced > 0 || totalFailed > 0;
            return (
              <InlineTableRow key={day.date}>
                <InlineTableCell
                  className={cn(
                    "whitespace-nowrap text-xs",
                    isToday(day.date)
                      ? "font-semibold text-foreground"
                      : hasActivity
                        ? "text-foreground"
                        : "text-muted-foreground/60",
                  )}
                >
                  {formatDate(day.date)}
                </InlineTableCell>
                {SOURCES.map((source, index) => {
                  const firstValue = firstValueFor(day, source.key);
                  const secondValue = secondValueFor(day, source.key);
                  const runs = runsFor(day, source.key);
                  const isMeetings = source.key === "meetings";
                  const isOutlook = source.key === "outlook";
                  const hasRun = isMeetings || isOutlook || runs > 0;
                  const meetingsComplete =
                    isMeetings && day.meetings_added > 0 && day.meetings_complete === day.meetings_added;
                  const outlookComplete =
                    isOutlook && day.outlook_added > 0 && day.outlook_complete === day.outlook_added;
                  return (
                    <React.Fragment key={source.key}>
                      <InlineTableCell
                        align="right"
                        numeric
                        divider={index === 0}
                        className={cn(
                          firstValue === 0 ? "text-destructive" : undefined,
                          !hasRun && "text-muted-foreground/60",
                        )}
                      >
                        {formatSyncedNumber(firstValue)}
                      </InlineTableCell>
                      <InlineTableCell
                        align="right"
                        numeric
                        title={
                          isMeetings
                            ? `${day.meetings_vectorized}/${day.meetings_added} vectorized, ${day.meetings_project_assigned}/${day.meetings_added} project assigned, ${day.meetings_tasks_extracted}/${day.meetings_added} tasks extracted, ${day.meetings_project_intelligence_updated}/${day.meetings_added} Project Intelligence updated`
                            : isOutlook
                              ? `${day.outlook_vectorized}/${day.outlook_added} vectorized, ${day.outlook_project_assigned}/${day.outlook_added} project assigned, ${day.outlook_tasks_extracted}/${day.outlook_added} tasks extracted, ${day.outlook_project_intelligence_updated}/${day.outlook_added} Project Intelligence updated`
                            : undefined
                        }
                        className={
                          isMeetings
                            ? meetingsComplete || day.meetings_added === 0
                              ? "text-emerald-700"
                              : "text-destructive"
                            : isOutlook
                              ? outlookComplete || day.outlook_added === 0
                                ? "text-emerald-700"
                                : "text-destructive"
                            : !hasRun
                              ? "text-muted-foreground/60"
                              : secondValue > 0
                                ? "text-destructive"
                                : "text-emerald-700"
                        }
                      >
                        {formatFailedNumber(secondValue)}
                      </InlineTableCell>
                    </React.Fragment>
                  );
                })}
                <InlineTableCell
                  align="right"
                  numeric
                  divider
                  className={cn("font-semibold", totalSynced === 0 && "text-destructive")}
                >
                  {formatSyncedNumber(totalSynced)}
                </InlineTableCell>
                <InlineTableCell
                  align="right"
                  numeric
                  className={cn(
                    "font-semibold",
                    totalFailed > 0 ? "text-destructive" : "text-emerald-700",
                  )}
                >
                  {formatFailedNumber(totalFailed)}
                </InlineTableCell>
              </InlineTableRow>
            );
          })}
        </InlineTableBody>
      </InlineTable>
    </section>
  );
}

export default function RagDashboardPage() {
  const searchParams = useSearchParams();
  const [days, setDays] = React.useState<DailySyncRow[]>([]);
  const [status, setStatus] = React.useState<SourceSyncStatus | null>(null);
  const [historyLoading, setHistoryLoading] = React.useState(true);
  const [lifecycleLoading, setLifecycleLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [lifecycleWindow, setLifecycleWindow] = React.useState<LifecycleWindow>({
    days: 7,
    start: null,
    end: null,
  });
  const activeTab = searchParams?.get("tab") === "lifecycle" ? "lifecycle" : "sync";

  const loadHistory = React.useCallback(() => {
    setHistoryLoading(true);
    void apiFetch<{ days: DailySyncRow[] }>("/api/admin/rag-snapshots?days=30")
      .then((history) => {
        setDays(history.days ?? []);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load sync history.");
      })
      .finally(() => {
        setHistoryLoading(false);
      });
  }, []);

  const loadLifecycle = React.useCallback((window: LifecycleWindow) => {
    setError(null);
    setLifecycleLoading(true);
    void apiFetch<SourceSyncStatus>(`/api/admin/source-sync/status${windowQuery(window)}`)
      .then((lifecycleStatus) => {
        setStatus(lifecycleStatus);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load RAG lifecycle.");
      })
      .finally(() => {
        setLifecycleLoading(false);
      });
  }, []);

  React.useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  React.useEffect(() => {
    loadLifecycle(lifecycleWindow);
  }, [loadLifecycle, lifecycleWindow]);

  const loading = historyLoading || lifecycleLoading;

  return (
    <PageShell
      variant="dashboard"
      title="RAG Health"
      eyebrow="Admin"
      actions={
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            loadHistory();
            loadLifecycle(lifecycleWindow);
          }}
          disabled={loading}
        >
          <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
          Refresh
        </Button>
      }
    >
      {error ? (
        <InfoAlert variant="error" role="alert">
          <div className="font-medium">Failed to load RAG health</div>
          <div className="text-xs opacity-80">{error}</div>
        </InfoAlert>
      ) : null}

      <PageTabs
        variant="inline"
        tabs={[
          {
            label: "Sync history",
            href: "/rag",
            isActive: activeTab === "sync",
          },
          {
            label: "RAG lifecycle",
            href: "/rag?tab=lifecycle",
            isActive: activeTab === "lifecycle",
          },
        ]}
      />

      {activeTab === "sync" ? (
        <DailySyncHistory days={days} loading={historyLoading} />
      ) : lifecycleLoading && !status ? (
        <div className="space-y-4">
          <LifecyclePicker
            window={lifecycleWindow}
            onChange={setLifecycleWindow}
            disabled={lifecycleLoading}
          />
          <InfoAlert>Loading RAG lifecycle health...</InfoAlert>
        </div>
      ) : (
        <LifecycleView
          lifecycle={status?.ragLifecycle}
          windowQS={windowQuery(lifecycleWindow)}
          controls={
            <LifecyclePicker
              window={lifecycleWindow}
              onChange={setLifecycleWindow}
              disabled={lifecycleLoading}
            />
          }
        />
      )}
    </PageShell>
  );
}
