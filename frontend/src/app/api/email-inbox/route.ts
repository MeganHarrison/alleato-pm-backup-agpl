export const dynamic = "force-dynamic";

import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { deriveBrandonEmailAssistantDecision } from "@/lib/email-assistant/brandon-triage";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import {
  createOutlookIntakeServiceClient,
  createServiceClient,
} from "@/lib/supabase/service";
import { serviceDb } from "@/lib/supabase/service-db";
import { NextResponse } from "next/server";

const BRANDON_MAILBOX = "bclymer@alleatogroup.com";

interface ProjectRow {
  id: number;
  name: string | null;
  project_number: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export const GET = withApiGuardrails("email-inbox#GET", async ({ request }) => {
  const supabase = await createClient();
  const appService = createServiceClient();
  const intakeService = createOutlookIntakeServiceClient();
  const user = await getApiRouteUser();

  if (!user) {
    throw new GuardrailError({
      code: "AUTH_EXPIRED",
      where: "email-inbox#GET",
      message: "Authentication required.",
    });
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();

  const isAdmin = profile?.is_admin === true;
  const { searchParams } = new URL(request.url);
  const tab = searchParams.get("tab") ?? "needs-assignment";
  const q = searchParams.get("q") ?? "";

  let query = intakeService
    .from("outlook_email_intake")
    .select(
      `
      id,
      graph_message_id,
      mailbox_user_id,
      project_id,
      conversation_id,
      subject,
      body,
      body_html,
      body_text,
      from_name,
      from_email,
      to_list,
      cc_list,
      match_status,
      assignment_confidence,
      received_at,
      has_attachments,
      web_link,
      source_metadata,
      outlook_email_intake_attachments (
        id,
        file_name,
        file_size,
        content_type,
        graph_attachment_id,
        promotion_status,
        source_metadata
      )
    `,
    )
    .is("deleted_at", null)
    .order("received_at", { ascending: false })
    .limit(150);

  // Non-admins see only their own mailbox
  if (!isAdmin && user.email) {
    query = query.eq("mailbox_user_id", user.email);
  } else if (isAdmin && tab === "brandon-queue") {
    query = query.eq("mailbox_user_id", BRANDON_MAILBOX);

    // Exclude emails that have already been reviewed
    const { data: reviews } = await serviceDb.from("outlook_email_assistant_reviews")
      .select("intake_email_id");
    const reviewedIds = (reviews ?? []).map((r) => r.intake_email_id);
    if (reviewedIds.length > 0) {
      query = query.not("id", "in", `(${reviewedIds.join(",")})`);
    }
  }

  if (tab === "needs-assignment") {
    query = query.is("project_id", null);
  } else if (tab === "has-attachments") {
    query = query.eq("has_attachments", true);
  }

  if (q) {
    query = query.or(
      `subject.ilike.%${q}%,from_name.ilike.%${q}%,from_email.ilike.%${q}%`,
    );
  }

  const { data, error } = await query;

  if (error) {
    throw new GuardrailError({
      code: "INTERNAL_ERROR",
      where: "email-inbox#GET",
      message: error.message,
    });
  }

  const projectIds = [
    ...new Set(
      (data ?? [])
        .map((email) => email.project_id)
        .filter((projectId): projectId is number => Number.isInteger(projectId)),
    ),
  ];
  const projectsById = new Map<number, ProjectRow>();

  if (projectIds.length > 0) {
    const { data: projectRows, error: projectError } = await serviceDb.from("projects")
      .select("id, name, project_number")
      .in("id", projectIds);

    if (projectError) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where: "email-inbox#GET",
        message: projectError.message,
      });
    }

    for (const project of (projectRows ?? []) as ProjectRow[]) {
      projectsById.set(project.id, project);
    }
  }

  const enriched = (data ?? []).map((email) => {
    const sourceMetadata = isRecord(email.source_metadata)
      ? email.source_metadata
      : {};
    const project = email.project_id
      ? projectsById.get(email.project_id) ?? null
      : null;
    const assistantDecision = deriveBrandonEmailAssistantDecision({
      subject: email.subject,
      bodyText: email.body_text ?? email.body,
      fromEmail: email.from_email,
      fromName: email.from_name,
      toList: email.to_list,
      ccList: email.cc_list,
      mailboxUserId: email.mailbox_user_id,
      hasAttachments: email.has_attachments,
      receivedAt: email.received_at,
    });

    return {
      ...email,
      projects: project
        ? {
            id: project.id,
            name: project.name,
            project_number: project.project_number,
          }
        : null,
      source_metadata: {
        ...sourceMetadata,
        _assistant: assistantDecision,
      },
    };
  });

  const response =
    tab === "brandon-queue"
      ? enriched
          .filter((email) => {
            const assistant = isRecord(email.source_metadata)
              ? email.source_metadata._assistant
              : null;
            return isRecord(assistant) && assistant.action !== "ignore";
          })
          .sort((a, b) => {
            const assistantA = isRecord(a.source_metadata)
              ? a.source_metadata._assistant
              : null;
            const assistantB = isRecord(b.source_metadata)
              ? b.source_metadata._assistant
              : null;
            const scoreA =
              isRecord(assistantA) && typeof assistantA.score === "number"
                ? assistantA.score
                : 0;
            const scoreB =
              isRecord(assistantB) && typeof assistantB.score === "number"
                ? assistantB.score
                : 0;
            if (scoreA !== scoreB) return scoreB - scoreA;
            return (
              new Date(b.received_at ?? 0).getTime() -
              new Date(a.received_at ?? 0).getTime()
            );
          })
      : enriched;

  return NextResponse.json(response);
});
