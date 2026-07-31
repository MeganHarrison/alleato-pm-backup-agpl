/**
 * /api/dev/test-runs
 * POST — start a new test run for a suite. Pre-creates one not_tested
 *        result row per case so the UI can PATCH them as the tester goes.
 */
import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { apiErrorResponse } from "@/lib/api-error";

export const POST = withApiGuardrails(
  "dev/test-runs#POST",
  async ({ request }) => {
  
    const supabase = await createClient();
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "dev/test-runs#POST", message: "Authentication required." });
    }

    const body = await request.json();
    const { suite_id, tester, environment, branch, notes } = body ?? {};
    if (!suite_id) {
      return NextResponse.json({ error: "suite_id required" }, { status: 400 });
    }

    const { data: run, error: runError } = await supabase
      .from("test_runs")
      .insert({
        suite_id,
        tester: tester ?? user.email ?? null,
        environment: environment ?? "localhost:3000",
        branch: branch ?? null,
        notes: notes ?? null,
      })
      .select("id, suite_id, tester, environment, branch, notes, run_date")
      .single();
    if (runError) throw runError;

    const { data: cases, error: casesError } = await supabase
      .from("test_cases")
      .select("id")
      .eq("suite_id", suite_id);
    if (casesError) throw casesError;

    if (cases && cases.length > 0) {
      const rows = cases.map((c) => ({
        run_id: run.id,
        case_id: c.id,
        status: "not_tested" as const,
      }));
      const { error: insertError } = await supabase.from("test_results").insert(rows);
      if (insertError) throw insertError;
    }

    return NextResponse.json({ run });
    },
);
