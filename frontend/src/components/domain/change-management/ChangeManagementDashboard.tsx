"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText,
  ScrollText,
  FileCheck2,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Clock,
  ChevronRight,
  Zap,
  ArrowUpRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { KpiRow, StatusBadge, Skeleton } from "@/components/ds";
import {
  useChangeManagement,
  type StageSummary,
  type PipelineItem,
  type PipelineStage,
  type ChangeManagementMetrics,
} from "@/hooks/use-change-management";

// =============================================================================
// Constants
// =============================================================================

const STAGE_CONFIG: Record<
  PipelineStage,
  {
    icon: React.ElementType;
    accent: string;
    barColor: string;
    href: (pid: string) => string;
  }
> = {
  change_event: {
    icon: FileText,
    accent: "text-primary",
    barColor: "bg-primary",
    href: (pid) => `/${pid}/change-events`,
  },
  potential_change_order: {
    icon: ScrollText,
    accent: "text-primary",
    barColor: "bg-primary",
    href: (pid) => `/${pid}/prime-contract-pcos`,
  },
  official_change_order: {
    icon: FileCheck2,
    accent: "text-primary",
    barColor: "bg-primary",
    href: (pid) => `/${pid}/change-orders`,
  },
};

const spring = { type: "spring" as const, stiffness: 120, damping: 18 };
const stagger = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.1 },
  },
};
const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: spring },
};

// =============================================================================
// Helpers
// =============================================================================

