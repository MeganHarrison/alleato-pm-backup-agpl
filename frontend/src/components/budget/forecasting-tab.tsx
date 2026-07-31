"use client";

import * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button, KpiRow, SectionHeader, EmptyState } from "@/components/ds";
import {
  FileSpreadsheet,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Sparkles,
  Pencil,
  Coins,
  Gauge,
  SquarePen,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatCurrency, formatDate, formatPercent } from "@/lib/format";
import { ForecastToCompleteModal } from "@/components/budget/modals/ForecastToCompleteModal";
import { apiFetch } from "@/lib/api-client";
import type { BudgetGrandTotals, BudgetLineItem } from "@/types/budget";

interface ForecastingTabProps {
  projectId: string;
}

interface ForecastData {
  summary: {
    totalOriginalBudget: number;
    totalRevisedBudget: number;
    totalProjectedBudget: number;
    totalProjectedCosts: number;
    totalProjectedCostToComplete: number;
    totalEstimatedCostAtCompletion: number;
    totalProjectedVariance: number;
    variancePercentage: number;
  };
  forecastByCostCode: Array<{
    budgetLineId: string;
    costCode: string;
    costCodeName: string;
    forecastMethod: "automatic" | "manual" | "lump_sum" | "monitored_resources";
    notes: string | null;
    projectedBudget: number;
    projectedCosts: number;
    projectedCostToComplete: number;
    estimatedCostAtCompletion: number;
    projectedVariance: number;
    forecastStartDate: string | null;
    forecastEndDate: string | null;
  }>;
}

interface BudgetForecastApiResponse {
  lineItems?: BudgetLineItem[];
  grandTotals?: BudgetGrandTotals;
}

const FORECAST_GRID_COLUMNS =
  "grid-cols-[minmax(180px,240px)_132px_132px_132px_140px_128px_128px_132px_132px]";

function getBudgetUsedPercent(projectedBudget: number, projectedCosts: number) {
  if (projectedBudget <= 0) return 0;
  return (projectedCosts / projectedBudget) * 100;
}

function formatBudgetUsedPercent(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "0%";
  if (value >= 1000) return "999%+";
  return formatPercent(value, 0);
}

function mapBudgetDataToForecast(
  lineItems: BudgetLineItem[],
  grandTotals?: BudgetGrandTotals,
): ForecastData {
  const summary = {
    totalOriginalBudget: grandTotals?.originalBudgetAmount ?? 0,
    totalRevisedBudget: grandTotals?.revisedBudget ?? 0,
    totalProjectedBudget: grandTotals?.projectedBudget ?? 0,
    totalProjectedCosts: grandTotals?.projectedCosts ?? 0,
    totalProjectedCostToComplete: grandTotals?.forecastToComplete ?? 0,
    totalEstimatedCostAtCompletion: grandTotals?.estimatedCostAtCompletion ?? 0,
    totalProjectedVariance: grandTotals?.projectedOverUnder ?? 0,
    variancePercentage:
      (grandTotals?.projectedBudget ?? 0) > 0
        ? ((grandTotals?.projectedOverUnder ?? 0) /
            (grandTotals?.projectedBudget ?? 1)) *
          100
        : 0,
  };

  return {
    summary,
    forecastByCostCode: lineItems
      .filter((line) => Boolean(line.costCode))
      .map((line) => ({
        budgetLineId: line.id,
        costCode: line.costCode,
        costCodeName: line.costCodeDescription || "",
        forecastMethod: line.forecastMethod || "automatic",
        notes: line.forecastNotes ?? null,
        projectedBudget: line.projectedBudget,
        projectedCosts: line.projectedCosts,
        projectedCostToComplete: line.forecastToComplete,
        estimatedCostAtCompletion: line.estimatedCostAtCompletion,
        projectedVariance: line.projectedOverUnder,
        forecastStartDate: line.forecastStartDate ?? null,
        forecastEndDate: line.forecastEndDate ?? null,
      })),
  };
}

