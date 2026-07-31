import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { createOutlookMailDraft } from "@/lib/microsoft-graph/mail";

const WHERE = "projects/[projectId]/estimates/[estimateId]/sublist/[subId]/bid-invitation#POST";

/**
 * POST /api/projects/[projectId]/estimates/[estimateId]/sublist/[subId]/bid-invitation
 *
 * Creates an Outlook draft bid invitation email for a subcontractor.
 * Marks email_sent = "Yes" on the sub after successful draft creation.
 *
 * Body: { bid_due_date?: string, custom_message?: string, scope_items?: string[] }
 */
export const POST = withApiGuardrails<{
  projectId: string;
  estimateId: string;
  subId: string;
}>(WHERE, async ({ request, params }) => {
  const { projectId, estimateId, subId } = await params;
  const supabase = await createClient();

  const user = await getApiRouteUser();
  if (!user) {
    throw new GuardrailError({ code: "AUTH_EXPIRED", where: WHERE, message: "Authentication required." });
  }

  const projectIdNum = parseInt(projectId, 10);
  const estimateIdNum = parseInt(estimateId, 10);
  const subIdNum = parseInt(subId, 10);
  if (isNaN(projectIdNum) || isNaN(estimateIdNum) || isNaN(subIdNum)) {
    throw new GuardrailError({ code: "INVALID_PAYLOAD", where: WHERE, message: "Invalid IDs." });
  }

  // Load sub details
  const { data: sub, error: subError } = await supabase
    .from("estimate_sublist_subs")
    .select("*, estimates!inner(estimate_id, project_id, is_deleted)")
    .eq("id", subIdNum)
    .eq("estimate_id", estimateIdNum)
    .eq("estimates.project_id", projectIdNum)
    .eq("estimates.is_deleted", false)
    .maybeSingle();

  if (subError || !sub) {
    throw new GuardrailError({ code: "NOT_FOUND", where: WHERE, message: "Sub not found." });
  }

  if (!sub.email) {
    throw new GuardrailError({
      code: "INVALID_PAYLOAD",
      where: WHERE,
      message: "Sub has no email address. Add an email before sending a bid invitation.",
    });
  }

  // Load project info
  const { data: project } = await supabase
    .from("projects")
    .select("name, address, id")
    .eq("id", projectIdNum)
    .single();

  // Load scope items for this division (if any)
  const { data: scopeItems } = await supabase
    .from("estimate_sublist_scope_items")
    .select("description, is_checked")
    .eq("estimate_id", estimateIdNum)
    .eq("division_code", sub.division_code)
    .eq("is_checked", true)
    .order("sort_order", { ascending: true });

  const body = await request.json().catch(() => ({})) as {
    bid_due_date?: string;
    custom_message?: string;
  };

  const projectName = project?.name ?? "Our Project";
  const projectAddress = project?.address ?? "";
  const bidDueDate = body.bid_due_date
    ? new Date(body.bid_due_date).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })
    : null;
  const divisionName = sub.division_code
    ? `Division ${sub.division_code}`
    : "specified division";

  const scopeSection = scopeItems && scopeItems.length > 0
    ? `
<p><strong>Scope of Work includes:</strong></p>
<ul>
${scopeItems.map((item) => `  <li>${item.description}</li>`).join("\n")}
</ul>`
    : "";

  const customSection = body.custom_message
    ? `<p>${body.custom_message}</p>`
    : "";

  const emailBody = `
<p>Dear ${sub.contact_name ?? sub.company ?? "Team"},</p>

<p>We are pleased to invite <strong>${sub.company ?? "your company"}</strong> to submit a bid for the following project:</p>

<table style="border-collapse:collapse; margin-bottom:12px;">
  <tr><td style="padding:4px 12px 4px 0; font-weight:600;">Project:</td><td>${projectName}</td></tr>
  ${projectAddress ? `<tr><td style="padding:4px 12px 4px 0; font-weight:600;">Location:</td><td>${projectAddress}</td></tr>` : ""}
  <tr><td style="padding:4px 12px 4px 0; font-weight:600;">Division:</td><td>${divisionName}</td></tr>
  ${bidDueDate ? `<tr><td style="padding:4px 12px 4px 0; font-weight:600;">Bid Due Date:</td><td><strong>${bidDueDate}</strong></td></tr>` : ""}
</table>

${scopeSection}

${customSection}

<p>Please review the scope carefully and submit your bid to this email address. If you have any questions or need clarification, do not hesitate to reach out.</p>

<p>We look forward to receiving your proposal.</p>

<p>Best regards,<br />
Alleato Group</p>
`.trim();

  // Create Outlook draft
  let draft;
  try {
    draft = await createOutlookMailDraft({
      subject: `Bid Invitation — ${projectName} — ${divisionName}`,
      body: emailBody,
      toRecipients: [{ email: sub.email, name: sub.contact_name ?? sub.company ?? undefined }],
      importance: "normal",
    });
  } catch (err) {
    throw new GuardrailError({
      code: "UPSTREAM_FAILURE",
      where: WHERE,
      message: err instanceof Error ? err.message : "Failed to create Outlook draft.",
      details: err,
    });
  }

  // Mark email_sent = "Yes" on the sub
  await supabase
    .from("estimate_sublist_subs")
    .update({ email_sent: "Yes" })
    .eq("id", subIdNum);

  return NextResponse.json({
    success: true,
    draft: {
      id: draft.id,
      subject: draft.subject,
      webLink: draft.webLink,
      mailboxUserId: draft.mailboxUserId,
      mode: draft.mode,
    },
    sub_id: subIdNum,
    recipient: sub.email,
  });
});
