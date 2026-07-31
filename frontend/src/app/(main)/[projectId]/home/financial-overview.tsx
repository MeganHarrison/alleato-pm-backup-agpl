"use client";

import Link from "next/link";
import { ArrowUpRight, Check, TrendingDown, TrendingUp, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPercent } from "@/lib/format";

/* ─────────────────────────────────────────────────────────────
   FinancialOverview — at-a-glance cost health for the project home.

   One compact readout: the three numbers a PM scans first (budget,
   committed, ECAC) plus a single committed-vs-budget bar with an
   ECAC marker. Per-division detail lives on /budget, not here.
───────────────────────────────────────────────────────────── */

export interface BudgetDivisionSummary {
  id: string;
  label: string;
  budget: number;
  committed: number;
}

interface FinancialOverviewProps {
  projectId: string;
  revisedBudget: number;
  committedCosts: number;
  estimatedCostAtCompletion: number;
  projectedOverUnder: number;
  /** Prime contract schedule-of-values total, reconciled against the budget. */
  primeSovTotal?: number;
  /** Retained for call-site compatibility; division detail is shown on /budget. */
  budgetDivisions?: BudgetDivisionSummary[];
}

/** Dollars below which the SOV and budget are treated as reconciled. */
const SOV_MATCH_TOLERANCE = 1;

function fmtFull(value: number | null | undefined): string {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function fmtCompact(value: number | null | undefined): string {
  if (value == null) return "—";
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(0)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

function clampPct(value: number): number {
  return Math.min(100, Math.max(0, value));
}

function Metric({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "danger";
}) {
  return (
    <div className="min-w-0">
      <p
        className={cn(
          "text-lg font-semibold leading-none tabular-nums",
          tone === "danger" ? "text-destructive" : "text-foreground",
        )}
      >
        {value}
      </p>
      <p className="mt-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
    </div>
  );
}

export function FinancialOverview({
  projectId,
  revisedBudget,
  committedCosts,
  estimatedCostAtCompletion,
  projectedOverUnder,
  primeSovTotal = 0,
}: FinancialOverviewProps) {
  // Nothing meaningful to show before a budget exists.
  if (revisedBudget <= 0 && committedCosts <= 0) {
    return null;
  }

  const overBudget = projectedOverUnder < 0;
  // SOV ↔ budget reconciliation (only when a prime SOV exists).
  const hasSov = primeSovTotal > 0 && revisedBudget > 0;
  const sovDiff = primeSovTotal - revisedBudget;
  const sovMatched = Math.abs(sovDiff) < SOV_MATCH_TOLERANCE;
  const denominator = Math.max(revisedBudget, committedCosts, estimatedCostAtCompletion, 1);
  const committedWidth = clampPct((committedCosts / denominator) * 100);
  const ecacPosition = clampPct((estimatedCostAtCompletion / denominator) * 100);
  const budgetPosition = clampPct((revisedBudget / denominator) * 100);
  const committedPctOfBudget = revisedBudget > 0 ? (committedCosts / revisedBudget) * 100 : 0;
  const variancePctOfBudget =
    revisedBudget > 0 ? (projectedOverUnder / revisedBudget) * 100 : 0;

  return (
    <section aria-label="Financial overview">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-foreground">Financials</p>
        <Link
          href={`/${projectId}/budget`}
          prefetch={false}
          className="text-xs text-primary transition-colors hover:text-primary/80"
        >
          View budget
        </Link>
      </div>

      <Link
        href={`/${projectId}/budget`}
        prefetch={false}
        className="group block rounded-lg bg-card p-5 transition-colors hover:bg-muted/40"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-wrap items-start gap-x-10 gap-y-4">
            <Metric label="Revised budget" value={fmtFull(revisedBudget)} />
            <Metric label="Committed" value={fmtCompact(committedCosts)} />
            <Metric
              label="Forecast (ECAC)"
              value={fmtCompact(estimatedCostAtCompletion)}
              tone={overBudget ? "danger" : "default"}
            />
          </div>
          <span
            className={cn(
              "inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold tabular-nums",
              overBudget
                ? "bg-destructive/10 text-destructive"
                : "bg-success/10 text-success",
            )}
          >
            {overBudget ? (
              <TrendingDown className="h-3 w-3" />
            ) : (
              <TrendingUp className="h-3 w-3" />
            )}
            {overBudget ? "" : "+"}
            {fmtCompact(projectedOverUnder)}
            <span className="opacity-60">{formatPercent(Math.abs(variancePctOfBudget), 1)}</span>
            <span className="ml-0.5 hidden text-muted-foreground sm:inline">
              {overBudget ? "over" : "under"}
            </span>
          </span>
        </div>

        {/* Committed-vs-budget bar with an ECAC marker. */}
        <div className="mt-5">
          <div className="relative h-2.5 overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full rounded-full transition-[width]",
                committedCosts > revisedBudget ? "bg-destructive" : "bg-primary",
              )}
              style={{ width: `${committedWidth}%` }}
            />
            {/* Revised-budget reference line */}
            <span
              aria-hidden
              className="absolute top-0 h-full w-px bg-foreground/30"
              style={{ left: `${budgetPosition}%` }}
            />
          </div>
          <div className="relative mt-2 h-4 text-[11px] tabular-nums text-muted-foreground">
            <span className="absolute left-0">
              {formatPercent(clampPct(committedPctOfBudget), 0)} committed
            </span>
            {/* ECAC marker label, kept inside the track bounds */}
            <span
              aria-hidden
              className={cn(
                "absolute -translate-x-1/2 font-medium",
                overBudget ? "text-destructive" : "text-foreground/70",
              )}
              style={{ left: `${Math.min(92, Math.max(8, ecacPosition))}%` }}
            >
              ECAC
            </span>
          </div>
        </div>

        {hasSov && (
          <div className="mt-4 flex items-center justify-between gap-3 border-t border-border/60 pt-3">
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Prime SOV vs budget
              </p>
              <p className="mt-0.5 text-sm font-medium tabular-nums text-foreground">
                {fmtFull(primeSovTotal)}
                <span className="ml-1 font-normal text-muted-foreground">SOV</span>
              </p>
            </div>
            <span
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold",
                sovMatched ? "bg-success/10 text-success" : "bg-warning/10 text-warning",
              )}
            >
              {sovMatched ? (
                <>
                  <Check className="h-3 w-3" />
                  Ties to budget
                </>
              ) : (
                <>
                  <TriangleAlert className="h-3 w-3" />
                  <span className="tabular-nums">{fmtCompact(Math.abs(sovDiff))}</span>
                  {sovDiff > 0 ? "over" : "under"} budget
                </>
              )}
            </span>
          </div>
        )}

        <ArrowUpRight className="ml-auto mt-1 h-3.5 w-3.5 text-muted-foreground/40 transition-all group-hover:translate-x-0.5 group-hover:text-primary" />
      </Link>
    </section>
  );
}
