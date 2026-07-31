/**
 * /api/testing/tester-activity
 * GET ?tester=email — returns tester scenario activity grouped by tool.
 */
import { NextResponse } from "next/server";

import { withApiGuardrails } from "@/lib/guardrails/api";
import { createClient } from "@/lib/supabase/server";

type ActivityStatus = "pass" | "fail" | "skip" | "not_tested";

type ResultCase = {
  id: string;
  test_number: string | null;
  test_name: string | null;
} | null;

type ResultScreenshot = {
  id: string;
  public_url: string | null;
  label: string | null;
  created_at: string | null;
};

type ResultRow = {
  id: string;
  case_id: string;
  run_id: string;
  status: ActivityStatus;
  notes: string | null;
  updated_at: string | null;
  test_cases: ResultCase | ResultCase[] | null;
  test_screenshots: ResultScreenshot[] | null;
};

interface RunRow {
  id: string;
  suite_id: string;
  run_date: string;
}

interface SuiteRow {
  id: string;
  tool_name: string;
  display_name: string;
}

/** Normalizes embedded test_cases rows that may come back as object or array. */
function normalizeTestCase(value: ResultRow["test_cases"]): ResultCase {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

/** Sorts test numbers semantically (for example, 1.2 before 1.10). */
function compareTestNumber(a: string | null, b: string | null): number {
  const left = (a ?? "").split(".").map((part) => Number.parseInt(part, 10));
  const right = (b ?? "").split(".").map((part) => Number.parseInt(part, 10));
  const maxLen = Math.max(left.length, right.length);
  for (let i = 0; i < maxLen; i += 1) {
    const diff = (left[i] ?? 0) - (right[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

export const GET = withApiGuardrails(
  "testing/tester-activity#GET",
  async ({ request }) => {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const tester = searchParams.get("tester")?.trim().toLowerCase();

    if (!tester) {
      return NextResponse.json({ error: "tester param required" }, { status: 400 });
    }

    const [suitesRes, runsRes] = await Promise.all([
      supabase.from("test_suites").select("id, tool_name, display_name"),
      supabase
        .from("test_runs")
        .select("id, suite_id, run_date")
        .eq("tester", tester)
        .order("run_date", { ascending: false })
        .limit(100),
    ]);

    if (suitesRes.error) {
      return NextResponse.json({ error: suitesRes.error.message }, { status: 500 });
    }
    if (runsRes.error) {
      return NextResponse.json({ error: runsRes.error.message }, { status: 500 });
    }

    const suites = (suitesRes.data ?? []) as SuiteRow[];
    const runs = (runsRes.data ?? []) as RunRow[];
    if (runs.length === 0) {
      return NextResponse.json({ tester, scenarios: [] });
    }

    const runById = new Map(runs.map((run) => [run.id, run]));
    const suiteById = new Map(suites.map((suite) => [suite.id, suite]));
    const runIds = runs.map((run) => run.id);

    const resultsRes = await supabase
      .from("test_results")
      .select(`
        id, case_id, run_id, status, notes, updated_at,
        test_cases (id, test_number, test_name),
        test_screenshots (id, public_url, label, created_at)
      `)
      .in("run_id", runIds);

    if (resultsRes.error) {
      return NextResponse.json({ error: resultsRes.error.message }, { status: 500 });
    }

    const grouped = new Map<string, {
      tool_name: string;
      display_name: string;
      rows: Array<{
        result_id: string;
        run_id: string;
        run_date: string;
        status: ActivityStatus;
        notes: string | null;
        test_case_id: string | null;
        test_number: string | null;
        test_name: string | null;
        screenshot_url: string | null;
        screenshot_label: string | null;
      }>;
    }>();

    const rawResults = (resultsRes.data ?? []) as ResultRow[];
    const caseIds = rawResults.map((row) => row.case_id).filter((id): id is string => Boolean(id));
    const inactiveCaseIds = new Set<string>();
    if (caseIds.length > 0) {
      const { data: inactiveCases, error: inactiveCasesErr } = await supabase
        .from("test_cases")
        .select("id")
        .in("id", caseIds)
        .filter("status", "eq", "inactive");
      if (inactiveCasesErr) {
        return NextResponse.json({ error: inactiveCasesErr.message }, { status: 500 });
      }
      for (const row of inactiveCases ?? []) {
        inactiveCaseIds.add(row.id);
      }
    }

    for (const rawResult of rawResults) {
      if (rawResult.case_id && inactiveCaseIds.has(rawResult.case_id)) continue;
      const run = runById.get(rawResult.run_id);
      if (!run) continue;
      const suite = suiteById.get(run.suite_id);
      if (!suite) continue;

      const key = suite.tool_name;
      if (!grouped.has(key)) {
        grouped.set(key, {
          tool_name: suite.tool_name,
          display_name: suite.display_name,
          rows: [],
        });
      }

      const testCase = normalizeTestCase(rawResult.test_cases);
      const screenshots = rawResult.test_screenshots ?? [];
      const sortedScreenshots = [...screenshots].sort((a, b) => {
        const left = a.created_at ? new Date(a.created_at).getTime() : 0;
        const right = b.created_at ? new Date(b.created_at).getTime() : 0;
        return right - left;
      });
      const primaryScreenshot = sortedScreenshots[0];

      grouped.get(key)?.rows.push({
        result_id: rawResult.id,
        run_id: rawResult.run_id,
        run_date: run.run_date,
        status: rawResult.status,
        notes: rawResult.notes,
        test_case_id: testCase?.id ?? null,
        test_number: testCase?.test_number ?? null,
        test_name: testCase?.test_name ?? null,
        screenshot_url: primaryScreenshot?.public_url ?? null,
        screenshot_label: primaryScreenshot?.label ?? null,
      });
    }

    const scenarios = Array.from(grouped.values())
      .map((scenario) => ({
        ...scenario,
        rows: scenario.rows.sort((a, b) => {
          const dateDiff = new Date(b.run_date).getTime() - new Date(a.run_date).getTime();
          if (dateDiff !== 0) return dateDiff;
          return compareTestNumber(a.test_number, b.test_number);
        }),
      }))
      .sort((a, b) => a.display_name.localeCompare(b.display_name));

    return NextResponse.json({ tester, scenarios });
  },
);
