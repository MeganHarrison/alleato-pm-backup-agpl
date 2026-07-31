/**
 * /api/testing/parity
 * GET — Aggregates the latest test_run per suite into a Procore-parity report.
 *
 * Status convention enforced at the audit layer (not in the DB):
 *   - pass                           → feature works
 *   - fail                           → feature exists but is broken (bug)
 *   - skip + notes "MISSING:*"       → feature does not exist yet (roadmap)
 *   - skip (no MISSING prefix)       → blocked / deferred
 *   - not_tested                     → agent did not reach this case
 *
 * Query params:
 *   ?priority=HIGH|MEDIUM|LOW   (optional — filter cases by priority)
 */
import { withApiGuardrails } from "@/lib/guardrails/api";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Priority = "HIGH" | "MEDIUM" | "LOW";

interface SuiteParity {
  tool_name: string;
  display_name: string;
  total_cases: number;
  latest_run_id: string | null;
  latest_run_date: string | null;
  counts: {
    pass: number;
    fail: number;
    missing: number;
    skip: number;
    not_tested: number;
  };
  working_pct: number;
  broken: BrokenItem[];
  missing: MissingItem[];
}

interface BrokenItem {
  case_id: string;
  test_number: string;
  test_name: string;
  category: string;
  priority: Priority;
  severity: string | null;
  notes: string | null;
}

interface MissingItem {
  case_id: string;
  test_number: string;
  test_name: string;
  category: string;
  priority: Priority;
  reason: string;
}

const MISSING_PREFIX = "MISSING:";

type TestCaseSummary = {
  id: string;
  test_number: string;
  test_name: string;
  category: string;
  priority: Priority;
};

function isPriority(value: unknown): value is Priority {
  return value === "HIGH" || value === "MEDIUM" || value === "LOW";
}

function normalizeTestCaseSummary(value: unknown): TestCaseSummary | null {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!candidate || typeof candidate !== "object") return null;

  const row = candidate as Partial<TestCaseSummary>;
  if (
    typeof row.id !== "string" ||
    typeof row.test_number !== "string" ||
    typeof row.test_name !== "string" ||
    typeof row.category !== "string" ||
    !isPriority(row.priority)
  ) {
    return null;
  }

  return {
    id: row.id,
    test_number: row.test_number,
    test_name: row.test_name,
    category: row.category,
    priority: row.priority,
  };
}

export const GET = withApiGuardrails("testing/parity#GET", async ({ request }) => {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const priorityFilter = searchParams.get("priority") as Priority | null;

  const { data: suites, error: suitesErr } = await supabase
    .from("test_suites")
    .select("id, tool_name, display_name, total_cases")
    .order("display_name");

  if (suitesErr) {
    return NextResponse.json({ error: suitesErr.message }, { status: 500 });
  }

  const report: SuiteParity[] = [];

  for (const suite of suites ?? []) {
    const { data: latestRun } = await supabase
      .from("test_runs")
      .select("id, run_date")
      .eq("suite_id", suite.id)
      .order("run_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    const entry: SuiteParity = {
      tool_name: suite.tool_name,
      display_name: suite.display_name,
      total_cases: suite.total_cases ?? 0,
      latest_run_id: latestRun?.id ?? null,
      latest_run_date: latestRun?.run_date ?? null,
      counts: { pass: 0, fail: 0, missing: 0, skip: 0, not_tested: 0 },
      working_pct: 0,
      broken: [],
      missing: [],
    };

    if (latestRun?.id) {
      const { data: results, error: resultsErr } = await supabase
        .from("test_results")
        .select(`
          id, status, notes, severity,
          test_cases!inner (
            id, test_number, test_name, category, priority
          )
        `)
        .eq("run_id", latestRun.id);

      if (resultsErr) {
        return NextResponse.json({ error: resultsErr.message }, { status: 500 });
      }

      for (const r of results ?? []) {
        const tc = normalizeTestCaseSummary(r.test_cases);
        if (!tc) continue;
        if (priorityFilter && tc.priority !== priorityFilter) continue;

        const notes = (r.notes ?? "").trim();
        const isMissing = r.status === "skip" && notes.toUpperCase().startsWith(MISSING_PREFIX);

        if (r.status === "pass") {
          entry.counts.pass++;
        } else if (r.status === "fail") {
          entry.counts.fail++;
          entry.broken.push({
            case_id: tc.id,
            test_number: tc.test_number,
            test_name: tc.test_name,
            category: tc.category,
            priority: tc.priority,
            severity: (r as { severity?: string | null }).severity ?? null,
            notes: notes || null,
          });
        } else if (isMissing) {
          entry.counts.missing++;
          entry.missing.push({
            case_id: tc.id,
            test_number: tc.test_number,
            test_name: tc.test_name,
            category: tc.category,
            priority: tc.priority,
            reason: notes.slice(MISSING_PREFIX.length).trim() || "Feature not implemented",
          });
        } else if (r.status === "skip") {
          entry.counts.skip++;
        } else {
          entry.counts.not_tested++;
        }
      }

      const graded = entry.counts.pass + entry.counts.fail + entry.counts.missing;
      entry.working_pct = graded > 0 ? Math.round((entry.counts.pass / graded) * 100) : 0;

      entry.broken.sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority));
      entry.missing.sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority));
    }

    report.push(entry);
  }

  const totals = report.reduce(
    (acc, s) => ({
      pass: acc.pass + s.counts.pass,
      fail: acc.fail + s.counts.fail,
      missing: acc.missing + s.counts.missing,
      skip: acc.skip + s.counts.skip,
      not_tested: acc.not_tested + s.counts.not_tested,
    }),
    { pass: 0, fail: 0, missing: 0, skip: 0, not_tested: 0 },
  );

  return NextResponse.json({
    generated_at: new Date().toISOString(),
    priority_filter: priorityFilter,
    totals,
    suites: report,
  });
});

function priorityRank(p: Priority): number {
  return p === "HIGH" ? 0 : p === "MEDIUM" ? 1 : 2;
}
