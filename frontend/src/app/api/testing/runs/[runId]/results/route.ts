/**
 * /api/testing/runs/[runId]/results
 * GET  — all results for a run, with case details, grouped by category
 */
import { withApiGuardrails } from "@/lib/guardrails/api";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type ResultRow = {
  case_id?: string;
  test_cases: {
    test_number: string | null;
    test_type: string | null;
  }[] | {
    test_number: string | null;
    test_type: string | null;
  } | null;
};

function normalizeTestCase(
  value: unknown,
): { test_number: string | null; test_type: string | null } | null {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!candidate || typeof candidate !== "object") return null;

  const row = candidate as Partial<{
    test_number: string | null;
    test_type: string | null;
  }>;

  return {
    test_number: row.test_number ?? null,
    test_type: row.test_type ?? null,
  };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const GET = withApiGuardrails<{ runId: string }>(
  "testing/runs/[runId]/results#GET",
  async ({ request, params }) => {
  const { runId: runIdOrSlug } = await params;
  const { searchParams } = new URL(request.url);
  const typeFilter = searchParams.get("type"); // "scenario" | "feature" | null (all)
  const supabase = await createClient();

  // Resolve slug → UUID if needed.
  let runId = runIdOrSlug;
  if (!UUID_RE.test(runIdOrSlug)) {
    const { data: runRow, error: resolveErr } = await supabase
      .from("test_runs")
      .select("id")
      .eq("slug", runIdOrSlug)
      .single();
    if (resolveErr || !runRow) {
      return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }
    runId = runRow.id;
  }

  const resultsRes = await supabase
    .from("test_results")
    .select(`
      id, case_id, status, notes, severity, video_url, github_issue_number, github_issue_url, github_issue_state, updated_at,
      test_cases (
        id, test_number, category, subcategory, test_name,
        steps, setup_steps, context_note, expected_result, priority,
        test_type, start_url
      ),
      test_screenshots (id, public_url, label, created_at)
    `)
    .eq("run_id", runId)
    .order("id");

  if (resultsRes.error) {
    return NextResponse.json({ error: resultsRes.error.message }, { status: 500 });
  }
  const data: ResultRow[] = (resultsRes.data ?? []).map((row) => ({
    ...row,
    case_id: row.case_id ?? undefined,
    test_cases: row.test_cases ?? null,
  }));

  const caseIds = (data ?? []).map((row) => row.case_id).filter((id): id is string => Boolean(id));
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

  // Filter by active case first, then by test_type in JS (embedded .eq filters child rows, not parents).
  const activeOnly = (data ?? []).filter((row) => {
    if (!row.case_id) return true;
    return !inactiveCaseIds.has(row.case_id);
  });

  const filtered = typeFilter
    ? activeOnly.filter((row) => normalizeTestCase(row.test_cases)?.test_type === typeFilter)
    : activeOnly;

  // Sort by mixed test_number formats (e.g. "1.1.2", "10.1", "M.001") naturally.
  const testNumberCollator = new Intl.Collator(undefined, {
    numeric: true,
    sensitivity: "base",
  });
  const sorted = filtered.sort((a: ResultRow, b: ResultRow) => {
    const numA = normalizeTestCase(a.test_cases)?.test_number ?? "";
    const numB = normalizeTestCase(b.test_cases)?.test_number ?? "";
    return testNumberCollator.compare(numA, numB);
  });

  return NextResponse.json({ results: sorted });
  },
);
