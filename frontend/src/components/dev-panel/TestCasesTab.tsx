"use client";

import * as React from "react";

import { ChevronDown, ChevronUp, ArrowRight } from "lucide-react";

import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TestCase {
  id: string;
  test_number: string;
  category: string;
  subcategory: string | null;
  test_name: string;
  context_note: string | null;
  setup_steps: string | null;
  steps: string | null;
  expected_result: string | null;
  priority: "HIGH" | "MEDIUM" | "LOW";
  start_url: string | null;
  test_type: string;
}

interface CasesPayload {
  suite: { tool_name: string; display_name: string };
  total: number;
  categories: string[];
  grouped: Record<string, TestCase[]>;
}

interface Props {
  slug: string;
  type?: "scenario" | "feature" | "all";
  suiteType?: "smoke" | "feature";
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseLines(raw: string | null): string[] {
  if (!raw) return [];
  // Handle both actual newlines and literal \n escape sequences stored in the DB
  return raw
    .replace(/\\n/g, "\n")
    .split("\n")
    .map((s) => s.replace(/^\d+\.\s*/, "").trim())
    .filter(Boolean);
}

// ─── TestCaseCard ─────────────────────────────────────────────────────────────

function TestCaseCard({ tc }: { tc: TestCase }) {
  const [open, setOpen] = React.useState(true);
  const steps = parseLines(tc.steps);
  const setup = parseLines(tc.setup_steps);

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-start gap-3 px-4 pt-4 pb-3 text-left hover:bg-muted/30 transition-colors"
      >
        {/* Number + title block */}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-xs font-mono font-semibold text-muted-foreground shrink-0">
              {tc.test_number}
            </span>
            <span className="text-sm font-semibold text-foreground leading-snug">
              {tc.test_name}
            </span>
          </div>
          {/* Category pill */}
          <span className="mt-1.5 inline-flex items-center rounded bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
            {tc.category}
          </span>
        </div>

        {/* Collapse toggle */}
        <div className="shrink-0 mt-0.5">
          {open
            ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
            : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          }
        </div>
      </button>

      {/* Body */}
      {open && (
        <div className="px-4 pb-4 space-y-4 border-t border-border/40 pt-3">
          {/* Context note */}
          {tc.context_note && (
            <p className="text-xs text-muted-foreground leading-relaxed">
              {tc.context_note}
            </p>
          )}

          {/* Before you start */}
          {setup.length > 0 && (
            <div>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Before you start
              </p>
              <ul className="space-y-1">
                {setup.map((s) => (
                  <li key={s} className="flex gap-2 text-xs text-muted-foreground">
                    <span className="shrink-0 text-muted-foreground/40">–</span>
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Steps */}
          {steps.length > 0 && (
            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Steps
              </p>
              <ol className="space-y-2">
                {steps.map((s, i) => (
                  <li key={`step-${i}-${s.slice(0, 20)}`} className="flex gap-2.5 text-sm text-foreground/80">
                    <span className="mt-0.5 shrink-0 flex h-4 w-4 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
                      {i + 1}
                    </span>
                    {s}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Expected result */}
          {tc.expected_result && (
            <div className="rounded-md bg-muted/50 px-3 py-2.5">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Expected result
              </p>
              <p className="text-sm text-foreground/80 leading-relaxed">{tc.expected_result}</p>
            </div>
          )}

          {/* Open in app */}
          {tc.start_url && (
            <a
              href={`http://localhost:3000${tc.start_url}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
            >
              <ArrowRight className="h-3 w-3" />
              Open in app
            </a>

          )}
        </div>
      )}
    </div>
  );
}

// ─── TestCasesTab ─────────────────────────────────────────────────────────────

export function TestCasesTab({ slug, type = "all", suiteType = "feature" }: Props) {
  const [data, setData] = React.useState<CasesPayload | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = React.useState<string>("ALL");

  React.useEffect(() => {
    setLoading(true);
    setError(null);
    setCategoryFilter("ALL");

    const params = new URLSearchParams({ type, suiteType });
    fetch(`/api/testing/suites/${slug}/cases?${params}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setData(d);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [slug, type, suiteType]);

  // ── Loading ──
  if (loading) {
    return (
      <div className="space-y-3 py-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-32 rounded-lg bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  // ── Error ──
  if (error) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        Failed to load test cases: {error}
      </p>
    );
  }

  // ── Empty ──
  if (!data || data.total === 0) {
    return (
      <div className="py-12 text-center space-y-2 text-sm text-muted-foreground">
        <p>
          No active test cases found for <strong>{slug}</strong>.
        </p>
        <p className="text-xs text-muted-foreground/60">
          Cases may not be seeded yet, or all cases are marked inactive.
        </p>
      </div>
    );
  }

  // Flat list of all cases, filtered by category
  const allCases = data.categories.flatMap((cat) => data.grouped[cat]);
  const visibleCases =
    categoryFilter === "ALL"
      ? allCases
      : allCases.filter((c) => c.category === categoryFilter);

  return (
    <div>
      {/* Category filter bar */}
      <div className="flex items-center justify-between border-b border-border/50 pb-3 mb-4 gap-4 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setCategoryFilter("ALL")}
            className={cn(
              "rounded px-2 py-0.5 text-[11px] font-medium transition-colors",
              categoryFilter === "ALL"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            All
            <span className="ml-1 opacity-60">{data.total}</span>
          </button>
          {data.categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategoryFilter(cat)}
              className={cn(
                "rounded px-2 py-0.5 text-[11px] font-medium transition-colors",
                categoryFilter === cat
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              {cat}
              <span className="ml-1 opacity-60">{data.grouped[cat].length}</span>
            </button>
          ))}
        </div>

        <a
          href="http://localhost:3000/testing"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline shrink-0"
        >
          <ArrowRight className="h-3 w-3" />
          Test Runner
        </a>
      </div>

      {/* Flat card list — natural height, page scrolls */}
      <div className="space-y-3 pb-8">
        {visibleCases.map((tc) => (
          <TestCaseCard key={tc.id} tc={tc} />
        ))}
      </div>
    </div>
  );
}
