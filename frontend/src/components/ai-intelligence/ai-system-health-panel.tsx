"use client";

import { startTransition, useCallback, useEffect, useState } from "react";
import type { DateRange } from "react-day-picker";
import {
  Brain,
  CalendarRange,
  CheckCircle2,
  RefreshCw,
  Sparkles,
  Wrench,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api-client";
import { formatCurrency, formatNumber } from "@/lib/format";
import { KpiRow, type KpiBlockProps } from "@/components/ds/kpi";
import { DateRangePicker } from "@/components/ds/date-range-picker";
import { DataTable, type TableColumn } from "@/components/ds/data-table";
import { ErrorState } from "@/components/ds/error-state";
import { InfoAlert } from "@/components/ds/InfoAlert";
import { SectionRuleHeading } from "@/components/layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

// ── Types ─────────────────────────────────────────────────────────────────────

interface MetricsWindow {
  conversations: number;
  messages: number;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  feedbackUp: number;
  feedbackDown: number;
}

interface SeriesEntry {
  date: string;
  messages: number;
  tokens: number;
  cost: number;
}

interface ModelEntry {
  id: string;
  model: string;
  provider: string;
  calls: number;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  share: number;
  estimated: boolean;
}

interface HealthData {
  generatedAt: string;
  windows: { last24h: MetricsWindow; last7d: MetricsWindow; last30d: MetricsWindow };
  series: SeriesEntry[];
  modelBreakdown: ModelEntry[];
  quality: {
    totalToolCalls: number;
    messagesWithToolTrace: number;
    avgToolCallsPerMessage: number;
    telemetryCoverage: number;
    messagesWithUnknownModel: number;
  };
  learning: {
    feedbackEvents7d: number;
    candidateLearnings: number;
    activeLearnings: number;
  };
  sourceCoverage: {
    days: number;
    from: string;
    to: string;
    preset: "1d" | "3d" | "7d" | "14d" | "custom";
    rows: {
      family: string;
      label: string;
      sourceRowsInRange: number;
      docsWithEmbeddedChunks: number;
      terminalUnembeddable: number;
      actionableMissingEmbeddings: number;
      coverageRatio: number | null;
      newestSourceCreatedAt: string | null;
      missingSamples: { id: string; title: string | null; createdAt: string | null }[];
    }[];
  };
  pipeline: {
    succeeded: number;
    failed: number;
    total: number;
    lastFailures: { source: string; stage: string; finishedAt: string; errorMessage: string }[];
  };
  flags: { sampleTruncated: boolean; sampleSize: number };
}

type CoveragePreset = "1d" | "3d" | "7d" | "14d" | "custom";

// ── Local helpers ──────────────────────────────────────────────────────────────

function formatCost(value: number): string {
  if (value > 0 && value < 0.01) return "<$0.01";
  return formatCurrency(value);
}

function formatRelative(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${formatNumber(n / 1_000_000, 1)}M`;
  if (n >= 1_000) return `${formatNumber(n / 1_000, 1)}K`;
  return formatNumber(n, 0);
}

function formatPercent(value: number | null): string {
  if (value === null) return "n/a";
  return `${formatNumber(value * 100, 1)}%`;
}

function toDateInputValue(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatDateLabel(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00.000Z`));
}

function satisfactionRatio(up: number, down: number): { value: string; positive: boolean } {
  const total = up + down;
  if (total === 0) return { value: "—", positive: true };
  const pct = Math.round((up / total) * 100);
  return { value: `${pct}%`, positive: pct >= 70 };
}

// ── MetricBlock ───────────────────────────────────────────────────────────────

function MetricBlock({
  icon,
  label,
  value,
  description,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  description?: string;
  tone?: "warning" | "critical";
}) {
  return (
    <div className="rounded-lg bg-muted/60 p-4">
      <div className="mb-2 flex items-center gap-2 text-muted-foreground">
        <span className="h-4 w-4">{icon}</span>
        <span
          className={cn(
            "text-[10px] font-bold uppercase tracking-[0.08em]",
            tone === "critical" && "text-destructive",
            tone === "warning" && "text-warning",
          )}
        >
          {label}
        </span>
      </div>
      <p
        className={cn(
          "text-2xl font-bold leading-none tracking-tight tabular-nums",
          tone === "critical" && "text-destructive",
          tone === "warning" && "text-warning",
        )}
      >
        {value}
      </p>
      {description && <p className="mt-1 text-[11px] text-muted-foreground">{description}</p>}
    </div>
  );
}

