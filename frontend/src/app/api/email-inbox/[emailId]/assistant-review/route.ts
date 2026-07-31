export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { withApiGuardrails, parseJsonBody } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { createOutlookIntakeServiceClient } from "@/lib/supabase/service";
import { BrandonAssistantReviewPayloadSchema } from "@/lib/email-assistant/brandon-review";
import type { Database, Json } from "@/types/database.types";

type AssistantReviewInsert =
  Database["public"]["Tables"]["outlook_email_assistant_reviews"]["Insert"];

function nullableProjectId(value: number | null | undefined): number | null {
  return Number.isInteger(value) && value && value > 0 ? value : null;
}

function nullableTrimmed(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizeFieldFeedback(value: Record<string, unknown> | undefined) {
  return {
    action: value?.action === "correct" || value?.action === "incorrect" ? value.action : "unreviewed",
    priority:
      value?.priority === "correct" || value?.priority === "incorrect"
        ? value.priority
        : "unreviewed",
    category:
      value?.category === "correct" || value?.category === "incorrect"
        ? value.category
        : "unreviewed",
    project:
      value?.project === "correct" || value?.project === "incorrect"
        ? value.project
        : "unreviewed",
    owner:
      value?.owner === "correct" || value?.owner === "incorrect"
        ? value.owner
        : "unreviewed",
    reason:
      value?.reason === "correct" || value?.reason === "incorrect"
        ? value.reason
        : "unreviewed",
    score:
      value?.score === "correct" || value?.score === "incorrect"
        ? value.score
        : "unreviewed",
  };
}

export const POST = withApiGuardrails<{ emailId: string }>(
  "email-inbox/[emailId]/assistant-review#POST",
  async ({ request, params }) => {
    const supabase = await createClient();
    const intakeService = createOutlookIntakeServiceClient();
    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "email-inbox/[emailId]/assistant-review#POST",
        message: "Authentication required.",
      });
    }

    const { emailId: rawId } = await params;
    const emailId = Number.parseInt(rawId, 10);

    if (!Number.isFinite(emailId) || emailId <= 0) {
      throw new GuardrailError({
        code: "VALIDATION_ERROR",
        where: "email-inbox/[emailId]/assistant-review#POST",
        message: "Invalid email ID.",
        status: 400,
      });
    }

    const parsed = await parseJsonBody(
      request,
      BrandonAssistantReviewPayloadSchema,
      "email-inbox/[emailId]/assistant-review#POST",
    );

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("is_admin")
      .eq("id", user.id)
      .maybeSingle();

    const isAdmin = profile?.is_admin === true;

    const { data: email, error: fetchError } = await intakeService
      .from("outlook_email_intake")
      .select("id, graph_message_id, mailbox_user_id")
      .eq("id", emailId)
      .is("deleted_at", null)
      .maybeSingle();

    if (fetchError || !email) {
      throw new GuardrailError({
        code: "NOT_FOUND",
        where: "email-inbox/[emailId]/assistant-review#POST",
        message: "Email not found.",
        status: 404,
      });
    }

    if (!isAdmin && email.mailbox_user_id !== user.email) {
      throw new GuardrailError({
        code: "FORBIDDEN",
        where: "email-inbox/[emailId]/assistant-review#POST",
        message: "Not authorized to review this email.",
        status: 403,
      });
    }

    const now = new Date().toISOString();
    const projectAssignmentFeedback = parsed.projectAssignment
      ? {
          status: parsed.projectAssignment.status,
          correctedProjectId: nullableProjectId(parsed.projectAssignment.correctedProjectId),
          reasonSignals: parsed.projectAssignment.reasonSignals ?? [],
          reasonNote: nullableTrimmed(parsed.projectAssignment.reasonNote),
        }
      : undefined;

    if (parsed.projectAssignment?.status === "incorrect") {
      const { error: assignmentError } = await intakeService
        .from("outlook_email_intake")
        .update({ project_id: projectAssignmentFeedback?.correctedProjectId ?? null })
        .eq("id", email.id);

      if (assignmentError) {
        throw new GuardrailError({
          code: "INTERNAL_ERROR",
          where: "email-inbox/[emailId]/assistant-review#POST",
          message: `Failed to update corrected email project assignment: ${assignmentError.message}`,
        });
      }
    }

    const insert: AssistantReviewInsert = {
      intake_email_id: email.id,
      graph_message_id: email.graph_message_id,
      mailbox_user_id: email.mailbox_user_id,
      reviewer_id: user.id,
      reviewer_email: user.email ?? null,
      assistant_action: parsed.assistantAction,
      assistant_priority: parsed.assistantPriority,
      assistant_score: parsed.assistantScore ?? null,
      review_outcome: parsed.reviewOutcome,
      draft_body: parsed.draftBody ?? null,
      reviewer_note: parsed.reviewerNote ?? null,
      assistant_reason: parsed.assistantReason ?? null,
      assistant_owner: parsed.assistantOwner ?? null,
      assistant_risk: parsed.assistantRisk ?? null,
      assistant_evidence: parsed.assistantEvidence ?? null,
      source_metadata: {
        ...(parsed.sourceMetadata ?? {}),
        feedbackProvidedAt: now,
        feedbackProvidedBy: user.email ?? user.id,
        sandboxCategory: parsed.assistantCategory ?? null,
        fieldFeedback: normalizeFieldFeedback(parsed.fieldFeedback),
        ...(projectAssignmentFeedback ? { projectAssignmentFeedback } : {}),
      } as Json,
    };

    const { data: review, error: insertError } = await supabase
      .from("outlook_email_assistant_reviews")
      .insert(insert)
      .select("id, intake_email_id, review_outcome, created_at")
      .single();

    if (insertError) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where: "email-inbox/[emailId]/assistant-review#POST",
        message: insertError.message,
      });
    }

    return NextResponse.json(review, { status: 201 });
  },
);
