import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import {
  createOutlookIntakeServiceClient,
  createServiceClient,
} from "@/lib/supabase/service";
import { serviceDb } from "@/lib/supabase/service-db";
import { NextResponse } from "next/server";

interface IntakeProjectRow {
  id: number;
  name: string | null;
  project_number: string | null;
}

interface IntakeAttachmentRow {
  id: number;
  file_name: string;
  file_size: number | null;
  content_type: string | null;
  created_at: string | null;
}

interface OutlookIntakeRow {
  id: number;
  graph_message_id: string;
  mailbox_user_id: string;
  project_id: number | null;
  document_metadata_id: string | null;
  conversation_id: string | null;
  subject: string;
  body: string | null;
  body_html: string | null;
  body_text: string | null;
  from_name: string | null;
  from_email: string | null;
  to_list: string[] | null;
  match_status: string;
  assignment_method: string | null;
  assignment_confidence: number | null;
  received_at: string | null;
  has_attachments: boolean | null;
  web_link: string | null;
  created_at: string | null;
  source_metadata: Record<string, unknown> | null;
  triage_action: string | null;
  triage_reason: string | null;
  triage_at: string | null;
  outlook_email_intake_attachments: IntakeAttachmentRow[] | null;
}

const DOCUMENT_STATUS_LOOKUP_BATCH_SIZE = 25;

async function assertAdminAccess(where: string) {
  const supabase = await createClient();
  const user = await getApiRouteUser();

  if (!user) {
    throw new GuardrailError({
      code: "AUTH_EXPIRED",
      where,
      message: "Authentication required.",
    });
  }

  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (profileError) {
    throw new GuardrailError({
      code: "INTERNAL_ERROR",
      where,
      message: profileError.message,
    });
  }

  if (!profile?.is_admin) {
    throw new GuardrailError({
      code: "FORBIDDEN",
      where,
      message: "Admin access required.",
      status: 403,
    });
  }

  return supabase;
}

