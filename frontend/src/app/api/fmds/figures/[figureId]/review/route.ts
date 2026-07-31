import { NextResponse } from "next/server";
import { z } from "zod";

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

function hasInterpretation(value: unknown): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.keys(value).length > 0
  );
}

export async function POST(
  request: Request,
  context: { params: Promise<{ figureId: string }> },
) {
  try {
    const user = await getApiRouteUser();
    if (!user) {
      return NextResponse.json(
        { error: "Sign in before recording an FMDS figure review." },
        { status: 401 },
      );
    }
    const { figureId } = await context.params;
    const parsed = reviewSchema.parse(await request.json());
    const supabase = createAsrsServiceClient();
    const figureResult = await supabase
      .from("fmds_figures")
      .select("revision_id,evidence_image_path,extracted_description")
      .eq("id", figureId)
      .maybeSingle();
    if (figureResult.error) throw figureResult.error;
    if (!figureResult.data) {
      return NextResponse.json(
        { error: "FMDS figure not found." },
        { status: 404 },
      );
    }
    if (!figureResult.data.evidence_image_path) {
      return NextResponse.json(
        { error: "This figure has no rendered evidence image yet." },
        { status: 422 },
      );
    }

    let hasCandidate = hasInterpretation(
      figureResult.data.extracted_description,
    );
    if (parsed.candidateIds.length > 0) {
      const uniqueCandidateIds = [...new Set(parsed.candidateIds)];
      const candidatesResult = await supabase
        .from("fmds_visual_review_candidates")
        .select("id,output")
        .eq("source_type", "figure")
        .eq("source_id", figureId)
        .eq("status", "candidate")
        .in("id", uniqueCandidateIds);
      if (candidatesResult.error) throw candidatesResult.error;
      if (candidatesResult.data.length !== uniqueCandidateIds.length) {
        return NextResponse.json(
          {
            error:
              "The submitted interpretation is no longer active for this figure. Refresh before reviewing.",
          },
          { status: 409 },
        );
      }
      hasCandidate ||= candidatesResult.data.some((candidate) =>
        hasInterpretation(candidate.output),
      );
    }
    if (parsed.decision === "approved" && !hasCandidate) {
      return NextResponse.json(
        {
          error:
            "This figure cannot be approved because no interpretation exists to compare with the source.",
        },
        { status: 422 },
      );
    }

    const { data, error } = await supabase.rpc("record_fmds_visual_review", {
      requested_source_type: "figure",
      requested_source_id: figureId,
      requested_decision: parsed.decision,
      requested_reviewer_id: user.id,
      requested_reviewer_role: parsed.reviewerRole,
      requested_notes: parsed.notes,
      requested_evidence_paths: [figureResult.data.evidence_image_path],
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
          : "Unable to save FMDS figure review.";
    return NextResponse.json(
      { error: message },
      { status: 400 },
    );
  }
}
