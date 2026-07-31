/**
 * /api/testing/runs/[runId]/results/[resultId]
 * PATCH — update status and/or notes for a single test result.
 *
 * GitHub issue creation is NOT automatic here — use POST /github-issue instead.
 */
import { withApiGuardrails } from "@/lib/guardrails/api";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const PATCH = withApiGuardrails<{ runId: string; resultId: string }>(
  "testing/runs/[runId]/results/[resultId]#PATCH",
  async ({ request, params }) => {
    const { runId, resultId } = params;
    const supabase = await createClient();

    const body = await request.json();
    const { status, notes, severity, video_url } = body as {
      status?: string;
      notes?: string;
      severity?: string | null;
      video_url?: string | null;
    };

    const validStatuses = ["pass", "fail", "skip", "not_tested", "fixed"];
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const validSeverities = ["critical", "major", "minor", "cosmetic"];
    if (severity && !validSeverities.includes(severity)) {
      return NextResponse.json({ error: "Invalid severity" }, { status: 400 });
    }

    const updates: Record<string, unknown> = {};
    if (status !== undefined) updates.status = status;
    if (notes !== undefined) updates.notes = notes;
    if (severity !== undefined) updates.severity = severity ?? null;
    if (video_url !== undefined) updates.video_url = video_url ?? null;

    const { data, error } = await supabase
      .from("test_results")
      .update(updates)
      .eq("id", resultId)
      .eq("run_id", runId)
      .select("id, status, notes, severity, video_url, github_issue_number, github_issue_url, github_issue_state, updated_at")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ result: data });
  },
);