function VarianceCell({ value }: { value: number }) {
  const positive = value >= 0;
  const neutral = value === 0;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 font-medium tabular-nums",
        neutral
          ? "text-muted-foreground"
          : positive
            ? "text-emerald-600 dark:text-emerald-400"
            : "text-destructive",
      )}
    >
      {neutral ? null : positive ? (
        <TrendingUp className="h-3 w-3" />
      ) : (
        <TrendingDown className="h-3 w-3" />
      )}
      {formatCurrency(Math.abs(value))}
    </span>
  );
}

const FORECAST_METHOD_META: Record<
  ForecastData["forecastByCostCode"][number]["forecastMethod"],
  { icon: LucideIcon; label: string }
> = {
  automatic: { icon: Sparkles, label: "Automatic" },
  manual: { icon: Pencil, label: "Manual" },
  lump_sum: { icon: Coins, label: "Lump sum" },
  monitored_resources: { icon: Gauge, label: "Monitored resources" },
};

function MethodIcon({
  method,
}: {
  method: ForecastData["forecastByCostCode"][number]["forecastMethod"];
}) {
  const meta = FORECAST_METHOD_META[method] ?? FORECAST_METHOD_META.automatic;
  const Icon = meta.icon;

  return (
    <span
      className="inline-flex text-muted-foreground"
      title={meta.label}
      aria-label={meta.label}
    >
      <Icon className="h-4 w-4" />
    </span>
  );
}