// ── Daily trend sparkline ─────────────────────────────────────────────────────

function DailyTrendChart({ series }: { series: SeriesEntry[] }) {
  if (!series.length) return null;
  const maxMessages = Math.max(...series.map((s) => s.messages), 1);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="flex h-16 items-end gap-0.5" aria-label="30-day message trend">
      {series.map((s) => {
        const height = Math.max(2, Math.round((s.messages / maxMessages) * 56));
        const isToday = s.date === today;
        return (
          <div
            key={s.date}
            title={`${s.date}: ${s.messages} msgs`}
            className={cn(
              "flex-1 rounded-sm transition-colors",
              isToday ? "bg-primary" : "bg-muted-foreground/25",
            )}
            style={{ height: `${height}px` }}
          />
        );
      })}
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

export function AiSystemHealthPanel() {
  const [data, setData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [coveragePreset, setCoveragePreset] = useState<CoveragePreset>("14d");
  const [customCoverageRange, setCustomCoverageRange] = useState<DateRange | undefined>();

  const load = useCallback(async () => {
    const params = new URLSearchParams();

    if (coveragePreset === "custom") {
      if (!customCoverageRange?.from || !customCoverageRange?.to) {
        return;
      }
      params.set("coverageFrom", toDateInputValue(customCoverageRange.from));
      params.set("coverageTo", toDateInputValue(customCoverageRange.to));
    } else {
      params.set("coverageWindowDays", coveragePreset.replace("d", ""));
    }

    setLoading(true);
    setError(null);
    try {
      const result = await apiFetch<HealthData>(`/api/admin/ai-system-health?${params.toString()}`);
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load AI health data.");
    } finally {
      setLoading(false);
    }
  }, [coveragePreset, customCoverageRange]);

  useEffect(() => { void load(); }, [load]);

  const applyCoveragePreset = useCallback((value: string) => {
    if (!value) return;
    const preset = value as CoveragePreset;
    startTransition(() => {
      setCoveragePreset(preset);
    });
  }, []);

  const handleCustomCoverageChange = useCallback((range: DateRange | undefined) => {
    setCustomCoverageRange(range);
    startTransition(() => {
      setCoveragePreset("custom");
    });
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-28 w-full rounded-lg" />
        <Skeleton className="h-20 w-full rounded-lg" />
        <Skeleton className="h-40 w-full rounded-lg" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <ErrorState
        title="Could not load AI health data"
        description={error ?? "Unknown error"}
        onRetry={load}
      />
    );
  }

  const { windows, series, modelBreakdown, quality, learning, sourceCoverage, pipeline, flags, generatedAt } = data;
  const w24 = windows.last24h;
  const w30 = windows.last30d;
  const sat = satisfactionRatio(w24.feedbackUp, w24.feedbackDown);

  const kpis: KpiBlockProps[] = [
    {
      label: "Conversations 24h",
      value: formatCompact(w24.conversations),
      context: `${formatCompact(w30.conversations)} over 30 days`,
    },
    {
      label: "Tokens 24h",
      value: formatCompact(w24.inputTokens + w24.outputTokens),
      context: `${formatCompact(w30.inputTokens + w30.outputTokens)} over 30 days`,
    },
    {
      label: "Spend 24h",
      value: formatCost(w24.cost),
      context: `${formatCost(w30.cost)} over 30 days`,
    },
    {
      label: "Satisfaction 24h",
      value: sat.value,
      delta: (w24.feedbackUp + w24.feedbackDown) > 0 ? { value: sat.value, positive: sat.positive } : undefined,
      context: `${w24.feedbackUp} up · ${w24.feedbackDown} down`,
    },
  ];

  // Model breakdown table columns
  const modelColumns: TableColumn<ModelEntry>[] = [
    {
      key: "model",
      header: "Model",
      primary: true,
      render: (row) => (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-mono text-[11px]">{row.model || "unknown"}</span>
          <Badge variant="secondary" className="text-[10px]">{row.provider}</Badge>
          {row.estimated && <Badge variant="outline" className="text-[10px]">est. price</Badge>}
        </div>
      ),
    },
    { key: "calls", header: "Calls", align: "right", render: (row) => formatNumber(row.calls, 0) },
    { key: "input", header: "Input tokens", align: "right", render: (row) => formatCompact(row.inputTokens) },
    { key: "output", header: "Output tokens", align: "right", render: (row) => formatCompact(row.outputTokens) },
    { key: "cost", header: "Est. cost", align: "right", render: (row) => formatCost(row.cost) },
    {
      key: "share",
      header: "% of spend",
      align: "right",
      render: (row) => `${formatNumber(row.share * 100, 1)}%`,
    },
  ];

  const modelRows = modelBreakdown.map((m, i) => ({ ...m, id: m.model || `unknown-${i}` }));

  // Pipeline failure table
  type FailureRow = { id: string; source: string; stage: string; finishedAt: string; errorMessage: string };
  const failureColumns: TableColumn<FailureRow>[] = [
    { key: "source", header: "Source", primary: true, render: (r) => r.source },
    { key: "stage", header: "Stage", render: (r) => r.stage },
    { key: "when", header: "When", align: "right", render: (r) => formatRelative(r.finishedAt) },
    { key: "error", header: "Error", render: (r) => <span className="text-[11px] text-destructive">{r.errorMessage}</span> },
  ];
  const failureRows: FailureRow[] = pipeline.lastFailures.map((f, i) => ({ ...f, id: `fail-${i}` }));

  type SourceCoverageTableRow = HealthData["sourceCoverage"]["rows"][number] & { id: string };
  const sourceCoverageColumns: TableColumn<SourceCoverageTableRow>[] = [
    {
      key: "source",
      header: "Source",
      primary: true,
      render: (row) => (
        <div
          className="flex flex-wrap items-center gap-2"
          title={
            row.missingSamples.length > 0
              ? `Examples: ${row.missingSamples.map((sample) => sample.title || sample.id).join("; ")}`
              : undefined
          }
        >
          <span>{row.label}</span>
          {row.actionableMissingEmbeddings > 0 ? (
            <Badge variant="destructive" className="text-[10px]">
              {formatNumber(row.actionableMissingEmbeddings, 0)} missing
            </Badge>
          ) : (
            <Badge variant="secondary" className="text-[10px]">
              covered
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: "coverage",
      header: "Embedded",
      align: "right",
      render: (row) => (
        <span className={cn(row.actionableMissingEmbeddings > 0 && "text-destructive")}>
          {formatNumber(row.docsWithEmbeddedChunks, 0)}/
          {formatNumber(row.sourceRowsInRange - row.terminalUnembeddable, 0)}
        </span>
      ),
    },
    {
      key: "coveragePct",
      header: "Coverage",
      align: "right",
      render: (row) => formatPercent(row.coverageRatio),
    },
    {
      key: "excluded",
      header: "Excluded",
      align: "right",
      render: (row) => formatNumber(row.terminalUnembeddable, 0),
    },
    {
      key: "newest",
      header: "Newest source",
      align: "right",
      render: (row) => row.newestSourceCreatedAt ? formatRelative(row.newestSourceCreatedAt) : "n/a",
    },
  ];
  const sourceCoverageRows = sourceCoverage.rows.map((row) => ({ ...row, id: row.family }));
  const sourceCoverageLabel = sourceCoverage.preset === "custom"
    ? `${formatDateLabel(sourceCoverage.from.slice(0, 10))} - ${formatDateLabel(sourceCoverage.to.slice(0, 10))}`
    : `${sourceCoverage.days}d`;

  return (
    <div className="space-y-8">
      {/* Header bar */}
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          Updated {formatRelative(generatedAt)} · sample size {formatCompact(flags.sampleSize)} rows
          {flags.sampleTruncated && " (truncated)"}
        </p>
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </Button>
      </div>

      {/* KPI row */}
      <KpiRow metrics={kpis} size="large" />

      {/* Truncation warning */}
      {flags.sampleTruncated && (
        <InfoAlert variant="warning">
          Sample truncated at {formatNumber(flags.sampleSize, 0)} rows. Aggregates cover the most recent messages within the limit — older activity is not included.
        </InfoAlert>
      )}

      {/* 30-day trend */}
      <div>
        <SectionRuleHeading label="30-day trend" />
        <div className="rounded-lg bg-muted/40 p-4">
          <div className="mb-3 flex gap-6 text-[11px] text-muted-foreground">
            <span>{formatCompact(w30.messages)} messages</span>
            <span>{formatCompact(w30.inputTokens + w30.outputTokens)} tokens</span>
            <span>{formatCost(w30.cost)} est. spend</span>
          </div>
          <DailyTrendChart series={series} />
        </div>
      </div>

      {/* Models in use */}
      <div>
        <SectionRuleHeading label="Models in use" />
        <DataTable
          columns={modelColumns}
          rows={modelRows}
          emptyMessage="No model usage recorded yet."
        />
      </div>

      {/* Self-learning loop */}
      <div>
        <SectionRuleHeading label="Self-learning loop" />
        <div className="grid gap-3 sm:grid-cols-3">
          <MetricBlock
            icon={<Sparkles className="h-4 w-4" />}
            label="Feedback events 7d"
            value={formatNumber(learning.feedbackEvents7d, 0)}
            description="User thumbs up/down captured in last 7 days"
          />
          <MetricBlock
            icon={<Brain className="h-4 w-4" />}
            label="Candidate learnings"
            value={formatNumber(learning.candidateLearnings, 0)}
            description="Awaiting promotion review"
          />
          <MetricBlock
            icon={<CheckCircle2 className="h-4 w-4" />}
            label="Active rules"
            value={formatNumber(learning.activeLearnings, 0)}
            description="Promoted and active in retrieval"
          />
        </div>
      </div>

      {/* Tool calling activity */}
      <div>
        <SectionRuleHeading label="Tool calling activity" />
        <div className="grid gap-3 sm:grid-cols-3">
          <MetricBlock
            icon={<Wrench className="h-4 w-4" />}
            label="Tool calls 30d"
            value={formatNumber(quality.totalToolCalls, 0)}
            description="Total tool invocations in sample"
          />
          <MetricBlock
            icon={<Wrench className="h-4 w-4" />}
            label="Avg tools per response"
            value={formatNumber(quality.avgToolCallsPerMessage, 2)}
            description="Across all assistant messages"
          />
          <MetricBlock
            icon={<Wrench className="h-4 w-4" />}
            label="Telemetry coverage"
            value={`${formatNumber(quality.telemetryCoverage * 100, 1)}%`}
            description="Messages with tool_trace metadata"
          />
        </div>
      </div>

      {/* Ingestion pipeline */}
      <div>
        <SectionRuleHeading label="Ingestion pipeline · last 24h" />
        <div className="grid gap-3 sm:grid-cols-3">
          <MetricBlock
            icon={<CheckCircle2 className="h-4 w-4" />}
            label="Successful"
            value={formatNumber(pipeline.succeeded, 0)}
          />
          <MetricBlock
            icon={<CheckCircle2 className="h-4 w-4" />}
            label="Failed"
            value={formatNumber(pipeline.failed, 0)}
            tone={pipeline.failed >= 5 ? "critical" : pipeline.failed >= 1 ? "warning" : undefined}
          />
          <MetricBlock
            icon={<CheckCircle2 className="h-4 w-4" />}
            label="Total runs"
            value={formatNumber(pipeline.total, 0)}
          />
        </div>

        {failureRows.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-[11px] font-medium text-destructive">Recent failures</p>
            <DataTable
              columns={failureColumns}
              rows={failureRows}
              emptyMessage="No recent failures."
            />
          </div>
        )}
      </div>

      <div>
        <SectionRuleHeading
          label={`Source embedding coverage · ${sourceCoverageLabel}`}
          actions={(
            <div className="flex flex-wrap items-center justify-end gap-2">
              <ToggleGroup
                type="single"
                value={coveragePreset}
                onValueChange={applyCoveragePreset}
                variant="outline"
                size="sm"
                spacing={0}
              >
                <ToggleGroupItem value="1d" aria-label="1 day">1d</ToggleGroupItem>
                <ToggleGroupItem value="3d" aria-label="3 days">3d</ToggleGroupItem>
                <ToggleGroupItem value="7d" aria-label="7 days">7d</ToggleGroupItem>
                <ToggleGroupItem value="14d" aria-label="14 days">14d</ToggleGroupItem>
                <ToggleGroupItem value="custom" aria-label="Custom dates">Custom</ToggleGroupItem>
              </ToggleGroup>
              <DateRangePicker
                value={customCoverageRange}
                onChange={handleCustomCoverageChange}
                className="h-8 w-64"
                placeholder="Custom dates"
              />
            </div>
          )}
        />
        <DataTable
          columns={sourceCoverageColumns}
          rows={sourceCoverageRows}
          emptyMessage="No source coverage rows found."
        />
        {coveragePreset === "custom" && (!customCoverageRange?.from || !customCoverageRange?.to) && (
          <p className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
            <CalendarRange className="h-3.5 w-3.5" />
            Select a start and end date to load custom source coverage.
          </p>
        )}
      </div>
    </div>
  );
}
