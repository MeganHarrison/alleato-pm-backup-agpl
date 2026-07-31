"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowUpRight, CircleAlert, Loader2, RefreshCw } from "lucide-react";
import {
  Cell,
  Pie,
  PieChart as RechartsPieChart,
  ResponsiveContainer,
} from "recharts";

import { Heading } from "@/components/ds";
import { Button } from "@/components/ui/button";
import { AreaChart } from "@/components/ui/charts";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type {
  ActivityCategory,
  ActivityRange,
  ExecutiveDashboardVisualizations,
  LifecycleMetric,
  LifecycleStage,
  OpportunityCategory,
  SourceState,
  VisualizationDetailKind,
} from "@/lib/ai-dashboard/dashboard-visualization-contract";
import { cn } from "@/lib/utils";
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  sourceError,
  useAttentionFeed,
  useDashboardVisualizations,
} from "../live-data";
import {
  VisualizationDetailSlideover,
  type VisualizationSelection,
} from "./visualization-detail-slideover";

const rangeLabels: Record<ActivityRange, string> = {
  today: "Today",
  "24h": "24 hours",
  "7d": "7 days",
  "30d": "30 days",
};

const metricLabels: Record<LifecycleMetric, string> = {
  count: "Count",
  value: "Value",
  weightedValue: "Weighted",
};

const activitySeries = {
  communication: "Communication",
  financial: "Financial",
  project_delivery: "Project delivery",
  intelligence: "Intelligence",
} as const;

const wheelColors = [
  "hsl(var(--primary))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "hsl(var(--muted-foreground))",
];

function SourceLine({
  source,
  showDetail = true,
}: {
  source: SourceState;
  showDetail?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
      {showDetail ? (
        <>
          <span
            className={cn(
              "size-1.5 rounded-full",
              source.status === "error" ? "bg-destructive" : "bg-primary",
            )}
          />
          <span>{source.detail}</span>
        </>
      ) : null}
      {source.status !== "ready" ? (
        <Link href={source.recoveryHref} className="font-medium text-primary hover:underline">
          Review source
        </Link>
      ) : null}
    </div>
  );
}

function LoadingVisualization() {
  return (
    <div className="flex min-h-72 items-center justify-center gap-2 rounded-xl bg-card text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" />
      Building the live portfolio view
    </div>
  );
}

function ErrorVisualization({ error }: { error: unknown }) {
  return (
    <div className="rounded-xl bg-card px-6 py-12">
      <div className="flex items-center gap-2 text-sm font-medium text-destructive">
        <CircleAlert className="size-4" />
        Portfolio visualizations could not be loaded
      </div>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        {sourceError(error, "Executive dashboard sources")}
      </p>
      <Link
        href="/ai-dashboard/rag-pipeline"
        className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
      >
        Review source pipeline <ArrowUpRight className="size-3" />
      </Link>
    </div>
  );
}

function metricValue(stage: LifecycleStage, metric: LifecycleMetric) {
  if (metric === "count") return stage.projectCount;
  if (metric === "weightedValue") return stage.weightedValue;
  return stage.totalValue;
}

function formatMetric(value: number, metric: LifecycleMetric) {
  return metric === "count" ? value.toLocaleString() : formatCurrency(value, true);
}

