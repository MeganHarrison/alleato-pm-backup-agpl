/**
 * /api/dev/test-suites/[tool]
 * GET — return the smoke AND feature test suites + cases for a given tool slug.
 *
 * Response shape: { smoke: { suite, cases } | null, feature: { suite, cases } | null }
 * Legacy `{ suite, cases }` still returned for back-compat (prefers "feature").
 */
import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";

type SuiteType = "smoke" | "feature";

export const GET = withApiGuardrails<{ tool: string }>(
  "dev/test-suites/[tool]#GET",
  async ({ request, params }) => {
    const { tool } = await params;
    const supabase = await createClient();

    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "dev/test-suites/[tool]#GET", message: "Authentication required." });
    }

    const { data: suites, error: suitesError } = await supabase
      .from("test_suites")
      .select("id, tool_name, display_name, total_cases, suite_type")
      .eq("tool_name", tool);

    if (suitesError) throw suitesError;

    const suitesList = (suites ?? []) as Array<{
      id: string;
      tool_name: string;
      display_name: string;
      total_cases: number | null;
      suite_type: SuiteType | null;
    }>;

    if (suitesList.length === 0) {
      return NextResponse.json({ suite: null, cases: [], smoke: null, feature: null });
    }

    const suiteIds = suitesList.map((s) => s.id);
    const { data: cases, error: casesError } = await supabase
      .from("test_cases")
      .select("id, test_number, category, subcategory, test_name, steps, expected_result, priority, suite_id")
      .in("suite_id", suiteIds)
      .order("test_number", { ascending: true });

    if (casesError) throw casesError;

    const casesList = cases ?? [];
    const buildBucket = (type: SuiteType) => {
      const suite = suitesList.find((s) => (s.suite_type ?? "feature") === type);
      if (!suite) return null;
      return {
        suite,
        cases: casesList.filter((c: { suite_id: string }) => c.suite_id === suite.id),
      };
    };

    const smoke = buildBucket("smoke");
    const feature = buildBucket("feature");

    // Back-compat: legacy callers expect { suite, cases } — prefer feature, fallback to smoke.
    const legacy = feature ?? smoke ?? { suite: null, cases: [] };

    return NextResponse.json({
      smoke,
      feature,
      suite: legacy.suite,
      cases: legacy.cases,
    });
  },
);
