import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { apiErrorResponse } from "@/lib/api-error";
import { buildOwnEmailsFilter } from "@/lib/emails/access";
import { dedupeOutlookIntakeByMessageId } from "@/lib/emails/dedupe-outlook-intake";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { createOutlookIntakeServiceClient } from "@/lib/supabase/service";
import { logger } from "@/lib/logger";

interface RouteParams {
  params: Promise<{ projectId: string }>;
}

const EMAIL_SELECT = `
  *,
  projects!project_emails_project_id_fkey (
    id,
    name,
    project_number
  )
`;

type EmailProjectRow = {
  id: number;
  name: string | null;
  project_number: string | null;
};

type EmailRow = {
  id: number;
  project_id: number;
  projects: EmailProjectRow | null;
  [key: string]: unknown;
};

type OutlookIntakeRow = {
  id: number;
  project_id: number | null;
  subject: string | null;
  body: string | null;
  body_html: string | null;
  body_text: string | null;
  from_name: string | null;
  from_email: string | null;
  to_list: string[] | null;
  cc_list: string[] | null;
  received_at: string | null;
  has_attachments: boolean | null;
  graph_message_id: string | null;
  internet_message_id: string | null;
  mailbox_user_id: string | null;
  conversation_id: string | null;
  project_email_id: number | null;
  created_at: string | null;
};

function mapEmailProject<T extends EmailRow>(email: T) {
  const { projects, ...rest } = email;
  return {
    ...rest,
    project: projects
      ? {
          id: projects.id,
          name: projects.name,
          project_number: projects.project_number,
        }
      : null,
  };
}

function mapOutlookIntakeEmail(
  row: OutlookIntakeRow,
  project: EmailProjectRow | null,
  hasAttachments: boolean,
) {
  return {
    id: row.id,
    project_id: row.project_id,
    subject: row.subject || "(no subject)",
    body: row.body_text || row.body,
    body_html: row.body_html,
    body_text: row.body_text,
    from_name: row.from_name,
    from_email: row.from_email,
    to_list: row.to_list,
    cc_list: row.cc_list,
    bcc_list: null,
    status: "Received" as const,
    sent_at: null,
    received_at: row.received_at,
    is_private: null,
    is_starred: null,
    has_attachments: hasAttachments,
    related_tool: null,
    related_id: null,
    distribution_group: null,
    thread_id: row.conversation_id,
    graph_message_id: row.graph_message_id,
    mailbox_user_id: row.mailbox_user_id,
    conversation_id: row.conversation_id,
    created_by: null,
    created_at: row.created_at ?? row.received_at,
    updated_at: row.created_at ?? row.received_at,
    deleted_at: null,
    project,
  };
}

