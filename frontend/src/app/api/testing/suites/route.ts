/**
 * /api/testing/suites
 * GET — list all test suites (one per tool_name + suite_type) with case counts
 *
 * Schema note: test_suites now has a `suite_type` column ('smoke' | 'feature')
 * with a unique constraint on (tool_name, suite_type).
 */
import { withApiGuardrails } from "@/lib/guardrails/api";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const GET = withApiGuardrails(
  "testing/suites#GET",
  async ({ request }) => {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const typeFilterRaw = searchParams.get("type");
    const typeFilter: "smoke" | "feature" | null =
      typeFilterRaw === "smoke" || typeFilterRaw === "feature" ? typeFilterRaw : null;

    let suitesQuery = supabase
      .from("test_suites")
      .select("id, tool_name, display_name, suite_type, total_cases, source_doc_count, last_generated_at")
      .order("display_name");
    if (typeFilter) {
      suitesQuery = suitesQuery.eq("suite_type", typeFilter);
    }

    const [suitesRes, casesRes] = await Promise.all([
      suitesQuery,
      supabase
        .from("test_cases")
        .select("id, suite_id, test_type, priority")
        .filter("status", "neq", "inactive"),
    ]);

    if (suitesRes.error) {
      return NextResponse.json({ error: suitesRes.error.message }, { status: 500 });
    }
    if (casesRes.error) {
      return NextResponse.json({ error: casesRes.error.message }, { status: 500 });
    }

    const allCases = (casesRes.data ?? []) as {
      id: string;
      suite_id: string;
      test_type: string;
      priority: string;
    }[];

    const suites = (suitesRes.data ?? []).map((s) => {
      const cases = allCases.filter((c) => c.suite_id === s.id);
      return {
        id: s.id,
        tool_name: s.tool_name,
        display_name: s.display_name,
        suite_type: (s as { suite_type?: "smoke" | "feature" }).suite_type ?? "feature",
        last_generated_at: s.last_generated_at,
        case_count: cases.length,
        feature_count: cases.filter((c) => c.test_type === "feature").length,
        scenario_count: cases.filter((c) => c.test_type === "scenario").length,
        high_count: cases.filter((c) => c.priority === "HIGH").length,
      };
    });

    return NextResponse.json({ suites });
  },
);