function CostBar({ budget, costs }: { budget: number; costs: number }) {
  const pct = Math.min(100, getBudgetUsedPercent(budget, costs));
  const tone =
    pct > 100 ? "bg-destructive" : pct > 85 ? "bg-amber-400" : "bg-primary/50";

  return (
    <div className="h-1 w-full overflow-hidden rounded-full bg-border">
      {}
      <div
        className={cn("h-full rounded-full transition-all", tone)}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-8">
      {/* KPI row skeleton */}
      <div className="overflow-hidden rounded-lg border border-border bg-background">
        <div className="grid grid-cols-2 divide-x divide-border md:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="px-6 py-4 space-y-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-7 w-36" />
              <Skeleton className="h-3 w-20" />
            </div>
          ))}
        </div>
      </div>

      {/* Table skeleton */}
      <div className="space-y-3">
        <Skeleton className="h-4 w-32" />
        <div className="overflow-hidden rounded-lg border border-border">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="flex items-center gap-6 px-5 py-4 border-b border-border last:border-0"
            >
              <Skeleton className="h-4 w-16 shrink-0" />
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-4 w-24 ml-auto" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-24" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ForecastingTab({ projectId }: ForecastingTabProps) {
  const [loading, setLoading] = React.useState(true);
  const [recalculating, setRecalculating] = React.useState(false);
  const [forecast, setForecast] = React.useState<ForecastData | null>(null);
  const [selectedLine, setSelectedLine] = React.useState<
    ForecastData["forecastByCostCode"][number] | null
  >(null);
  const [showFtcEditor, setShowFtcEditor] = React.useState(false);

  const fetchForecast = React.useCallback(
    async (showRecalc = false) => {
      try {
        if (showRecalc) setRecalculating(true);
        else setLoading(true);

        const data = await apiFetch<BudgetForecastApiResponse>(
          `/api/projects/${projectId}/budget`,
        );
        setForecast(
          mapBudgetDataToForecast(data.lineItems ?? [], data.grandTotals),
        );
        if (showRecalc) toast.success("Forecast updated");
      } catch {
        toast.error("Could not load budget forecast — please refresh");
      } finally {
        setLoading(false);
        setRecalculating(false);
      }
    },
    [projectId],
  );

  React.useEffect(() => {
    fetchForecast();
  }, [fetchForecast]);

  const summary = forecast?.summary;
  const items = forecast?.forecastByCostCode ?? [];
  const variancePct = summary?.variancePercentage ?? 0;
  const isOverBudget = (summary?.totalProjectedVariance ?? 0) < 0;

  const kpiMetrics = [
    {
      label: "Projected Budget",
      value: formatCurrency(summary?.totalProjectedBudget ?? 0),
      size: "compact" as const,
    },
    {
      label: "Projected Costs",
      value: formatCurrency(summary?.totalProjectedCosts ?? 0),
      size: "compact" as const,
    },
    {
      label: "Cost to Complete",
      value: formatCurrency(summary?.totalProjectedCostToComplete ?? 0),
      size: "compact" as const,
    },
    {
      label: "Est. Cost at Completion",
      value: formatCurrency(summary?.totalEstimatedCostAtCompletion ?? 0),
      size: "compact" as const,
      delta: summary
        ? {
            value: `${Math.abs(variancePct).toFixed(1)}%`,
            positive: !isOverBudget,
          }
        : undefined,
    },
  ];

  const headerActions = (
    <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
      <Button
        variant="outline"
        size="sm"
        onClick={() => fetchForecast(true)}
        disabled={recalculating}
      >
        <RefreshCw
          className={cn("h-3.5 w-3.5", recalculating && "animate-spin")}
        />
        Recalculate
      </Button>
      <Button size="sm" onClick={() => void handleExport()}>
        <FileSpreadsheet className="h-3.5 w-3.5" />
        Export
      </Button>
    </div>
  );

  const handleExport = React.useCallback(async () => {
    let toastId: string | number | undefined;

    try {
      toastId = toast.loading("Preparing export...", {
        description: "Building forecasting workbook...",
      });

      const xlsx = await import("xlsx");

      const summaryRows = [
        ["Metric", "Value"],
        ["Projected Budget", summary?.totalProjectedBudget ?? 0],
        ["Projected Costs", summary?.totalProjectedCosts ?? 0],
        ["Cost to Complete", summary?.totalProjectedCostToComplete ?? 0],
        [
          "Estimated Cost at Completion",
          summary?.totalEstimatedCostAtCompletion ?? 0,
        ],
        ["Variance", summary?.totalProjectedVariance ?? 0],
        ["Variance %", variancePct / 100],
      ];

      const forecastRows = items.map((item) => {
        const usagePercent = getBudgetUsedPercent(
          item.projectedBudget,
          item.projectedCosts,
        );

        return {
          "Cost Code": item.costCode,
          "Cost Code Name": item.costCodeName,
          "Budget Used %": usagePercent,
          "Projected Budget": item.projectedBudget,
          "Projected Costs": item.projectedCosts,
          "Cost to Complete": item.projectedCostToComplete,
          "Estimated Cost at Completion": item.estimatedCostAtCompletion,
          "Forecast Start": item.forecastStartDate
            ? formatDate(item.forecastStartDate)
            : "",
          "Forecast End": item.forecastEndDate
            ? formatDate(item.forecastEndDate)
            : "",
          Method: item.forecastMethod.replaceAll("_", " "),
          Variance: item.projectedVariance,
          Notes: item.notes ?? "",
        };
      });

      const workbook = xlsx.utils.book_new();
      const summarySheet = xlsx.utils.aoa_to_sheet(summaryRows);
      const forecastSheet = xlsx.utils.json_to_sheet(forecastRows);

      summarySheet["!cols"] = [{ wch: 34 }, { wch: 18 }];
      forecastSheet["!cols"] = [
        { wch: 14 },
        { wch: 28 },
        { wch: 12 },
        { wch: 18 },
        { wch: 18 },
        { wch: 18 },
        { wch: 24 },
        { wch: 16 },
        { wch: 16 },
        { wch: 18 },
        { wch: 18 },
        { wch: 28 },
      ];

      xlsx.utils.book_append_sheet(workbook, summarySheet, "Summary");
      xlsx.utils.book_append_sheet(
        workbook,
        forecastSheet,
        "Forecast by Cost Code",
      );

      const workbookArray = xlsx.write(workbook, {
        bookType: "xlsx",
        type: "array",
      });

      const blob = new Blob([workbookArray], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `forecasting-${projectId}.xlsx`;
      document.body.appendChild(link);
      link.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(link);

      toast.success("Export downloaded", {
        id: toastId,
        description: "Forecasting workbook has been saved.",
      });
    } catch (error) {
      console.error("Failed to export forecasting workbook", error);
      toast.error("Failed to export forecasting workbook. Please try again.", {
        id: toastId,
      });
    }
  }, [items, projectId, summary, variancePct]);

  const handleForecastSave = React.useCallback(
    async (data: {
      budgetLineId: string;
      forecastMethod: string;
      forecastAmount: number;
      notes?: string | null;
      lineItems?: Array<{
        id?: string;
        description: string;
        quantity: number;
        units: string;
        unitCost: number;
        utilizationRate?: number | null;
        startDate?: string | null;
        endDate?: string | null;
        unitsRemainingMode?: "weeks" | "months";
        sortOrder?: number;
      }>;
    }) => {
      await apiFetch(`/api/projects/${projectId}/budget/forecast`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      toast.success("Forecast saved");
      await fetchForecast();
    },
    [projectId, fetchForecast],
  );

  if (loading) return <LoadingSkeleton />;

  return (
    <div className="space-y-8">
      <KpiRow metrics={kpiMetrics} size="small" />

      {/* Cost code breakdown */}
      <div className="space-y-3">
        <SectionHeader
          title="Forecast by Cost Code"
          action={headerActions}
          className="flex-col items-start gap-3 sm:flex-row sm:items-center"
        />

        {items.length === 0 ? (
          <EmptyState
            icon={<TrendingUp className="h-8 w-8" />}
            title="No forecast data"
            description="Add budget lines to generate cost code forecasts."
          />
        ) : (
          <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <div className="min-w-max rounded-lg border border-border bg-background">
              <div className="w-max min-w-full">
                {/* Table header */}
                <div
                  className={cn(
                    "grid gap-4 border-b border-border bg-muted/40 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground",
                    FORECAST_GRID_COLUMNS,
                  )}
                >
                  <span className="sticky left-0 z-[2] whitespace-nowrap bg-muted/40">
                    Cost Code
                  </span>
                  <span className="whitespace-nowrap text-right">
                    Projected Budget
                  </span>
                  <span className="whitespace-nowrap text-right">
                    Projected Costs
                  </span>
                  <span className="whitespace-nowrap text-right">
                    Cost to Complete
                  </span>
                  <span className="whitespace-nowrap text-right">
                    Est. at Completion
                  </span>
                  <span className="whitespace-nowrap text-right">
                    Forecast Start
                  </span>
                  <span className="whitespace-nowrap text-right">
                    Forecast End
                  </span>
                  <span className="whitespace-nowrap text-right">Method</span>
                  <span className="whitespace-nowrap text-right">Variance</span>
                </div>

                {/* Table rows */}
                <div className="divide-y divide-border">
                  {items.map((item) => {
                    const pct = getBudgetUsedPercent(
                      item.projectedBudget,
                      item.projectedCosts,
                    );

                    return (
                      <div
                        key={
                          item.budgetLineId ||
                          `${item.costCode}-${item.costCodeName}`
                        }
                        className={cn(
                          "group grid items-center gap-4 px-5 py-3.5 transition-colors hover:bg-muted/30",
                          FORECAST_GRID_COLUMNS,
                        )}
                      >
                        {/* Code + name */}
                        <div className="sticky left-0 z-[1] min-w-0 space-y-2 bg-background group-hover:bg-muted/30">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono font-medium text-muted-foreground shrink-0">
                              {item.costCode}
                            </span>
                            <span className="truncate text-sm font-medium text-foreground">
                              {item.costCodeName}
                            </span>
                            <span className="ml-auto shrink-0 text-[11px] font-medium tabular-nums text-muted-foreground">
                              {formatBudgetUsedPercent(pct)}
                            </span>
                          </div>
                          <CostBar
                            budget={item.projectedBudget}
                            costs={item.projectedCosts}
                          />
                        </div>

                        {/* Projected Budget */}
                        <div className="text-right text-sm tabular-nums text-foreground/80">
                          {formatCurrency(item.projectedBudget)}
                        </div>

                        {/* Projected Costs */}
                        <div className="text-right text-sm tabular-nums text-foreground/80">
                          {formatCurrency(item.projectedCosts)}
                        </div>

                        {/* Projected Cost to Complete */}
                        <div className="text-right text-sm tabular-nums text-foreground/80">
                          {formatCurrency(item.projectedCostToComplete)}
                        </div>

                        {/* Estimated Cost at Completion */}
                        <div className="text-right text-sm tabular-nums font-medium text-foreground">
                          {formatCurrency(item.estimatedCostAtCompletion)}
                        </div>

                        {/* Forecast Start */}
                        <div className="text-right text-xs tabular-nums text-muted-foreground">
                          {formatDate(item.forecastStartDate)}
                        </div>

                        {/* Forecast End */}
                        <div className="text-right text-xs tabular-nums text-muted-foreground">
                          {formatDate(item.forecastEndDate)}
                        </div>

                        {/* Method */}
                        <div className="flex justify-end">
                          <MethodIcon method={item.forecastMethod} />
                        </div>

                        {/* Variance */}
                        <div className="flex items-center justify-end gap-2 text-sm">
                          {item.budgetLineId && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              aria-label="Edit forecast"
                              title="Edit forecast"
                              className="h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100"
                              onClick={() => {
                                setSelectedLine(item);
                                setShowFtcEditor(true);
                              }}
                            >
                              <SquarePen className="h-4 w-4" />
                            </Button>
                          )}
                          <VarianceCell value={item.projectedVariance} />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Footer summary */}
                {items.length > 0 && (
                  <div
                    className={cn(
                      "grid gap-4 border-t border-border bg-muted/40 px-5 py-3 text-sm font-semibold",
                      FORECAST_GRID_COLUMNS,
                    )}
                  >
                    <span className="sticky left-0 z-[1] bg-muted/40 text-muted-foreground">
                      Total
                    </span>
                    <span className="text-right tabular-nums">
                      {formatCurrency(summary?.totalProjectedBudget ?? 0)}
                    </span>
                    <span className="text-right tabular-nums">
                      {formatCurrency(summary?.totalProjectedCosts ?? 0)}
                    </span>
                    <span className="text-right tabular-nums">
                      {formatCurrency(
                        summary?.totalProjectedCostToComplete ?? 0,
                      )}
                    </span>
                    <span className="text-right tabular-nums">
                      {formatCurrency(
                        summary?.totalEstimatedCostAtCompletion ?? 0,
                      )}
                    </span>
                    <span className="text-right text-xs text-muted-foreground">
                      —
                    </span>
                    <span className="text-right text-xs text-muted-foreground">
                      —
                    </span>
                    <span className="text-right text-xs text-muted-foreground">
                      —
                    </span>
                    <div className="text-right">
                      <VarianceCell
                        value={summary?.totalProjectedVariance ?? 0}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {selectedLine && (
        <ForecastToCompleteModal
          open={showFtcEditor}
          onClose={() => {
            setShowFtcEditor(false);
            setSelectedLine(null);
          }}
          budgetLineId={selectedLine.budgetLineId}
          projectId={projectId}
          costCode={selectedLine.costCode}
          currentData={{
            forecastMethod: selectedLine.forecastMethod,
            forecastAmount: selectedLine.projectedCostToComplete,
            projectedBudget: selectedLine.projectedBudget,
            projectedCosts: selectedLine.projectedCosts,
            notes: selectedLine.notes ?? undefined,
          }}
          onSave={handleForecastSave}
        />
      )}
    </div>
  );
}
