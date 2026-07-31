export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { parseJsonBody, withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import {
  createOutlookIntakeServiceClient,
  createServiceClient,
} from "@/lib/supabase/service";
import { serviceDb } from "@/lib/supabase/service-db";
import {
  BrandonAssistantActionSchema,
  BrandonAssistantPrioritySchema,
  BrandonReviewOutcomeSchema,
  ProjectAssignmentFeedbackSchema,
} from "@/lib/email-assistant/brandon-review";
import type { Database, Json } from "@/types/database.types";

interface ProjectRow {
  id: number;
  name: string | null;
  project_number: string | null;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

function nullableTrimmed(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function nullableProjectId(value: number | null | undefined): number | null {
  return Number.isInteger(value) && value && value > 0 ? value : null;
}

const ReviewedEmailUpdateSchema = z.object({
  reviewId: z.string().uuid(),
  assistantAction: BrandonAssistantActionSchema.optional(),
  assistantPriority: BrandonAssistantPrioritySchema.optional(),
  assistantCategory: z.string().trim().max(100).nullable().optional(),
  reviewOutcome: BrandonReviewOutcomeSchema,
  reviewerNote: z.string().max(1_000).nullable().optional(),
  draftBody: z.string().max(20_000).nullable().optional(),
  projectAssignment: ProjectAssignmentFeedbackSchema.optional(),
  fieldFeedback: z
    .object({
      action: z.enum(["correct", "incorrect", "unreviewed"]).optional(),
      priority: z.enum(["correct", "incorrect", "unreviewed"]).optional(),
      category: z.enum(["correct", "incorrect", "unreviewed"]).optional(),
      draft: z.enum(["correct", "incorrect", "unreviewed"]).optional(),
      project: z.enum(["correct", "incorrect", "unreviewed"]).optional(),
      owner: z.enum(["correct", "incorrect", "unreviewed"]).optional(),
      reason: z.enum(["correct", "incorrect", "unreviewed"]).optional(),
      score: z.enum(["correct", "incorrect", "unreviewed"]).optional(),
    })
    .optional(),
});

type AssistantReviewUpdate =
  Database["public"]["Tables"]["outlook_email_assistant_reviews"]["Update"];

function parseProjectAssignmentFeedback(value: unknown): {
  status: "correct" | "incorrect" | "unreviewed";
  correctedProjectId: number | null;
  reasonSignals: Array<
    | "subject_line"
    | "sender"
    | "message_body"
    | "attachment"
    | "existing_project_context"
    | "other"
  >;
  reasonNote: string | null;
} {
  if (!isRecord(value)) {
    return {
      status: "unreviewed",
      correctedProjectId: null,
      reasonSignals: [],
      reasonNote: null,
    };
  }

  const status =
    value.status === "correct" || value.status === "incorrect"
      ? value.status
      : "unreviewed";
  const correctedProjectId =
    typeof value.correctedProjectId === "number" &&
    Number.isInteger(value.correctedProjectId)
      ? value.correctedProjectId
      : null;
  const reasonSignals = Array.isArray(value.reasonSignals)
    ? value.reasonSignals.filter((signal) =>
        signal === "subject_line" ||
        signal === "sender" ||
        signal === "message_body" ||
        signal === "attachment" ||
        signal === "existing_project_context" ||
        signal === "other",
      )
    : [];
  const reasonNote =
    typeof value.reasonNote === "string" && value.reasonNote.trim()
      ? value.reasonNote.trim()
      : null;

  return { status, correctedProjectId, reasonSignals, reasonNote };
}

function parseFieldFeedback(value: unknown) {
  const record = isRecord(value) ? value : {};
  const parseVerdict = (field: string) =>
    record[field] === "correct" || record[field] === "incorrect"
      ? record[field]
      : "unreviewed";

  return {
    action: parseVerdict("action"),
    priority: parseVerdict("priority"),
    category: parseVerdict("category"),
    draft: parseVerdict("draft"),
    project: parseVerdict("project"),
    owner: parseVerdict("owner"),
    reason: parseVerdict("reason"),
    score: parseVerdict("score"),
  };
}

export const GET = withApiGuardrails("email-inbox/reviewed#GET", async () => {
  const supabase = await createClient();
  const appService = createServiceClient();
  const intakeService = createOutlookIntakeServiceClient();
  const user = await getApiRouteUser();

  if (!user) {
    throw new GuardrailError({
      code: "AUTH_EXPIRED",
      where: "email-inbox/reviewed#GET",
      message: "Authentication required.",
    });
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();

  const isAdmin = profile?.is_admin === true;

  if (!isAdmin && !user.email) {
    throw new GuardrailError({
      code: "FORBIDDEN",
      where: "email-inbox/reviewed#GET",
      message: "Email address is required to load reviewed mailbox feedback.",
      status: 403,
    });
  }

  // Fetch reviews from PM APP, most recent first
  let reviewQuery = serviceDb.from("outlook_email_assistant_reviews")
    .select(
      "id, intake_email_id, assistant_action, assistant_priority, review_outcome, reviewer_note, draft_body, assistant_reason, created_at, graph_message_id, mailbox_user_id, source_metadata",
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (!isAdmin) {
    // Non-admins are scoped to their own mailbox. If the session somehow has no
    // email, scope to a sentinel that matches nothing (fail closed) rather than
    // dropping the filter and exposing every mailbox's reviews.
    reviewQuery = reviewQuery.eq("mailbox_user_id", user.email ?? "");
  }

  const { data: reviews, error: reviewError } = await reviewQuery;

  if (reviewError) {
    throw new GuardrailError({
      code: "INTERNAL_ERROR",
      where: "email-inbox/reviewed#GET",
      message: reviewError.message,
    });
  }

  if (!reviews || reviews.length === 0) {
    return NextResponse.json([]);
  }

  // Fetch corresponding intake emails from AI DB
  const intakeIds = [...new Set(reviews.map((r) => r.intake_email_id))];

  const { data: intakeEmails, error: intakeError } = await intakeService
    .from("outlook_email_intake")
    .select(
      "id, subject, from_name, from_email, received_at, project_id, source_metadata, body_html, body_text, body, web_link",
    )
    .in("id", intakeIds);

  if (intakeError) {
    throw new GuardrailError({
      code: "INTERNAL_ERROR",
      where: "email-inbox/reviewed#GET",
      message: intakeError.message,
    });
  }

  const emailById = new Map(
    (intakeEmails ?? []).map((e) => [e.id, e]),
  );

  // Fetch projects
  const projectIds = [
    ...new Set(
      (intakeEmails ?? [])
        .map((e) => e.project_id)
        .filter((id): id is number => Number.isInteger(id)),
    ),
  ];

  const projectsById = new Map<number, ProjectRow>();
  if (projectIds.length > 0) {
    const { data: projectRows } = await serviceDb.from("projects")
      .select("id, name, project_number")
      .in("id", projectIds);
    for (const p of (projectRows ?? []) as ProjectRow[]) {
      projectsById.set(p.id, p);
    }
  }

  const enriched = reviews.map((review) => {
    const email = emailById.get(review.intake_email_id);
    const sourceMeta = isRecord(email?.source_metadata)
      ? email.source_metadata
      : {};
    const inbox = isRecord(sourceMeta._inbox) ? sourceMeta._inbox : {};
    const reviewMeta = isRecord(review.source_metadata)
      ? review.source_metadata
      : {};

    const project = email?.project_id
      ? projectsById.get(email.project_id) ?? null
      : null;

    return {
      reviewId: review.id,
      id: review.intake_email_id,
      subject: email?.subject ?? "(no subject)",
      fromName: email?.from_name ?? null,
      fromEmail: email?.from_email ?? null,
      receivedAt: email?.received_at ?? null,
      bodyHtml: email?.body_html ?? null,
      bodyText: email?.body_text ?? null,
      body: email?.body ?? null,
      webLink: email?.web_link ?? null,
      reviewOutcome: review.review_outcome,
      assistantAction: review.assistant_action ?? null,
      assistantPriority: review.assistant_priority ?? null,
      reviewerNote: review.reviewer_note ?? null,
      draftBody: review.draft_body ?? null,
      assistantCategory:
        typeof reviewMeta.sandboxCategory === "string" && reviewMeta.sandboxCategory.trim()
          ? reviewMeta.sandboxCategory.trim()
          : null,
      assistantReason: review.assistant_reason ?? null,
      feedbackProvidedAt:
        typeof reviewMeta.feedbackProvidedAt === "string"
          ? reviewMeta.feedbackProvidedAt
          : null,
      fieldFeedback: parseFieldFeedback(reviewMeta.fieldFeedback),
      projectAssignmentFeedback: parseProjectAssignmentFeedback(
        reviewMeta.projectAssignmentFeedback,
      ),
      reviewedAt: review.created_at,
      starred: (inbox.starred as boolean) ?? false,
      tags: (inbox.tags as string[]) ?? [],
      project: project
        ? {
            id: project.id,
            name: project.name,
            projectNumber: project.project_number,
          }
        : null,
    };
  });

  return NextResponse.json(enriched);
});

export const PATCH = withApiGuardrails("email-inbox/reviewed#PATCH", async ({ request }) => {
  const supabase = await createClient();
  const appService = createServiceClient();
  const intakeService = createOutlookIntakeServiceClient();
  const user = await getApiRouteUser();

  if (!user) {
    throw new GuardrailError({
      code: "AUTH_EXPIRED",
      where: "email-inbox/reviewed#PATCH",
      message: "Authentication required.",
    });
  }

  const parsed = await parseJsonBody(
    request,
    ReviewedEmailUpdateSchema,
    "email-inbox/reviewed#PATCH",
  );

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();

  const isAdmin = profile?.is_admin === true;

  const { data: existingReview, error: existingError } = await serviceDb.from("outlook_email_assistant_reviews")
    .select("id, mailbox_user_id, intake_email_id, source_metadata")
    .eq("id", parsed.reviewId)
    .maybeSingle();

  if (existingError) {
    throw new GuardrailError({
      code: "INTERNAL_ERROR",
      where: "email-inbox/reviewed#PATCH",
      message: existingError.message,
    });
  }

  if (!existingReview) {
    throw new GuardrailError({
      code: "NOT_FOUND",
      where: "email-inbox/reviewed#PATCH",
      message: "Reviewed email feedback was not found.",
      status: 404,
    });
  }

  if (!isAdmin && existingReview.mailbox_user_id !== user.email) {
    throw new GuardrailError({
      code: "FORBIDDEN",
      where: "email-inbox/reviewed#PATCH",
      message: "Not authorized to edit this reviewed email feedback.",
      status: 403,
    });
  }

  const existingMetadata = isRecord(existingReview.source_metadata)
    ? existingReview.source_metadata
    : {};
  const now = new Date().toISOString();
  const projectAssignmentFeedback = parsed.projectAssignment
    ? {
        status: parsed.projectAssignment.status,
        correctedProjectId: nullableProjectId(parsed.projectAssignment.correctedProjectId),
        reasonSignals: parsed.projectAssignment.reasonSignals ?? [],
        reasonNote: nullableTrimmed(parsed.projectAssignment.reasonNote),
      }
    : parseProjectAssignmentFeedback(existingMetadata.projectAssignmentFeedback);
  const fieldFeedback = parseFieldFeedback(
    parsed.fieldFeedback ?? existingMetadata.fieldFeedback,
  );
  const sandboxCategory =
    parsed.assistantCategory === undefined
      ? nullableTrimmed(
          typeof existingMetadata.sandboxCategory === "string"
            ? existingMetadata.sandboxCategory
            : null,
        )
      : nullableTrimmed(parsed.assistantCategory);

  const update: AssistantReviewUpdate = {
    ...(parsed.assistantAction ? { assistant_action: parsed.assistantAction } : {}),
    ...(parsed.assistantPriority ? { assistant_priority: parsed.assistantPriority } : {}),
    review_outcome: parsed.reviewOutcome,
    reviewer_note: nullableTrimmed(parsed.reviewerNote),
    draft_body: nullableTrimmed(parsed.draftBody),
    source_metadata: {
      ...existingMetadata,
      feedbackProvidedAt: now,
      feedbackProvidedBy: user.email ?? user.id,
      sandboxCategory,
      fieldFeedback,
      projectAssignmentFeedback,
    } as Json,
    updated_at: now,
  };

  if (parsed.projectAssignment?.status === "incorrect") {
    const { error: assignmentError } = await intakeService
      .from("outlook_email_intake")
      .update({ project_id: projectAssignmentFeedback.correctedProjectId })
      .eq("id", existingReview.intake_email_id);

    if (assignmentError) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where: "email-inbox/reviewed#PATCH",
        message: `Failed to update corrected email project assignment: ${assignmentError.message}`,
      });
    }
  }

  const { data: updatedReview, error: updateError } = await serviceDb.from("outlook_email_assistant_reviews")
    .update(update)
    .eq("id", parsed.reviewId)
    .select("id, intake_email_id, assistant_action, assistant_priority, review_outcome, reviewer_note, draft_body, source_metadata, updated_at")
    .single();

  if (updateError) {
    throw new GuardrailError({
      code: "INTERNAL_ERROR",
      where: "email-inbox/reviewed#PATCH",
      message: updateError.message,
    });
  }

  const updatedMetadata = isRecord(updatedReview.source_metadata)
    ? updatedReview.source_metadata
    : {};

  return NextResponse.json({
    reviewId: updatedReview.id,
    id: updatedReview.intake_email_id,
    assistantAction: updatedReview.assistant_action,
    assistantPriority: updatedReview.assistant_priority,
    reviewOutcome: updatedReview.review_outcome,
    reviewerNote: updatedReview.reviewer_note ?? null,
    draftBody: updatedReview.draft_body ?? null,
    assistantCategory:
      typeof updatedMetadata.sandboxCategory === "string" && updatedMetadata.sandboxCategory.trim()
        ? updatedMetadata.sandboxCategory.trim()
        : null,
    feedbackProvidedAt:
      typeof updatedMetadata.feedbackProvidedAt === "string"
        ? updatedMetadata.feedbackProvidedAt
        : null,
    fieldFeedback: parseFieldFeedback(updatedMetadata.fieldFeedback),
    projectAssignmentFeedback: parseProjectAssignmentFeedback(
      updatedMetadata.projectAssignmentFeedback,
    ),
    updatedAt: updatedReview.updated_at,
  });
});
