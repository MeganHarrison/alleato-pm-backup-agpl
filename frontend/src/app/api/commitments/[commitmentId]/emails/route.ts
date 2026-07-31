import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";

import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { serviceDb } from "@/lib/supabase/service-db";

export const GET = withApiGuardrails<{ commitmentId: string }>(
  "commitments/[commitmentId]/emails#GET",
  async ({ request, params }) => {
  const supabase = await createClient();
  const { commitmentId } = await params;

  const user = await getApiRouteUser();

  if (!user) {
    throw new GuardrailError({ code: "AUTH_EXPIRED", where: "commitments/[commitmentId]/emails#GET", message: "Authentication required." });
  }

  const { data: emails, error } = await supabase
    .from("project_emails")
    .select(
      "id, subject, from_email, from_name, body, status, sent_at, received_at, has_attachments, to_list, created_at",
    )
    .eq("related_tool", "commitment")
    .eq("related_id", commitmentId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

    const { data: ssovSubmissions, error: ssovSubmissionsError } =
    await serviceDb.from("subcontractor_sov_submissions")
      .select("id")
      .eq("commitment_id", commitmentId);

  if (ssovSubmissionsError) {
    return NextResponse.json(
      { error: ssovSubmissionsError.message },
      { status: 500 },
    );
  }

  const ssovSubmissionIds = (ssovSubmissions ?? []).map((row) => row.id);
  const { data: emailEvents, error: emailEventsError } = await serviceDb.from("email_events")
    .select(
      "id, subject, from_email, status, sent_at, created_at, to_email, template, error, metadata",
    )
    .eq("entity_type", "sov_submission")
    .in("entity_id", ssovSubmissionIds.length > 0 ? ssovSubmissionIds : ["__none__"]);

  if (emailEventsError) {
    return NextResponse.json(
      { error: emailEventsError.message },
      { status: 500 },
    );
  }

  const eventRows = (emailEvents ?? []).map((event) => ({
    id: event.id,
    subject: event.subject ?? event.template,
    from_email: event.from_email,
    from_name: null,
    body:
      event.error && typeof event.error === "object" && "message" in event.error
        ? `Email send failed: ${String(event.error.message)}`
        : null,
    status: event.status,
    sent_at: event.sent_at,
    received_at: null,
    has_attachments: false,
    to_list: [event.to_email],
    created_at: event.created_at,
  }));

  return NextResponse.json({
    data: [...(emails ?? []), ...eventRows],
    meta: { total_count: (emails?.length ?? 0) + eventRows.length },
  });
  },
);