export const GET = withApiGuardrails(
  "outlook-intake#GET",
  async ({ request }) => {
    const supabase = await assertAdminAccess("outlook-intake#GET");
    const { searchParams } = new URL(request.url);
    const projectId = parseOptionalProjectId(searchParams.get("project_id"));
    const appService = createServiceClient();
    const intakeService = createOutlookIntakeServiceClient();
    const matchStatus = searchParams.get("match_status");
    const classificationAction = searchParams.get("classification_action");
    const sentFrom = normalizeSearchParam(searchParams.get("sent_from"));
    const sentTo = normalizeSearchParam(searchParams.get("sent_to"));
    const tag = normalizeSearchParam(searchParams.get("tag"));
    const triageAction = normalizeSearchParam(searchParams.get("triage_action"));
    const unassigned = searchParams.get("unassigned") === "true";

    let query = intakeService
      .from("outlook_email_intake")
      .select(
        `
        id,
        graph_message_id,
        mailbox_user_id,
        project_id,
        document_metadata_id,
        conversation_id,
        subject,
        body,
        body_html,
        body_text,
        from_name,
        from_email,
        to_list,
        match_status,
        assignment_method,
        assignment_confidence,
        received_at,
        has_attachments,
        web_link,
        created_at,
        source_metadata,
        triage_action,
        triage_reason,
        triage_at,
        outlook_email_intake_attachments (
          id,
          file_name,
          file_size,
          content_type,
          created_at
        )
      `,
      )
      .is("deleted_at", null)
      .order("received_at", { ascending: false, nullsFirst: false });

    if (matchStatus) {
      query = query.eq("match_status", matchStatus);
    } else {
      query = query.neq("match_status", "ignored");
    }

    if (projectId !== null) {
      query = query.eq("project_id", projectId);
    }

    if (unassigned) {
      query = query.is("project_id", null);
    }

    if (classificationAction) {
      query = query.eq(
        "source_metadata->intake_classification->>action",
        classificationAction,
      );
    }

    if (sentFrom) {
      query = query.or(
        `from_email.ilike.%${escapePostgrestLike(sentFrom)}%,from_name.ilike.%${escapePostgrestLike(sentFrom)}%`,
      );
    }

    if (sentTo) {
      query = query.or(
        `mailbox_user_id.ilike.%${escapePostgrestLike(sentTo)}%,to_list.cs.{${escapePostgrestArrayValue(sentTo)}}`,
      );
    }

    if (tag) {
      query = query.contains("source_metadata->user_tags", [tag]);
    }

    if (triageAction) {
      query = query.eq("triage_action", triageAction);
    }

    const { data, error } = await query;

    if (error) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where: "outlook-intake#GET",
        message: error.message,
      });
    }

    const intakeRows: OutlookIntakeRow[] = (data ?? []) as OutlookIntakeRow[];
    const projectIds = [
      ...new Set(
        intakeRows
          .map((row) => row.project_id)
          .filter((projectId): projectId is number => Number.isInteger(projectId)),
      ),
    ];
    const projectsById = new Map<number, IntakeProjectRow>();

    if (projectIds.length > 0) {
      const { data: projectRows, error: projectError } = await serviceDb.from("projects")
        .select("id, name, project_number")
        .in("id", projectIds);

      if (projectError) {
        throw new GuardrailError({
          code: "INTERNAL_ERROR",
          where: "outlook-intake#GET",
          message: projectError.message,
        });
      }

      for (const project of (projectRows ?? []) as IntakeProjectRow[]) {
        projectsById.set(project.id, project);
      }
    }

    const documentMetadataIds = [
      ...new Set(
        intakeRows
          .map((row) => row.document_metadata_id)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const documentStatusById = new Map<string, string | null>();

    for (
      let index = 0;
      index < documentMetadataIds.length;
      index += DOCUMENT_STATUS_LOOKUP_BATCH_SIZE
    ) {
      const documentMetadataIdBatch = documentMetadataIds.slice(
        index,
        index + DOCUMENT_STATUS_LOOKUP_BATCH_SIZE,
      );
      const { data: documentRows, error: documentError } = await supabase
        .from("document_metadata")
        .select("id, status")
        .in("id", documentMetadataIdBatch);

      if (documentError) {
        throw new GuardrailError({
          code: "INTERNAL_ERROR",
          where: "outlook-intake#GET",
          message: documentError.message,
        });
      }

      for (const documentRow of documentRows ?? []) {
        documentStatusById.set(documentRow.id, documentRow.status ?? null);
      }
    }

    const rows = intakeRows.map((row) => {
      const project = row.project_id
        ? projectsById.get(row.project_id) ?? null
        : null;

      return {
        id: row.id,
        graphMessageId: row.graph_message_id,
        mailboxUserId: row.mailbox_user_id,
        documentMetadataId: row.document_metadata_id,
        documentStatus: row.document_metadata_id
          ? (documentStatusById.get(row.document_metadata_id) ??
            "missing_metadata")
          : null,
        conversationId: row.conversation_id,
        subject: row.subject,
        body: row.body,
        bodyHtml: row.body_html,
        bodyText: row.body_text,
        fromName: row.from_name,
        fromEmail: row.from_email,
        toList: row.to_list ?? [],
        matchStatus: row.match_status,
        assignmentMethod: row.assignment_method,
        assignmentConfidence: row.assignment_confidence,
        receivedAt: row.received_at,
        hasAttachments: row.has_attachments,
        webLink: row.web_link,
        createdAt: row.created_at,
        tags: normalizeUserTags(row.source_metadata),
        triageAction: row.triage_action,
        triageReason: row.triage_reason,
        triageAt: row.triage_at,
        intakeClassification: normalizeIntakeClassification(row.source_metadata),
        project: project
          ? {
              id: project.id,
              name: project.name,
              projectNumber: project.project_number,
            }
          : null,
        attachments: (row.outlook_email_intake_attachments ?? []).map(
          (attachment) => ({
            id: attachment.id,
            fileName: attachment.file_name,
            fileSize: attachment.file_size,
            contentType: attachment.content_type,
            createdAt: attachment.created_at,
          }),
        ),
      };
    });

    return NextResponse.json(rows);
  },
);

function normalizeIntakeClassification(
  sourceMetadata: Record<string, unknown> | null,
) {
  const raw = sourceMetadata?.intake_classification;
  if (!raw || typeof raw !== "object") return null;

  const classification = raw as Record<string, unknown>;
  return {
    action:
      typeof classification.action === "string" ? classification.action : null,
    category:
      typeof classification.category === "string"
        ? classification.category
        : null,
    confidence:
      typeof classification.confidence === "number"
        ? classification.confidence
        : null,
    reason:
      typeof classification.reason === "string" ? classification.reason : null,
    signals: Array.isArray(classification.signals)
      ? classification.signals.filter(
          (signal): signal is string => typeof signal === "string",
        )
      : [],
  };
}

function normalizeSearchParam(value: string | null): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function parseOptionalProjectId(value: string | null): number | null {
  if (value === null) return null;

  const normalized = value.trim();
  if (!/^[1-9]\d*$/.test(normalized)) {
    throw new GuardrailError({
      code: "VALIDATION_ERROR",
      where: "outlook-intake#GET",
      message: "project_id must be a positive integer.",
      details: { parameter: "project_id" },
    });
  }

  const projectId = Number(normalized);
  if (!Number.isSafeInteger(projectId)) {
    throw new GuardrailError({
      code: "VALIDATION_ERROR",
      where: "outlook-intake#GET",
      message: "project_id must be a positive integer.",
      details: { parameter: "project_id" },
    });
  }

  return projectId;
}

function escapePostgrestLike(value: string): string {
  return value.replace(/[%_]/g, (match) => `\\${match}`);
}

function escapePostgrestArrayValue(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function normalizeUserTags(sourceMetadata: Record<string, unknown> | null) {
  const raw = sourceMetadata?.user_tags;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((tag): tag is string => typeof tag === "string")
    .map((tag) => tag.trim())
    .filter(Boolean);
}
