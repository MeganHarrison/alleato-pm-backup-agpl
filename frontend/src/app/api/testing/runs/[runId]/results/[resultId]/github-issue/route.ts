/**
 * /api/testing/runs/[runId]/results/[resultId]/github-issue
 * POST — create a GitHub issue for this test failure on demand.
 *
 * Idempotent: if the result already has a github_issue_url it is returned as-is.
 * Returns 409 if the result status is not "fail".
 */
import { withApiGuardrails } from "@/lib/guardrails/api";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createTestFailureGitHubIssue } from "@/lib/testing/github";

type ResultRow = {
  id: string;
  status: string;
  notes: string | null;
  severity: string | null;
  github_issue_number: number | null;
  github_issue_url: string | null;
  github_issue_state: string | null;
  test_cases: {
    test_number: string;
    test_name: string;
    category: string;
    subcategory: string | null;
    steps: string | null;
    expected_result: string | null;
    start_url: string | null;
  } | null;
  test_runs: {
    id: string;
    slug: string | null;
    test_suites: { tool_name: string; display_name: string } | null;
  } | null;
};

export const POST = withApiGuardrails<{ runId: string; resultId: string }>(
  "testing/runs/[runId]/results/[resultId]/github-issue#POST",
  async ({ params }) => {
    const { runId, resultId } = await params;
    const supabase = await createClient();

    // Load the result with everything needed to build the issue body.
    const { data: row, error: fetchErr } = await supabase
      .from("test_results")
      .select(
        "id, status, notes, severity, github_issue_number, github_issue_url, github_issue_state, " +
        "test_cases(test_number, test_name, category, subcategory, steps, expected_result, start_url), " +
        "test_runs(id, slug, test_suites(tool_name, display_name))"
      )
      .eq("id", resultId)
      .single() as { data: ResultRow | null; error: unknown };

    if (fetchErr || !row) {
      return NextResponse.json({ error: "Result not found" }, { status: 404 });
    }

    // Only file issues for failures.
    if (row.status !== "fail") {
      return NextResponse.json(
        { error: `Cannot file a GitHub issue for a result with status "${row.status}". Mark it as failed first.` },
        { status: 409 },
      );
    }

    // Idempotent: already has an issue.
    if (row.github_issue_url) {
      return NextResponse.json({
        result: {
          github_issue_number: row.github_issue_number,
          github_issue_url: row.github_issue_url,
          github_issue_state: row.github_issue_state,
        },
        already_existed: true,
      });
    }

    const tc = row.test_cases;
    if (!tc) {
      return NextResponse.json({ error: "Test case data not found for this result" }, { status: 500 });
    }

    const run = row.test_runs;

    const issue = await createTestFailureGitHubIssue({
      testNumber: tc.test_number,
      testName: tc.test_name,
      category: tc.category,
      subcategory: tc.subcategory,
      notes: row.notes,
      severity: row.severity,
      startUrl: tc.start_url,
      expectedResult: tc.expected_result,
      steps: tc.steps,
      runId,
      runSlug: run?.slug ?? null,
      toolName: run?.test_suites?.display_name ?? null,
    });

    if (!issue) {
      return NextResponse.json(
        { error: "GitHub integration is not configured (missing GITHUB_FEEDBACK_REPO_OWNER, GITHUB_FEEDBACK_REPO_NAME, or GITHUB_FEEDBACK_TOKEN)" },
        { status: 503 },
      );
    }

    // Persist the issue back onto the result row.
    const { data: updated, error: updateErr } = await supabase
      .from("test_results")
      .update({
        github_issue_number: issue.number,
        github_issue_url: issue.url,
        github_issue_state: issue.state,
      })
      .eq("id", resultId)
      .select("id, status, notes, severity, video_url, github_issue_number, github_issue_url, github_issue_state, updated_at")
      .single();

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({ result: updated, already_existed: false });
  },
);
