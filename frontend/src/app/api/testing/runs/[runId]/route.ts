/**
 * /api/testing/runs/[runId]
 * GET    — resolve slug or UUID → run + suite metadata + sibling slug
 * DELETE — delete a test run and all child records
 */
import { withApiGuardrails } from "@/lib/guardrails/api";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { NextResponse } from "next/server";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const GET = withApiGuardrails<{ runId: string }>(
  "testing/runs/[runId]#GET",
  async ({ params }) => {
    const { runId } = await params;
    const supabase = await createClient();

    const isUUID = UUID_RE.test(runId);
    const { data: run, error } = await supabase
      .from("test_runs")
      .select("id, slug, run_date, tester, environment, branch, suite_id")
      .eq(isUUID ? "id" : "slug", runId)
      .single();

    if (error || !run) {
      return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }

    const { data: suite } = await supabase
      .from("test_suites")
      .select("id, tool_name, display_name, suite_type")
      .eq("id", run.suite_id)
      .single();

    // Find the latest run of the opposite suite type for the same tool.
    let siblingSlug: string | null = null;
    if (suite) {
      const otherType = suite.suite_type === "smoke" ? "feature" : "smoke";
      const { data: otherSuite } = await supabase
        .from("test_suites")
        .select("id")
        .eq("tool_name", suite.tool_name)
        .eq("suite_type", otherType)
        .single();
      if (otherSuite) {
        const { data: siblingRun } = await supabase
          .from("test_runs")
          .select("id, slug")
          .eq("suite_id", otherSuite.id)
          .order("run_date", { ascending: false })
          .limit(1)
          .single();
        siblingSlug = siblingRun?.slug ?? siblingRun?.id ?? null;
      }
    }

    return NextResponse.json({
      run: { ...run, suite },
      sibling_slug: siblingSlug,
    });
  },
);

export const DELETE = withApiGuardrails<{ runId: string }>(
  "testing/runs/[runId]#DELETE",
  async ({ params }) => {
    const { runId } = params;
    const supabase = await createClient();
    const service = createServiceClient();

    const { data: run, error: runError } = await supabase
      .from("test_runs")
      .select("id")
      .eq("id", runId)
      .single();

    if (runError || !run) {
      return NextResponse.json(
        { error: runError?.message ?? "Run not found", code: "NOT_FOUND", where: "testing/runs DELETE" },
        { status: 404 },
      );
    }

    const { data: results, error: resultsError } = await supabase
      .from("test_results")
      .select("id")
      .eq("run_id", runId);

    if (resultsError) {
      return NextResponse.json(
        { error: resultsError.message, code: "DB_ERROR", where: "testing/runs DELETE:load-results" },
        { status: 500 },
      );
    }

    const resultIds = (results ?? []).map((result) => result.id);

    if (resultIds.length > 0) {
      const { data: screenshots, error: screenshotsError } = await supabase
        .from("test_screenshots")
        .select("id, storage_path")
        .in("result_id", resultIds);

      if (screenshotsError) {
        return NextResponse.json(
          { error: screenshotsError.message, code: "DB_ERROR", where: "testing/runs DELETE:load-screenshots" },
          { status: 500 },
        );
      }

      const storagePaths = (screenshots ?? [])
        .map((screenshot) => screenshot.storage_path)
        .filter((path): path is string => Boolean(path));

      if (storagePaths.length > 0) {
        // Sensitive: removes screenshot blobs from storage for test evidence tied to this run.
        const { error: storageDeleteError } = await service.storage
          .from("test-screenshots")
          .remove(storagePaths);

        if (storageDeleteError) {
          return NextResponse.json(
            { error: storageDeleteError.message, code: "STORAGE_ERROR", where: "testing/runs DELETE:remove-storage" },
            { status: 500 },
          );
        }
      }

      const { error: screenshotDeleteError } = await supabase
        .from("test_screenshots")
        .delete()
        .in("result_id", resultIds);

      if (screenshotDeleteError) {
        return NextResponse.json(
          { error: screenshotDeleteError.message, code: "DB_ERROR", where: "testing/runs DELETE:delete-screenshots" },
          { status: 500 },
        );
      }

      // Sensitive: deletes persisted test result records associated with this run.
      const { error: resultDeleteError } = await supabase
        .from("test_results")
        .delete()
        .eq("run_id", runId);

      if (resultDeleteError) {
        return NextResponse.json(
          { error: resultDeleteError.message, code: "DB_ERROR", where: "testing/runs DELETE:delete-results" },
          { status: 500 },
        );
      }
    }

    const { error: deleteRunError } = await supabase
      .from("test_runs")
      .delete()
      .eq("id", runId);

    if (deleteRunError) {
      return NextResponse.json(
        { error: deleteRunError.message, code: "DB_ERROR", where: "testing/runs DELETE:delete-run" },
        { status: 500 },
      );
    }

    return NextResponse.json({ deleted: true, run_id: runId, deleted_result_count: resultIds.length });
  },
);