function ProjectLifecycleFunnel({
  lifecycle,
  metric,
  onMetricChange,
  onSelect,
}: {
  lifecycle: ExecutiveDashboardVisualizations["lifecycle"];
  metric: LifecycleMetric;
  onMetricChange: (metric: LifecycleMetric) => void;
  onSelect: (kind: VisualizationDetailKind, key: string) => void;
}) {
  const max = Math.max(...lifecycle.stages.map((stage) => metricValue(stage, metric)), 1);

  return (
    <section className="rounded-xl bg-card p-5 sm:p-7" aria-labelledby="lifecycle-heading">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">
            Project lifecycle
          </p>
          <Heading level={4} as="h2" className="mt-2 text-xl font-semibold tracking-tight text-foreground">
            <span id="lifecycle-heading">Where work is concentrating</span>
          </Heading>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {lifecycle.insight}
          </p>
        </div>
        <div
          className="inline-flex w-fit rounded-md bg-muted p-1"
          role="group"
          aria-label="Lifecycle metric"
        >
          {(Object.keys(metricLabels) as LifecycleMetric[]).map((value) => (
            <Button
              key={value}
              type="button"
              variant="ghost"
              size="sm"
              aria-pressed={metric === value}
              onClick={() => onMetricChange(value)}
              className={cn(
                "min-h-9 rounded px-3 text-xs font-medium transition-colors",
                metric === value
                  ? "bg-background text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {metricLabels[value]}
            </Button>
          ))}
        </div>
      </div>

      <div className="mt-7 overflow-x-auto pb-2">
        <div className="grid min-w-5xl grid-cols-9 gap-1" aria-label="Lifecycle funnel">
          {lifecycle.stages.map((stage) => {
            const value = metricValue(stage, metric);
            const strength = Math.max(0.12, value / max);
            return (
              <Tooltip key={stage.key}>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => onSelect("lifecycle", stage.key)}
                    className="group flex h-auto min-h-36 flex-col items-stretch justify-end whitespace-normal rounded-md p-2 text-left"
                    aria-label={`${stage.label}: ${formatMetric(value, metric)}. Open stage detail.`}
                  >
                    <span
                      className="w-full rounded-sm bg-primary transition-[height,opacity] group-hover:opacity-100"
                      style={{
                        height: value === 0 ? "4px" : `${32 + strength * 48}px`,
                        opacity: value === 0 ? 0.14 : 0.18 + strength * 0.72,
                      }}
                    />
                    <span className="mt-3 text-xs font-medium leading-tight text-foreground">
                      {stage.label}
                    </span>
                    <span className="mt-1 text-xs tabular-nums text-muted-foreground">
                      {formatMetric(value, metric)}
                    </span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="max-w-64">
                  <p className="font-medium">{stage.label}</p>
                  <p className="mt-1 text-muted-foreground">
                    {stage.projectCount} records · {stage.valueCoverageCount} with value
                  </p>
                  <p className="mt-1 text-muted-foreground">{stage.healthReason}</p>
                  <p className="mt-1 text-muted-foreground">
                    Stage age and conversion are unavailable.
                  </p>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </div>
      <p className="mt-1 text-xs text-muted-foreground lg:hidden">
        Swipe horizontally to review all nine stages.
      </p>

      <div className="mt-5 flex flex-col gap-3 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <SourceLine source={lifecycle.source} showDetail={false} />
        <p className="shrink-0 text-xs text-muted-foreground">
          {lifecycle.totalRecords} records · {lifecycle.valueCoverageCount} with value ·{" "}
          {lifecycle.incompleteRecordCount} unmapped
        </p>
      </div>
    </section>
  );
}

function ActivityCategoryButton({
  category,
  onClick,
}: {
  category: ActivityCategory;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      onClick={onClick}
      className="flex h-auto min-h-20 flex-col items-stretch rounded-md px-3 py-3 text-left whitespace-normal"
    >
      <span className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-foreground">{category.label}</span>
        <span className="font-mono text-lg font-semibold tabular-nums text-foreground">
          {category.total.toLocaleString()}
        </span>
      </span>
      <span className="mt-2 block text-xs text-muted-foreground">
        {category.requiresActionCount} requiring action
        {category.highRiskCount ? ` · ${category.highRiskCount} high risk` : ""}
      </span>
    </Button>
  );
}

function ActivityRiver({
  activity,
  onSelect,
}: {
  activity: ExecutiveDashboardVisualizations["activity"];
  onSelect: (kind: VisualizationDetailKind, key: string) => void;
}) {
  const chartData = activity.buckets.map((bucket) => ({
    date: bucket.label,
    Communication: bucket.communication,
    Financial: bucket.financial,
    "Project delivery": bucket.project_delivery,
    Intelligence: bucket.intelligence,
  }));

  return (
    <section className="rounded-xl bg-card p-5 sm:p-7" aria-labelledby="activity-heading">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">
            Activity river
          </p>
          <Heading level={4} as="h2" className="mt-2 text-xl font-semibold tracking-tight text-foreground">
            <span id="activity-heading">What changed across the portfolio</span>
          </Heading>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {activity.insight}
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          {activity.totalEvents.toLocaleString()} returned events · {activity.activeProjectCount} active projects
        </p>
      </div>

      {activity.totalEvents > 0 && chartData.length ? (
        <AreaChart
          data={chartData}
          categories={Object.values(activitySeries)}
          colors={wheelColors.slice(0, 4)}
          stack
          yAxisWidth={38}
          height="280px"
          className="mt-7"
        />
      ) : (
        <div className="mt-7 flex h-56 items-center justify-center text-sm text-muted-foreground">
          No source activity exists in this range.
        </div>
      )}

      <div className="mt-4 grid gap-1 sm:grid-cols-2 xl:grid-cols-4">
        {activity.categories.map((category) => (
          <ActivityCategoryButton
            key={category.key}
            category={category}
            onClick={() => onSelect("activity", category.key)}
          />
        ))}
      </div>

      {activity.quietProjects.length ? (
        <p className="mt-4 text-xs text-muted-foreground">
          Quiet projects: {activity.quietProjects.slice(0, 3).map((project) => project.projectName).join(", ")}
        </p>
      ) : null}

      <div className="mt-5 pt-4">
        <SourceLine source={activity.source} />
      </div>
    </section>
  );
}

function OpportunityWheel({
  opportunities,
  onSelect,
}: {
  opportunities: ExecutiveDashboardVisualizations["opportunities"];
  onSelect: (kind: VisualizationDetailKind, key: string) => void;
}) {
  const chartRows = opportunities.categories.map((category) => ({
    ...category,
    chartValue: Math.max(category.count, 0.01),
  }));

  return (
    <section className="rounded-xl bg-card p-5 sm:p-7" aria-labelledby="opportunity-heading">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">
          AI opportunity wheel
        </p>
        <Heading level={4} as="h2" className="mt-2 text-xl font-semibold tracking-tight text-foreground">
          <span id="opportunity-heading">Where leadership can create leverage</span>
        </Heading>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          {opportunities.insight}
        </p>
      </div>

      <div className="mt-7 grid min-w-0 gap-8 lg:grid-cols-[minmax(17rem,0.8fr)_minmax(0,1.2fr)] lg:items-center">
        <div className="relative mx-auto h-72 w-full min-w-0 max-w-full overflow-hidden sm:max-w-sm" aria-hidden="true">
          <ResponsiveContainer width="100%" height="100%">
            <RechartsPieChart>
              <Pie
                data={chartRows}
                dataKey="chartValue"
                nameKey="label"
                innerRadius="64%"
                outerRadius="88%"
                paddingAngle={2}
                stroke="hsl(var(--card))"
                strokeWidth={2}
              >
                {chartRows.map((category, index) => (
                  <Cell key={category.key} fill={wheelColors[index]} />
                ))}
              </Pie>
            </RechartsPieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="font-mono text-4xl font-semibold tracking-tight text-foreground">
              {opportunities.activeOpportunityCount}
            </span>
            <span className="mt-1 text-xs text-muted-foreground">active inferences</span>
            <span className="mt-3 text-xs font-medium text-primary">
              {Math.round(opportunities.averageConfidence * 100)}% avg confidence
            </span>
          </div>
        </div>

        <div className="grid min-w-0 gap-1 sm:grid-cols-2">
          {opportunities.categories.map((category, index) => (
            <OpportunityCategoryButton
              key={category.key}
              category={category}
              color={wheelColors[index]}
              onClick={() => onSelect("opportunity", category.key)}
            />
          ))}
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-3 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <SourceLine source={opportunities.source} />
        <p className="shrink-0 text-xs text-muted-foreground">
          Impact value unavailable · no period comparison
        </p>
      </div>
    </section>
  );
}

function OpportunityCategoryButton({
  category,
  color,
  onClick,
}: {
  category: OpportunityCategory;
  color: string;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      onClick={onClick}
      className="flex h-auto min-h-24 min-w-0 flex-col items-stretch rounded-md p-3 text-left whitespace-normal"
    >
      <span className="flex items-center gap-2 text-sm font-medium text-foreground">
        <span className="size-2 rounded-full" style={{ backgroundColor: color }} />
        {category.label}
      </span>
      <span className="mt-2 block font-mono text-xl font-semibold tabular-nums text-foreground">
        {category.count}
      </span>
      <span className="mt-1 block truncate text-xs text-muted-foreground">
        {category.highestPriorityTitle || "No current candidate"}
      </span>
    </Button>
  );
}

function LeadershipQueue() {
  const attention = useAttentionFeed();

  return (
    <section aria-labelledby="leadership-queue-heading" className="px-1">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">
            Leadership queue
          </p>
          <Heading level={4} as="h2" className="mt-2 text-xl font-semibold tracking-tight text-foreground">
            <span id="leadership-queue-heading">Decisions waiting on an owner</span>
          </Heading>
        </div>
        <Link href="/ai-dashboard/decisions" className="text-sm font-medium text-primary hover:underline">
          All decisions
        </Link>
      </div>

      {attention.isLoading ? (
        <div className="flex min-h-36 items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading decisions
        </div>
      ) : attention.isError ? (
        <p className="mt-6 text-sm text-destructive">
          {sourceError(attention.error, "Leadership queue")}
        </p>
      ) : attention.data?.items.length ? (
        <div className="mt-5 divide-y divide-border">
          {attention.data.items.slice(0, 3).map((item) => (
            <article key={item.id} className="grid gap-3 py-5 md:grid-cols-[minmax(7rem,0.35fr)_minmax(0,1.5fr)_minmax(8rem,0.45fr)]">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-primary">
                  {item.priority || "Unranked"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {item.dueAt ? `Due ${formatDate(item.dueAt)}` : "No due date"}
                </p>
              </div>
              <div>
                <Heading level={6} as="h3" className="text-sm font-medium text-foreground">{item.title}</Heading>
                <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                  {item.summary}
                </p>
              </div>
              <div className="text-sm text-muted-foreground md:text-right">
                <p>{item.accountableOwnerLabel || "Unassigned"}</p>
                <Link
                  href={item.projectId ? `/${item.projectId}/home` : "/daily-brief"}
                  className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  Open <ArrowUpRight className="size-3" />
                </Link>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="mt-6 text-sm text-muted-foreground">
          No executive decisions are currently waiting on action.
        </p>
      )}
    </section>
  );
}

export function ExecutiveDashboardVisualizations() {
  const [range, setRange] = useState<ActivityRange>("7d");
  const [projectId, setProjectId] = useState<number | null>(null);
  const [metric, setMetric] = useState<LifecycleMetric>("count");
  const [selection, setSelection] = useState<VisualizationSelection>(null);
  const visualization = useDashboardVisualizations(range, projectId);

  const generatedAt = useMemo(
    () => formatDateTime(visualization.data?.generatedAt),
    [visualization.data?.generatedAt],
  );

  const selectDetail = (kind: VisualizationDetailKind, key: string) => {
    setSelection({ kind, key });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">
            Portfolio intelligence
          </p>
          <Heading level={3} as="h2" className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            The operating picture, from signal to action
          </Heading>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            Follow work through its lifecycle, see where activity changed, and open the evidence behind AI-ranked opportunities.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Select
            value={projectId === null ? "all" : String(projectId)}
            onValueChange={(value) => setProjectId(value === "all" ? null : Number(value))}
          >
            <SelectTrigger size="sm" className="w-full sm:w-56" aria-label="Filter visualizations by project">
              <SelectValue placeholder="All projects" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All projects</SelectItem>
              {visualization.data?.filters.projects.map((project) => (
                <SelectItem key={project.id} value={String(project.id)}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={range} onValueChange={(value) => setRange(value as ActivityRange)}>
            <SelectTrigger size="sm" className="w-full sm:w-36" aria-label="Activity range">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(rangeLabels) as ActivityRange[]).map((value) => (
                <SelectItem key={value} value={value}>{rangeLabels[value]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => visualization.refetch()}
            disabled={visualization.isFetching}
            aria-label="Refresh portfolio visualizations"
            className="inline-flex min-h-9 items-center justify-center gap-2 rounded-md px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
          >
            <RefreshCw className={cn("size-3.5", visualization.isFetching && "animate-spin")} />
            {generatedAt}
          </Button>
        </div>
      </div>

      {visualization.isLoading ? (
        <LoadingVisualization />
      ) : visualization.isError ? (
        <ErrorVisualization error={visualization.error} />
      ) : visualization.data ? (
        <>
          <ProjectLifecycleFunnel
            lifecycle={visualization.data.lifecycle}
            metric={metric}
            onMetricChange={setMetric}
            onSelect={selectDetail}
          />
          <ActivityRiver activity={visualization.data.activity} onSelect={selectDetail} />
          <OpportunityWheel opportunities={visualization.data.opportunities} onSelect={selectDetail} />
          <LeadershipQueue />
        </>
      ) : null}

      <VisualizationDetailSlideover
        selection={selection}
        onOpenChange={(open) => !open && setSelection(null)}
        range={range}
        projectId={projectId}
      />
    </div>
  );
}
