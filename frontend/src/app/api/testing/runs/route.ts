/**
 * /api/testing/runs
 * GET  ?suite=<tool>&suiteType=smoke|feature  — list runs for a suite
 * POST                                         — create a new test run
 */
import { withApiGuardrails } from "@/lib/guardrails/api";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const GET = withApiGuardrails(
  "testing/runs#GET",
  async ({ request }) => {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const toolName = searchParams.get("suite");
    const suiteType = searchParams.get("suiteType");

    if (!toolName) {
      return NextResponse.json({ error: "suite param required" }, { status: 400 });
    }

    let suiteQuery = supabase
      .from("test_suites")
      .select("id, tool_name, display_name, suite_type, total_cases, source_doc_count, last_generated_at")
      .eq("tool_name", toolName);
    if (suiteType === "smoke" || suiteType === "feature") {
      suiteQuery = suiteQuery.eq("suite_type", suiteType);
    }
    const { data: suites, error: suiteErr } = await suiteQuery;

    if (suiteErr || !suites || suites.length === 0) {
      return NextResponse.json({ error: "Suite not found" }, { status: 404 });
    }

    const suiteIds = suites.map((s) => s.id);

    const { data: runs, error: runsErr } = await supabase
      .from("test_runs")
      .select(`
        id, slug, run_date, tester, environment, branch, notes, suite_id,
        test_results (status)
      `)
      .in("suite_id", suiteIds)
      .order("run_date", { ascending: false })
      .limit(40);

    if (runsErr) {
      return NextResponse.json({ error: runsErr.message }, { status: 500 });
    }

    const suiteById = new Map(suites.map((s) => [s.id, s]));

    const enriched = (runs ?? []).map((r) => {
      const results = (r.test_results as { status: string }[]) ?? [];
      const suite = suiteById.get(r.suite_id);
      return {
        id: r.id,
        slug: (r as { slug?: string | null }).slug ?? null,
        run_date: r.run_date,
        tester: r.tester,
        environment: r.environment,
        branch: r.branch,
        notes: r.notes,
        suite_type: (suite as { suite_type?: "smoke" | "feature" } | undefined)?.suite_type ?? "smoke",
        total: results.length,
        pass: results.filter((x) => x.status === "pass").length,
        fail: results.filter((x) => x.status === "fail").length,
        skip: results.filter((x) => x.status === "skip").length,
        not_tested: results.filter((x) => x.status === "not_tested").length,
      };
    });

    return NextResponse.json({ suites, runs: enriched });
  },
);

export const POST = withApiGuardrails(
  "testing/runs#POST",
  async ({ request }) => {
    const supabase = await createClient();
    const body = await request.json();
    const { suite, suiteType, tester, environment, branch, notes } = body as {
      suite: string;
      suiteType: "smoke" | "feature";
      tester?: string;
      environment?: string;
      branch?: string;
      notes?: string;
    };

    if (!suite) {
      return NextResponse.json({ error: "suite required" }, { status: 400 });
    }
    if (suiteType !== "smoke" && suiteType !== "feature") {
      return NextResponse.json(
        { error: "suiteType must be 'smoke' or 'feature'" },
        { status: 400 },
      );
    }

    const { data: suiteRow, error: suiteErr } = await supabase
      .from("test_suites")
      .select("id")
      .eq("tool_name", suite)
      .eq("suite_type", suiteType)
      .single();

    if (suiteErr || !suiteRow) {
      return NextResponse.json({ error: "Suite not found" }, { status: 404 });
    }

    const { data: cases, error: casesErr } = await supabase
      .from("test_cases")
      .select("id, test_type")
      .eq("suite_id", suiteRow.id)
      .or("status.is.null,status.neq.inactive");

    if (casesErr) {
      return NextResponse.json({ error: casesErr.message }, { status: 500 });
    }

    const selectedCases = cases ?? [];

    // Generate a slug: {tool}-{suite-type}, with -N suffix if taken.
    const base = `${suite}-${suiteType}`;
    const { data: existing } = await supabase
      .from("test_runs")
      .select("slug")
      .like("slug", `${base}%`);
    const taken = new Set((existing ?? []).map((r: { slug: string | null }) => r.slug));
    let slug = base;
    let n = 1;
    while (taken.has(slug)) {
      slug = `${base}-${n}`;
      n++;
    }

    const { data: run, error: runErr } = await supabase
      .from("test_runs")
      .insert({
        suite_id: suiteRow.id,
        slug,
        tester: tester ?? null,
        environment: environment ?? "localhost:3000",
        branch: branch ?? null,
        notes: notes ?? null,
      })
      .select("id, slug, run_date")
      .single();

    if (runErr || !run) {
      return NextResponse.json(
        { error: runErr?.message ?? "Failed to create run" },
        { status: 500 },
      );
    }

    const resultRows = selectedCases.map((c) => ({
      run_id: run.id,
      case_id: c.id,
      status: "not_tested",
    }));

    if (resultRows.length > 0) {
      const { error: seedErr } = await supabase.from("test_results").insert(resultRows);
      if (seedErr) {
        return NextResponse.json({ error: seedErr.message }, { status: 500 });
      }
    }

    return NextResponse.json({
      run_id: run.slug ?? run.id,
      run_date: run.run_date,
      case_count: resultRows.length,
    });
  },
);
