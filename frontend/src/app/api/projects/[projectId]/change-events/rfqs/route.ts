import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { z } from "zod";

import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { serviceDb } from "@/lib/supabase/service-db";
import { apiErrorResponse } from "@/lib/api-error";
import { requirePermission } from "@/lib/permissions-guard";
import { EMAIL_FROM } from "@/lib/email/client";

interface RouteParams {
  params: Promise<{ projectId: string }>;
}

const createRfqSchema = z.object({
  changeEventId: z.string().min(1, "Change event is required"),
  title: z.string().min(3, "Title must be at least 3 characters").max(255).optional(),
  dueDate: z.string().optional(),
  includeAttachments: z.boolean().optional(),
  notes: z.string().max(2000).optional(),
  assignedCompanyId: z.string().uuid().optional(),
  assignedContactId: z.string().uuid().optional(),
});

const DATE_FORMAT_LENGTH = 10;

async function buildRfqPayload(projectId: number, changeEventId?: string) {
  const supabase = await createClient();
  let query = supabase
    .from("change_event_rfqs")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  if (changeEventId) {
    query = query.eq("change_event_id", changeEventId);
  }

  const { data: rfqs, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  if (!rfqs?.length) {
    return [];
  }

  const changeEventIds = Array.from(new Set(rfqs.map((rfq) => rfq.change_event_id)));
  const rfqIds = rfqs.map((rfq) => rfq.id);

  const [{ data: changeEvents }, { data: responses }] = await Promise.all([
    supabase
      .from("change_events")
      .select("id, number, title")
      .in("id", changeEventIds),
    supabase
      .from("change_event_rfq_responses")
      .select("id, rfq_id")
      .in("rfq_id", rfqIds),
  ]);

  const changeEventMap = new Map(
    (changeEvents ?? []).map((event) => [event.id, event]),
  );

  const responseCountMap = (responses ?? []).reduce<Record<string, number>>(
    (acc, item) => {
      if (!item.rfq_id) return acc;
      acc[item.rfq_id] = (acc[item.rfq_id] ?? 0) + 1;
      return acc;
    },
    {},
  );

  return rfqs.map((rfq) => ({
    ...rfq,
    change_event_number: changeEventMap.get(rfq.change_event_id)?.number ?? null,
    change_event_title: changeEventMap.get(rfq.change_event_id)?.title ?? null,
    response_count: responseCountMap[rfq.id] ?? 0,
  }));
}

async function generateNextRfqNumber(
  projectId: number,
  changeEventId: string,
  changeEventNumber?: string | null,
) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("change_event_rfqs")
    .select("rfq_number")
    .eq("project_id", projectId)
    .eq("change_event_id", changeEventId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let nextSequence = 1;
  if (data?.rfq_number) {
    const match = data.rfq_number.match(/-(\d+)$/);
    if (match) {
      nextSequence = parseInt(match[1], 10) + 1;
    }
  }

  const numericBase = changeEventNumber?.replace(/\D/g, "") || "";
  const paddedBase = (numericBase || String(projectId)).slice(-3).padStart(3, "0");
  const paddedSequence = String(nextSequence).padStart(3, "0");
  return `RFQ-${paddedBase}-${paddedSequence}`;
}

export const GET = withApiGuardrails(
  "projects/[projectId]/change-events/rfqs#GET",
  async ({ request, params }) => {

    const { projectId } = await params;
    const numericProjectId = parseInt(projectId, 10);
    if (!Number.isFinite(numericProjectId)) {
      return NextResponse.json(
        { error: "Invalid project id" },
        { status: 400 },
      );
    }

    const { searchParams } = new URL(request.url);
    const changeEventId = searchParams.get("changeEventId") ?? undefined;

    const payload = await buildRfqPayload(numericProjectId, changeEventId);
    return NextResponse.json({ data: payload });
    },
);

export const POST = withApiGuardrails(
  "projects/[projectId]/change-events/rfqs#POST",
  async ({ request, params }) => {

    const { projectId } = await params;
    const numericProjectId = parseInt(projectId, 10);
    if (!Number.isFinite(numericProjectId)) {
      return NextResponse.json(
        { error: "Invalid project id" },
        { status: 400 },
      );
    }

    const guard = await requirePermission(numericProjectId, "change_orders", "write");
    if (guard.denied) return guard.response;

    const body = await request.json();
    const parsed = createRfqSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 422 },
      );
    }

    const supabase = await createClient();
        const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/change-events/rfqs#POST", message: "Authentication required." });
    }

    const { data: changeEvent, error: changeEventError } = await supabase
      .from("change_events")
      .select("id, project_id, number, title")
      .eq("project_id", numericProjectId)
      .eq("id", parsed.data.changeEventId)
      .single();

    if (changeEventError || !changeEvent) {
      return NextResponse.json(
        { error: "Change event not found" },
        { status: 404 },
      );
    }

    if (!parsed.data.assignedContactId) {
      return NextResponse.json(
        { error: "A distribution contact is required to send an RFQ." },
        { status: 422 },
      );
    }

    const { data: contact, error: contactError } = await supabase
      .from("people")
      .select("id, first_name, last_name, email, company_id")
      .eq("id", parsed.data.assignedContactId)
      .single();

    if (contactError || !contact) {
      return NextResponse.json(
        { error: "Distribution contact not found." },
        { status: 404 },
      );
    }

    const recipientEmail = contact.email?.trim();
    if (!recipientEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) {
      return NextResponse.json(
        { error: "The selected distribution contact does not have a valid email address." },
        { status: 422 },
      );
    }

    const rfqNumber = await generateNextRfqNumber(
      numericProjectId,
      parsed.data.changeEventId,
      changeEvent.number,
    );

    const dueDate = parsed.data.dueDate
      ? parsed.data.dueDate.slice(0, DATE_FORMAT_LENGTH)
      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
          .toISOString()
          .slice(0, DATE_FORMAT_LENGTH);

    const { data: inserted, error: insertError } = await supabase
      .from("change_event_rfqs")
      .insert({
        project_id: numericProjectId,
        change_event_id: changeEvent.id,
        rfq_number: rfqNumber,
        title: parsed.data.title?.trim() || `RFQ for ${changeEvent.title}`,
        include_attachments: parsed.data.includeAttachments ?? true,
        assigned_company_id: parsed.data.assignedCompanyId ?? null,
        assigned_contact_id: parsed.data.assignedContactId ?? null,
        due_date: dueDate,
        notes: parsed.data.notes ?? null,
        status: "Draft",
        created_by: user.id,
        updated_by: user.id,
      })
      .select("*")
      .single();

    if (insertError || !inserted) {
      return NextResponse.json(
        { error: "Failed to create RFQ", details: insertError?.message },
        { status: 400 },
      );
    }

    const subject = `${inserted.rfq_number} - ${inserted.title}`;
    const contactName =
      [contact.first_name, contact.last_name].filter(Boolean).join(" ") ||
      recipientEmail;
    const message = [
      `Hi ${contactName},`,
      "",
      `Please review and respond to ${inserted.rfq_number} for change event ${changeEvent.number ?? changeEvent.id}: ${changeEvent.title ?? "Untitled"}.`,
      "",
      parsed.data.notes?.trim() || "Please provide pricing and any schedule impact for the requested scope.",
      "",
      `Due date: ${dueDate}`,
    ].join("\n");
    const safeMessage = message
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\n/g, "<br/>");
    const emailHtml = `
      <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;color:#111827;">
        <h2 style="margin:0 0 8px 0;">${inserted.rfq_number}</h2>
        <p style="margin:0 0 16px 0;color:#4b5563;">${inserted.title}</p>
        <p style="line-height:1.5;">${safeMessage}</p>
      </div>
    `;

    const { data: emailEvent, error: emailEventError } = await serviceDb.from("email_events")
      .insert({
        template: "rfq-invitation",
        to_email: recipientEmail,
        from_email: EMAIL_FROM,
        subject,
        status: "queued",
        entity_type: "change_event_rfq",
        entity_id: inserted.id,
        user_id: user.id,
        metadata: {
          project_id: numericProjectId,
          change_event_id: changeEvent.id,
          change_event_number: changeEvent.number,
          rfq_id: inserted.id,
          rfq_number: inserted.rfq_number,
          assigned_company_id: parsed.data.assignedCompanyId ?? null,
          assigned_contact_id: parsed.data.assignedContactId,
        },
      })
      .select("id")
      .single();

    if (emailEventError || !emailEvent?.id) {
      await serviceDb.from("change_event_rfqs").delete().eq("id", inserted.id);
      return NextResponse.json(
        {
          error: "RFQ email audit log could not be created.",
          details:
            emailEventError?.message ??
            "The RFQ was not sent because an audit trail could not be created.",
        },
        { status: 500 },
      );
    }

    const { data: emailHistory, error: emailHistoryError } = await serviceDb.from("project_emails")
      .insert({
        project_id: numericProjectId,
        subject,
        body: message,
        body_html: emailHtml,
        from_name: "Alleato",
        from_email: EMAIL_FROM,
        to_list: [recipientEmail],
        status: "Draft",
        sent_at: null,
        has_attachments: false,
        related_tool: "change-event-rfq",
        related_id: inserted.id,
        created_by: user.id,
      })
      .select("id")
      .single();

    if (emailHistoryError || !emailHistory?.id) {
      await Promise.all([
        serviceDb.from("email_events")
          .update({
            status: "failed",
            error: {
              message:
                emailHistoryError?.message ??
                "Project email history row could not be created.",
            },
          })
          .eq("id", emailEvent.id),
        serviceDb.from("change_event_rfqs").delete().eq("id", inserted.id),
      ]);

      return NextResponse.json(
        {
          error: "RFQ email history could not be created.",
          details:
            emailHistoryError?.message ??
            "The RFQ was not sent because visible email history could not be created.",
        },
        { status: 500 },
      );
    }

    if (!process.env.RESEND_API_KEY) {
      const error = { message: "Missing RESEND_API_KEY" };
      await Promise.all([
        serviceDb.from("email_events")
          .update({ status: "failed", error })
          .eq("id", emailEvent.id),
        serviceDb.from("project_emails")
          .update({ status: "Failed" })
          .eq("id", emailHistory.id),
      ]);

      return NextResponse.json(
        { error: "Email service not configured.", details: error.message },
        { status: 500 },
      );
    }

    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { data: sendResult, error: sendError } = await resend.emails.send({
      from: EMAIL_FROM,
      to: [recipientEmail],
      subject,
      html: emailHtml,
    });

    if (sendError) {
      await Promise.all([
        serviceDb.from("email_events")
          .update({
            status: "failed",
            error: { message: sendError.message || "Failed to send RFQ email" },
          })
          .eq("id", emailEvent.id),
        serviceDb.from("project_emails")
          .update({ status: "Failed" })
          .eq("id", emailHistory.id),
      ]);

      return NextResponse.json(
        { error: sendError.message || "Failed to send RFQ email" },
        { status: 500 },
      );
    }

    const sentAt = new Date().toISOString();
    const { data: sentRfq, error: sentRfqError } = await serviceDb.from("change_event_rfqs")
      .update({
        status: "Sent",
        sent_at: sentAt,
        updated_by: user.id,
      })
      .eq("id", inserted.id)
      .select("*")
      .single();

    await Promise.all([
      serviceDb.from("email_events")
        .update({
          status: "sent",
          resend_id: sendResult?.id ?? null,
          sent_at: sentAt,
        })
        .eq("id", emailEvent.id),
      serviceDb.from("project_emails")
        .update({ status: "Sent", sent_at: sentAt })
        .eq("id", emailHistory.id),
    ]);

    if (sentRfqError || !sentRfq) {
      return NextResponse.json(
        { error: "RFQ email sent but RFQ status could not be updated.", details: sentRfqError?.message },
        { status: 500 },
      );
    }

    return NextResponse.json({
      data: {
        ...sentRfq,
        change_event_number: changeEvent.number,
        change_event_title: changeEvent.title,
        response_count: 0,
        email_event_id: emailEvent.id,
        project_email_id: emailHistory.id,
      },
    });
    },
);