function emailSortDate(email: unknown) {
  if (!email || typeof email !== "object") return 0;
  const record = email as {
    sent_at?: unknown;
    received_at?: unknown;
    created_at?: unknown;
  };
  const raw = record.sent_at ?? record.received_at ?? record.created_at;
  if (typeof raw !== "string") return 0;
  const time = new Date(raw).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function buildOwnOutlookIntakeFilter(email: string | null | undefined): string | null {
  const normalized = email?.trim().toLowerCase();
  if (!normalized || !/^[^\s,"\\(){}]+@[^\s,"\\(){}]+$/.test(normalized)) {
    return null;
  }

  return [
    `from_email.ilike.${normalized}`,
    `mailbox_user_id.ilike.${normalized}`,
    `to_list.cs.{${normalized}}`,
    `cc_list.cs.{${normalized}}`,
  ].join(",");
}

const createEmailSchema = z.object({
  subject: z.string().min(1, "Subject is required").max(500),
  body: z.string().optional().nullable(),
  body_html: z.string().optional().nullable(),
  from_name: z.string().optional().nullable(),
  from_email: z.string().email("Invalid email address").optional().nullable(),
  to_list: z.array(z.string()).optional().nullable(),
  cc_list: z.array(z.string()).optional().nullable(),
  bcc_list: z.array(z.string()).optional().nullable(),
  status: z.enum(["Draft", "Sent", "Received", "Failed"]).default("Draft"),
  is_private: z.boolean().optional().default(false),
  is_starred: z.boolean().optional().default(false),
  has_attachments: z.boolean().optional().default(false),
  related_tool: z.string().optional().nullable(),
  related_id: z.string().optional().nullable(),
  distribution_group: z.string().optional().nullable(),
  thread_id: z.string().optional().nullable(),
});

/**
 * GET /api/projects/[projectId]/emails
 * Fetch all emails for a project with optional filters
 */
export const GET = withApiGuardrails(
  "projects/[projectId]/emails#GET",
  async ({ request, params }) => {
  
    const { projectId } = await params;
    const supabase = await createClient();

    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/emails#GET", message: "Authentication required." });
    }

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("is_admin")
      .eq("id", user.id)
      .maybeSingle();

    const isAdmin = profile?.is_admin === true;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const search = searchParams.get("search");
    const starred = searchParams.get("starred");
    const relatedTool = searchParams.get("related_tool");
    const relatedId = searchParams.get("related_id");
    // No source param => return all sources (app-composed + Outlook-synced).
    // Callers pass an explicit "app" or "outlook" to narrow.
    const source = searchParams.get("source") ?? "all";

    const numericProjectId = parseInt(projectId, 10);
    const includeAppEmails = source !== "outlook";
    const includeOutlookEmails = source !== "app";

    let appRows: EmailRow[] = [];
    if (includeAppEmails) {
      let query = supabase
        .from("project_emails")
        .select(EMAIL_SELECT)
        .eq("project_id", numericProjectId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      if (status) {
        query = query.eq("status", status);
      }

      query = query
        .is("graph_message_id", null)
        .is("mailbox_user_id", null)
        .is("conversation_id", null);

      if (starred === "true") {
        query = query.eq("is_starred", true);
      }

      if (relatedTool) {
        query = query.eq("related_tool", relatedTool);
      }

      if (relatedId) {
        query = query.eq("related_id", relatedId);
      }

      if (search) {
        query = query.or(
          `subject.ilike.%${search}%,from_name.ilike.%${search}%,from_email.ilike.%${search}%,body.ilike.%${search}%`,
        );
      }

      // Non-admins see only emails they are a party to.
      if (!isAdmin) {
        const filter = buildOwnEmailsFilter({ authUserId: user.id, email: user.email });
        if (!filter) {
          return NextResponse.json([]);
        }
        query = query.or(filter);
      }

      const { data, error } = await query;

      if (error) {
        logger.error({ msg: "Error fetching app emails:", error: error instanceof Error ? error.message : String(error) });
        throw new GuardrailError({
          code: "INTERNAL_ERROR",
          where: "projects/[projectId]/emails#GET",
          message: "Failed to fetch app emails.",
        });
      }

      appRows = (data ?? []) as EmailRow[];
    }

    let outlookRows: ReturnType<typeof mapOutlookIntakeEmail>[] = [];
    if (includeOutlookEmails) {
      if (status && status !== "Received") {
        outlookRows = [];
      } else if (starred === "true" || relatedTool || relatedId) {
        outlookRows = [];
      } else {
        const intake = createOutlookIntakeServiceClient();
        let outlookQuery = intake
          .from("outlook_email_intake")
          .select(
            "id,project_id,subject,body,body_html,body_text,from_name,from_email,to_list,cc_list,received_at,has_attachments,graph_message_id,internet_message_id,mailbox_user_id,conversation_id,project_email_id,created_at",
          )
          .eq("project_id", numericProjectId)
          .order("received_at", { ascending: false, nullsFirst: false });

        if (search) {
          outlookQuery = outlookQuery.or(
            `subject.ilike.%${search}%,from_name.ilike.%${search}%,from_email.ilike.%${search}%,body.ilike.%${search}%,body_text.ilike.%${search}%`,
          );
        }

        if (!isAdmin) {
          const filter = buildOwnOutlookIntakeFilter(user.email);
          if (!filter) {
            return NextResponse.json([]);
          }
          outlookQuery = outlookQuery.or(filter);
        }

        const { data: intakeData, error: intakeError } = await outlookQuery;
        if (intakeError) {
          logger.error({ msg: "Error fetching Outlook intake emails:", error: intakeError instanceof Error ? intakeError.message : String(intakeError) });
          throw new GuardrailError({
            code: "INTERNAL_ERROR",
            where: "projects/[projectId]/emails#GET",
            message: "Failed to fetch Outlook intake emails.",
          });
        }

        const rows = (intakeData ?? []) as OutlookIntakeRow[];
        const emailsWithRealAttachments = new Set<number>();
        const emailIds = rows.map((r) => r.id);
        if (emailIds.length > 0) {
          const { data: attachmentRows, error: attachmentError } = await intake
            .from("outlook_email_intake_attachments")
            .select("intake_email_id")
            .in("intake_email_id", emailIds)
            .or("is_inline.is.null,is_inline.eq.false");

          if (attachmentError) {
            logger.error({ msg: "Error fetching Outlook intake attachment state:", error: attachmentError instanceof Error ? attachmentError.message : String(attachmentError) });
            throw new GuardrailError({
              code: "INTERNAL_ERROR",
              where: "projects/[projectId]/emails#GET",
              message: "Failed to fetch Outlook intake attachment state.",
            });
          }

          for (const attachment of attachmentRows ?? []) {
            if (typeof attachment.intake_email_id === "number") {
              emailsWithRealAttachments.add(attachment.intake_email_id);
            }
          }
        }

        const { data: projectRow, error: projectError } = await supabase
          .from("projects")
          .select("id,name,project_number")
          .eq("id", numericProjectId)
          .maybeSingle();

        if (projectError) {
          logger.error({ msg: "Error fetching Outlook email project:", error: projectError instanceof Error ? projectError.message : String(projectError) });
          throw new GuardrailError({
            code: "INTERNAL_ERROR",
            where: "projects/[projectId]/emails#GET",
            message: "Failed to fetch Outlook email project.",
          });
        }

        const project =
          projectRow && typeof projectRow.id === "number"
            ? {
                id: projectRow.id,
                name: (projectRow.name as string | null) ?? null,
                project_number: (projectRow.project_number as string | null) ?? null,
              }
            : null;

        // The Graph sync stores one row per mailbox that received a message, so
        // an email sent to multiple Alleato people fans out into 2–3 identical
        // intake rows (each with its own graph_message_id). Collapse those to a
        // single representative by internet_message_id so the project inbox
        // doesn't show every message twice. Attachment state is unioned across
        // the collapsed copies so a paperclip never disappears with a dropped row.
        const { representatives, memberIdsByRepresentativeId } =
          dedupeOutlookIntakeByMessageId(rows);
        outlookRows = representatives.map((row) => {
          const memberIds = memberIdsByRepresentativeId.get(row.id) ?? [row.id];
          const hasAttachments = memberIds.some((id) =>
            emailsWithRealAttachments.has(id),
          );
          return mapOutlookIntakeEmail(row, project, hasAttachments);
        });
      }
    }

    const emails = [
      ...appRows.map(mapEmailProject),
      ...outlookRows,
    ].sort((a, b) => emailSortDate(b) - emailSortDate(a));

    return NextResponse.json(emails);
    },
);

/**
 * POST /api/projects/[projectId]/emails
 * Create a new email
 */
export const POST = withApiGuardrails(
  "projects/[projectId]/emails#POST",
  async ({ request, params }) => {
  
    const { projectId } = await params;
    const supabase = await createClient();

    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/emails#POST", message: "Authentication required." });
    }

    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single();

    if (profileError) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where: "projects/[projectId]/emails#POST",
        message: profileError.message,
      });
    }

    if (!profile?.is_admin) {
      throw new GuardrailError({
        code: "FORBIDDEN",
        where: "projects/[projectId]/emails#POST",
        message: "Admin access required.",
        status: 403,
      });
    }

    const body = await request.json();
    const validated = createEmailSchema.parse(body);

    const { data, error } = await supabase
      .from("project_emails")
      .insert({
        ...validated,
        project_id: parseInt(projectId, 10),
        created_by: user.id,
        sent_at: validated.status === "Sent" ? new Date().toISOString() : null,
      })
      .select(EMAIL_SELECT)
      .single();

    if (error) {
      logger.error({ msg: "Error creating email:", error: error instanceof Error ? error.message : String(error) });
      return apiErrorResponse(error);
    }

    return NextResponse.json(mapEmailProject(data as EmailRow), { status: 201 });
    },
);
