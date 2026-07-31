/**
 * /api/dev/test-runs/[runId]
 * GET — return a run with its results joined to test_cases.
 */
import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { apiErrorResponse } from "@/lib/api-error";

export const GET = withApiGuardrails<{ runId: string }>(
  "dev/test-runs/[runId]#GET",
  async ({ request, params }) => {
  
    const { runId } = await params;
    const supabase = await createClient();
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "dev/test-runs/[runId]#GET", message: "Authentication required." });
    }

    const { data: run, error: runError } = await supabase
      .from("test_runs")
      .select("id, suite_id, tester, environment, branch, notes, run_date")
      .eq("id", runId)
      .single();
    if (runError) throw runError;

    const { data: results, error: resultsError } = await supabase
      .from("test_results")
      .select("id, case_id, status, notes, test_cases(test_number, test_name, category, steps, expected_result, priority)")
      .eq("run_id", runId);
    if (resultsError) throw resultsError;

    return NextResponse.json({ run, results: results ?? [] });
    },
);
