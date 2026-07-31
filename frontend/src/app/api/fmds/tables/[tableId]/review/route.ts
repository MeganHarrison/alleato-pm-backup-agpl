import { NextResponse } from "next/server";
import { z } from "zod";

import {
  candidateOutputHasStructuredRows,
  hasStructuredTableRows,
} from "@/lib/fmds/fmds-vision-candidate";
import { getApiRouteUser } from "@/lib/supabase/server";
import { createAsrsServiceClient } from "@/lib/supabase/service";

const reviewSchema = z.object({
  decision: z.enum(["approved", "rejected", "changes_requested"]),
  notes: z
    .string()
    .trim()
    .min(10, "Add at least 10 characters of review notes."),
  reviewerRole: z.string().trim().min(1).default("FMDS reviewer"),
  evidencePaths: z.array(z.string().trim().min(1)).optional(),
  candidateIds: z.array(z.string().uuid()).max(10).default([]),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ tableId: string }> },
) {
  try {
    const user = await getApiRouteUser();
    if (!user) {
      return NextResponse.json(
        { error: "Sign in before recording an FMDS table review." },
        { status: 401 },
      );
    }
    const { tableId } = await context.params;
    const parsed = reviewSchema.parse(await request.json());
    const supabase = createAsrsServiceClient();
    const tableResult = await supabase
      .from("fmds_tables")
      .select("revision_id,evidence_image_path,extracted_structure")
      .eq("id", tableId)
      .maybeSingle();
    if (tableResult.error) throw tableResult.error;
    if (!tableResult.data) {
      return NextResponse.json(
        { error: "FMDS table not found." },
        { status: 404 },
      );
    }
    const sourceEvidencePath = tableResult.data.evidence_image_path;
    if (!sourceEvidencePath) {
      return NextResponse.json(
        { error: "This table has no rendered evidence image yet." },
        { status: 422 },
      );
    }
    let candidateEvidencePath: string | null = null;
    let hasStructuredCandidate = false;
    if (parsed.candidateIds.length > 0) {
      const uniqueCandidateIds = [...new Set(parsed.candidateIds)];
      const candidatesResult = await supabase
        .from("fmds_visual_review_candidates")
        .select("id,output")
        .eq("source_type", "table")
        .eq("source_id", tableId)
        .eq("status", "candidate")
        .in("id", uniqueCandidateIds);
      if (candidatesResult.error) throw candidatesResult.error;
      if (candidatesResult.data.length !== uniqueCandidateIds.length) {
        return NextResponse.json(
          {
            error:
              "The submitted extraction candidate is no longer active for this table. Refresh the page before reviewing.",
          },
          { status: 409 },
        );
      }
      hasStructuredCandidate = candidatesResult.data.some((candidate) =>
        candidateOutputHasStructuredRows(candidate.output),
      );
      const firstOutput = candidatesResult.data[0]?.output;
      if (
        firstOutput &&
        typeof firstOutput === "object" &&
        !Array.isArray(firstOutput) &&
        typeof firstOutput.evidence_image_path === "string"
      ) {
        candidateEvidencePath = firstOutput.evidence_image_path;
      }
    }
    const evidencePaths = [candidateEvidencePath, sourceEvidencePath].filter(
      (path, index, values): path is string =>
        Boolean(path) && values.indexOf(path) === index,
    );
    if (parsed.decision === "approved") {
      const hasExtractedRows = hasStructuredTableRows(
        tableResult.data.extracted_structure,
      );
      const cellsResult = await supabase
        .from("fmds_table_cells")
        .select("id", { count: "exact", head: true })
        .eq("table_id", tableId);
      if (cellsResult.error) throw cellsResult.error;

      if (!hasExtractedRows && !cellsResult.count && !hasStructuredCandidate) {
        return NextResponse.json(
          {
            error:
              "This table cannot be approved because no structured extraction exists to compare with the source.",
          },
          { status: 422 },
        );
      }
    }
    const { data, error } = await supabase.rpc("record_fmds_visual_review", {
      requested_source_type: "table",
      requested_source_id: tableId,
      requested_decision: parsed.decision,
      requested_reviewer_id: user.id,
      requested_reviewer_role: parsed.reviewerRole,
      requested_notes: parsed.notes,
      requested_evidence_paths: evidencePaths,
      requested_candidate_ids: parsed.candidateIds,
    });
    if (error) throw error;
    return NextResponse.json({ ok: true, eventId: data });
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? (error.issues[0]?.message ?? "The review payload is invalid.")
        : error instanceof Error
          ? error.message
          : "Unable to save FMDS review.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