function formatCurrency(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000)
    return `${value < 0 ? "-" : ""}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000)
    return `${value < 0 ? "-" : ""}$${(abs / 1_000).toFixed(0)}K`;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function getStatusGroups(items: PipelineItem[]): Record<string, PipelineItem[]> {
  const groups: Record<string, PipelineItem[]> = {};
  for (const item of items) {
    const key = item.status;
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
  }
  return groups;
}

function getItemHref(item: PipelineItem, projectId: string): string {
  if (item.stage === "change_event") {
    return `/${projectId}/change-events/${item.id.replace("ce-", "")}`;
  }
  if (item.kind === "prime_pco") {
    return `/${projectId}/prime-contract-pcos/${item.id.replace("prime-pco-", "")}`;
  }
  if (item.kind === "commitment_pco") {
    return `/${projectId}/commitment-pcos/${item.id.replace("commitment-pco-", "")}`;
  }
  if (item.kind === "prime_co") {
    return `/${projectId}/change-orders/prime/${item.id.replace("prime-co-", "")}`;
  }
  if (item.kind === "commitment_co") {
    return `/${projectId}/change-orders/commitment/${item.id.replace("commitment-co-", "")}`;
  }
  return `/${projectId}/change-orders`;
}

// =============================================================================
// Pipeline Funnel — horizontal flow visualization
// =============================================================================

function PipelineFunnel({
  stages,
  projectId,
}: {
  stages: StageSummary[];
  projectId: string;
}) {
  return (
    <motion.div
      variants={stagger}
      initial="hidden"
      animate="show"
      className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto_1fr_auto_1fr]"
    >
      {stages.map((stage, i) => {
        const config = STAGE_CONFIG[stage.stage];
        const Icon = config.icon;

        return (
          <React.Fragment key={stage.stage}>
            <motion.div variants={fadeUp}>
              <Link
                href={config.href(projectId)}
                className="group relative flex flex-col gap-3 rounded-2xl bg-muted/40 p-5 transition-colors hover:bg-muted/70"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={cn(
                        "flex h-9 w-9 items-center justify-center rounded-xl bg-background",
                        config.accent,
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        {stage.label}
                      </p>
                      <p className="text-2xl font-semibold tracking-tight text-foreground">
                        {stage.total}
                      </p>
                    </div>
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-muted-foreground" />
                </div>

                <div className="flex items-center justify-between border-t border-border/50 pt-3">
                  <span className="text-xs text-muted-foreground">
                    {stage.active} active
                  </span>
                  <span className="font-mono text-sm font-medium text-foreground tabular-nums">
                    {formatCurrency(stage.value)}
                  </span>
                </div>

                {/* Stage progress bar */}
                <div className="h-1 w-full overflow-hidden rounded-full bg-border/50">
                  <motion.div
                    className={cn("h-full rounded-full", config.barColor)}
                    initial={{ width: 0 }}
                    animate={{
                      width:
                        stage.total > 0
                          ? `${(stage.active / stage.total) * 100}%`
                          : "0%",
                    }}
                    transition={{ ...spring, delay: 0.3 + i * 0.15 }}
                  />
                </div>
              </Link>
            </motion.div>

            {/* Connector arrow */}
            {i < stages.length - 1 && (
              <motion.div
                variants={fadeUp}
                className="hidden items-center justify-center md:flex"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted/60">
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </motion.div>
            )}
          </React.Fragment>
        );
      })}
    </motion.div>
  );
}

// =============================================================================
// Workflow Card — individual item in kanban column
// =============================================================================

const WorkflowCard = React.memo(function WorkflowCard({
  item,
  projectId,
}: {
  item: PipelineItem;
  projectId: string;
}) {
  return (
    <motion.div variants={fadeUp} layout layoutId={item.id}>
      <Link
        href={getItemHref(item, projectId)}
        className="group flex flex-col gap-1.5 rounded-xl bg-background px-3.5 py-3 transition-all hover:bg-muted/30"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-xs font-medium text-muted-foreground">
            {item.number}
          </span>
          <StatusBadge status={item.status} />
        </div>
        <p className="line-clamp-1 text-sm font-medium text-foreground">
          {item.title}
        </p>
        <div className="flex items-center justify-between">
          {item.value !== 0 ? (
            <span className="font-mono text-xs font-medium tabular-nums text-foreground">
              {formatCurrency(item.value)}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">No value</span>
          )}
          {item.updatedAt && (
            <span className="text-xs text-muted-foreground/60">
              {formatDistanceToNow(new Date(item.updatedAt), {
                addSuffix: true,
              })}
            </span>
          )}
        </div>
        {item.stage === "potential_change_order" && (
          <span className="text-xs text-muted-foreground">
            {item.isConverted ? "Bundled into a CO" : "Awaiting formal CO"}
          </span>
        )}
      </Link>
    </motion.div>
  );
});

// =============================================================================
// Stage Column — kanban column for a pipeline stage
// =============================================================================

function StageColumn({
  stage,
  projectId,
  maxItems = 8,
}: {
  stage: StageSummary;
  projectId: string;
  maxItems?: number;
}) {
  const config = STAGE_CONFIG[stage.stage];
  const Icon = config.icon;
  const visibleItems = stage.items.slice(0, maxItems);
  const overflow = stage.total - visibleItems.length;

  const statusGroups = getStatusGroups(visibleItems);
  const groupKeys = Object.keys(statusGroups);

  return (
    <div className="flex flex-col gap-3">
      {/* Column header */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <Icon className={cn("h-4 w-4", config.accent)} />
          <span className="text-sm font-semibold text-foreground">
            {stage.label}
          </span>
          <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
            {stage.total}
          </span>
        </div>
        <Link
          href={config.href(projectId)}
          className="text-xs font-medium text-primary hover:underline"
        >
          View all
        </Link>
      </div>

      {/* Items grouped by status */}
      {visibleItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl bg-muted/30 py-10">
          <Icon className="h-6 w-6 text-muted-foreground/40" />
          <p className="text-xs text-muted-foreground">
            No {stage.label.toLowerCase()} yet
          </p>
        </div>
      ) : (
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="show"
          className="flex flex-col gap-1"
        >
          <AnimatePresence>
            {groupKeys.map((status) => (
              <div key={status} className="flex flex-col gap-1">
                {statusGroups[status].map((item) => (
                  <WorkflowCard
                    key={item.id}
                    item={item}
                    projectId={projectId}
                  />
                ))}
              </div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      {overflow > 0 && (
        <Link
          href={config.href(projectId)}
          className="flex items-center gap-1.5 px-1 text-xs font-medium text-primary hover:underline"
        >
          +{overflow} more <ArrowRight className="h-3 w-3" />
        </Link>
      )}
    </div>
  );
}

// =============================================================================
// Activity Timeline
// =============================================================================

function ActivityTimeline({ items }: { items: PipelineItem[] }) {
  if (items.length === 0) return null;

  return (
    <motion.div
      variants={stagger}
      initial="hidden"
      animate="show"
      className="flex flex-col gap-3"
    >
      <div className="flex items-center gap-2 px-1">
        <Clock className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-semibold text-foreground">
          Recent Activity
        </span>
      </div>

      <div className="flex flex-col">
        {items.map((item, i) => {
          const config = STAGE_CONFIG[item.stage];
          const Icon = config.icon;
          return (
            <motion.div
              key={item.id}
              variants={fadeUp}
              className="group relative flex gap-3 py-2.5"
            >
              {/* Timeline line */}
              {i < items.length - 1 && (
                <div className="absolute left-[11px] top-10 h-[calc(100%-16px)] w-px bg-border/60" />
              )}
              <div
                className={cn(
                  "relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-muted/60",
                  config.accent,
                )}
              >
                <Icon className="h-3 w-3" />
              </div>
              <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm text-foreground">
                    <span className="font-mono text-xs text-muted-foreground">
                      {item.number}
                    </span>{" "}
                    {item.title}
                  </p>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={item.status} />
                    {item.value !== 0 && (
                      <span className="font-mono text-xs tabular-nums text-muted-foreground">
                        {formatCurrency(item.value)}
                      </span>
                    )}
                  </div>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground/60">
                  {item.updatedAt
                    ? formatDistanceToNow(new Date(item.updatedAt), {
                        addSuffix: true,
                      })
                    : ""}
                </span>
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}

// =============================================================================
// Conversion Metrics — secondary KPIs
// =============================================================================

function ConversionMetrics({ metrics }: { metrics: ChangeManagementMetrics }) {
  return (
    <motion.div
      variants={stagger}
      initial="hidden"
      animate="show"
      className="grid grid-cols-1 gap-3 sm:grid-cols-3"
    >
      <motion.div
        variants={fadeUp}
        className="flex items-center gap-3 rounded-xl bg-muted/30 px-4 py-3"
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-background">
          <Zap className="h-4 w-4 text-primary" />
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Conversion Rate
          </p>
          <p className="font-mono text-lg font-semibold tabular-nums text-foreground">
            {metrics.conversionRate.toFixed(1)}%
          </p>
        </div>
      </motion.div>

      <motion.div
        variants={fadeUp}
        className="flex items-center gap-3 rounded-xl bg-muted/30 px-4 py-3"
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-background">
          <Clock className="h-4 w-4 text-primary" />
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Avg Cycle Time
          </p>
          <p className="font-mono text-lg font-semibold tabular-nums text-foreground">
            {metrics.avgCycleTimeDays !== null
              ? `${metrics.avgCycleTimeDays}d`
              : "--"}
          </p>
        </div>
      </motion.div>

      <motion.div
        variants={fadeUp}
        className="flex items-center gap-3 rounded-xl bg-muted/30 px-4 py-3"
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-background">
          {metrics.netContractImpact >= 0 ? (
            <TrendingUp className="h-4 w-4 text-primary" />
          ) : (
            <TrendingDown className="h-4 w-4 text-destructive" />
          )}
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Net Impact
          </p>
          <p className="font-mono text-lg font-semibold tabular-nums text-foreground">
            {formatCurrency(metrics.netContractImpact)}
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}

// =============================================================================
// Loading Skeleton
// =============================================================================

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-8">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-36 rounded-2xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1.2fr_1fr]">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-2">
            <Skeleton className="h-6 w-32 rounded" />
            {Array.from({ length: 3 }).map((_, j) => (
              <Skeleton key={j} className="h-20 rounded-xl" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// Main Dashboard
// =============================================================================

export function ChangeManagementDashboard() {
  const { projectId } = useParams<{ projectId: string }>()!;
  const { isLoading, metrics, stages, recentActivity } =
    useChangeManagement(projectId);

  if (isLoading) return <DashboardSkeleton />;

  return (
    <div className="flex flex-col gap-8">
      {/* 1 — Primary KPIs */}
      <KpiRow
        metrics={[
          { label: "Change Events", value: String(metrics.totalCEs) },
          { label: "Potential Change Orders", value: String(metrics.totalPCOs) },
          { label: "Official Change Orders", value: String(metrics.totalOfficialCOs) },
          {
            label: "Net Contract Impact",
            value: formatCurrency(metrics.netContractImpact),
          },
        ]}
      />

      {/* 2 — Pipeline funnel */}
      <PipelineFunnel stages={stages} projectId={projectId} />

      {/* 3 — Conversion metrics */}
      <ConversionMetrics metrics={metrics} />

      {/* 4 — Kanban board + activity timeline */}
      <div className="grid grid-cols-1 gap-8 xl:grid-cols-[1fr_320px]">
        {/* Kanban — asymmetric 3-col */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-[2fr_1.5fr_1.2fr]">
          {stages.map((stage) => (
            <StageColumn
              key={stage.stage}
              stage={stage}
              projectId={projectId}
            />
          ))}
        </div>

        {/* Activity timeline */}
        <div className="border-t border-border/50 pt-6 xl:border-l xl:border-t-0 xl:pl-6 xl:pt-0">
          <ActivityTimeline items={recentActivity} />
        </div>
      </div>
    </div>
  );
}
