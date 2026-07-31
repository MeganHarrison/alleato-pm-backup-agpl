import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { sendEmail } from "@/lib/email/send";
import { APP_BASE_URL } from "@/lib/email/client";
import SubcontractorInvoiceInvitation from "@/emails/subcontractor/SubcontractorInvoiceInvitation";
import { logger } from "@/lib/logger";

type Recipient = {
  id: string;
  name: string;
  email: string;
};

const INVITABLE_STATUSES = ["not_invited", "invited", "draft", "revise_and_resubmit"] as const;

function formatDate(value?: string | null): string {
  if (!value) return "Not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not set";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatBillingPeriod(start?: string | null, end?: string | null): string {
  if (!start && !end) return "Not set";
  if (start && end) return `${formatDate(start)} - ${formatDate(end)}`;
  return formatDate(start ?? end);
}

async function getSubcontractorTemplateId(service: ReturnType<typeof createServiceClient>) {
  const { data } = await service
    .from("permission_templates")
    .select("id")
    .eq("name", "Subcontractor")
    .eq("is_system", true)
    .maybeSingle();
  return data?.id ?? null;
}

async function buildInviteUrl(args: {
  service: ReturnType<typeof createServiceClient>;
  recipient: Recipient;
  invoicePath: string;
}) {
  const { service, recipient, invoicePath } = args;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || APP_BASE_URL;

  const [{ data: authLink }, { data: profile }] = await Promise.all([
    service
      .from("users_auth")
      .select("auth_user_id")
      .eq("person_id", recipient.id)
      .maybeSingle(),
    service
      .from("user_profiles")
      .select("id")
      .ilike("email", recipient.email)
      .maybeSingle(),
  ]);

  if (authLink?.auth_user_id || profile?.id) {
    return {
      url: `${appUrl}${invoicePath}`,
      template: "subcontractor-invoice-invitation" as const,
    };
  }

  const passwordSetupUrl = `/auth/update-password?email=${encodeURIComponent(recipient.email)}&next=${encodeURIComponent(invoicePath)}`;
  const confirmBaseUrl = `${appUrl}/auth/confirm`;
  const { data: linkData, error: linkError } = await service.auth.admin.generateLink({
    type: "invite",
    email: recipient.email,
    options: {
      redirectTo: `${appUrl}/auth/callback`,
    },
  });

  if (linkError || !linkData?.properties?.action_link) {
    logger.error({
      msg: `[subcontractor-invoice-invite] Failed to generate invite link for ${recipient.email}`,
      error: linkError instanceof Error ? linkError.message : String(linkError),
    });
    return {
      url: `${appUrl}${invoicePath}`,
      template: "subcontractor-invoice-invitation" as const,
    };
  }

  const actionUrl = new URL(linkData.properties.action_link);
  const token = actionUrl.searchParams.get("token");
  return {
    url: token
      ? `${confirmBaseUrl}?token_hash=${token}&type=invite&next=${encodeURIComponent(passwordSetupUrl)}`
      : linkData.properties.action_link,
    template: "subcontractor-invoice-invite-new-user" as const,
  };
}

export const POST = withApiGuardrails<{ projectId: string; invoiceId: string }>(
  "projects/[projectId]/invoicing/subcontractor/invoices/[invoiceId]/invite#POST",
  async ({ params }) => {
    const supabase = await createClient();
    const service = createServiceClient();
    const projectIdNum = Number.parseInt(params.projectId, 10);
    const invoiceIdNum = Number.parseInt(params.invoiceId, 10);

    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/[projectId]/invoicing/subcontractor/invoices/[invoiceId]/invite#POST",
        message: "Authentication required.",
        status: 401,
      });
    }

    if (!Number.isFinite(projectIdNum) || !Number.isFinite(invoiceIdNum)) {
      return NextResponse.json({ error: "Invalid project or invoice id" }, { status: 400 });
    }

    const { data: invoice, error: invoiceError } = await supabase
      .from("subcontractor_invoices")
      .select(
        `
        id,
        status,
        invoice_number,
        is_retainage_release,
        period_start,
        period_end,
        project_id,
        subcontract_id,
        purchase_order_id,
        subcontracts(contract_number, title, invoice_contact_ids, contract_company_id),
        purchase_orders(contract_number, title, invoice_contact_ids, contract_company_id)
        `,
      )
      .eq("id", invoiceIdNum)
      .eq("project_id", projectIdNum)
      .single();

    if (invoiceError || !invoice) {
      return NextResponse.json(
        {
          error: "Invoice not found",
          details: invoiceError?.message,
        },
        { status: invoiceError?.code === "PGRST116" ? 404 : 500 },
      );
    }

    if (!(INVITABLE_STATUSES as readonly string[]).includes(invoice.status)) {
      return NextResponse.json(
        {
          error: "Invoice cannot be invited",
          message:
            "Only Not Invited, Invited, Draft, or Revise & Resubmit invoices can be sent to the subcontractor.",
        },
        { status: 409 },
      );
    }

    const subcontract = invoice.subcontracts as {
      contract_number: string | null;
      title: string | null;
      invoice_contact_ids: string[] | null;
      contract_company_id: string | null;
    } | null;
    const purchaseOrder = invoice.purchase_orders as {
      contract_number: string | null;
      title: string | null;
      invoice_contact_ids: string[] | null;
      contract_company_id: string | null;
    } | null;
    const commitment = subcontract ?? purchaseOrder;
    const invoiceContactIds = commitment?.invoice_contact_ids ?? [];

    if (invoiceContactIds.length === 0) {
      return NextResponse.json(
        {
          error: "No invoice contacts found",
          message:
            "Add at least one invoice contact to the commitment before inviting the subcontractor to submit an invoice.",
        },
        { status: 400 },
      );
    }

    const [{ data: project }, { data: actorPerson }, { data: people }] =
      await Promise.all([
        supabase
          .from("projects")
          .select("name, project_number")
          .eq("id", projectIdNum)
          .maybeSingle(),
        supabase
          .from("people")
          .select("first_name, last_name")
          .eq("auth_user_id", user.id)
          .maybeSingle(),
        supabase
          .from("people")
          .select("id, first_name, last_name, email")
          .in("id", invoiceContactIds),
      ]);

    const recipients: Recipient[] = (people ?? [])
      .filter((person: { email: string | null }) => Boolean(person.email))
      .map((person: {
        id: string;
        first_name: string | null;
        last_name: string | null;
        email: string | null;
      }) => ({
        id: person.id,
        name:
          `${person.first_name ?? ""} ${person.last_name ?? ""}`.trim() ||
          "Invoice contact",
        email: person.email as string,
      }));

    if (recipients.length === 0) {
      return NextResponse.json(
        {
          error: "Invoice contacts have no email addresses",
          message:
            "Add an email address to at least one invoice contact before sending the invoice invitation.",
        },
        { status: 400 },
      );
    }

    const subcontractorTemplateId = await getSubcontractorTemplateId(service);
    const now = new Date().toISOString();
    const memberships = recipients.map((recipient) => ({
      person_id: recipient.id,
      project_id: projectIdNum,
      user_type: "subcontractor",
      status: "active",
      invite_status: "invited",
      invited_at: now,
      last_invited_at: now,
      updated_at: now,
      ...(subcontractorTemplateId
        ? { permission_template_id: subcontractorTemplateId }
        : {}),
    }));

    const { error: membershipError } = await service
      .from("project_directory_memberships")
      .upsert(memberships, { onConflict: "person_id,project_id" });

    if (membershipError) {
      return NextResponse.json(
        {
          error: "Failed to grant subcontractor access",
          details: membershipError.message,
        },
        { status: 500 },
      );
    }

    const invoicePath = `/${projectIdNum}/invoicing/subcontractor/${invoiceIdNum}`;
    const invoiceNumber = invoice.invoice_number ?? `APP-${invoice.id}`;
    const projectName = project?.name ?? `Project #${projectIdNum}`;
    const pmName =
      `${actorPerson?.first_name ?? ""} ${actorPerson?.last_name ?? ""}`.trim() ||
      user.email?.split("@")[0] ||
      "Your project manager";
    const subject = invoice.is_retainage_release
      ? `Submit retainage release invoice ${invoiceNumber}`
      : `Submit invoice ${invoiceNumber}`;
    const billingPeriod = formatBillingPeriod(invoice.period_start, invoice.period_end);
    const dueDate = formatDate(invoice.period_end);

    const sendResults = await Promise.all(
      recipients.map(async (recipient) => {
        const invite = await buildInviteUrl({ service, recipient, invoicePath });
        return sendEmail({
          template: invite.template,
          to: recipient.email,
          subject,
          react: SubcontractorInvoiceInvitation({
            subcontractorName: recipient.name,
            projectName,
            projectNumber: project?.project_number ?? null,
            commitmentNumber: commitment?.contract_number ?? "-",
            invoiceNumber,
            invoiceType: invoice.is_retainage_release ? "retainage_release" : "progress",
            billingPeriod,
            dueDate,
            invoiceUrl: invite.url,
            pmName,
          }),
          entity: { type: "subcontractor_invoice", id: invoiceIdNum },
          idempotencyKey: `subcontractor-invoice-invite/${invoiceIdNum}/${recipient.email}`,
          metadata: {
            projectId: projectIdNum,
            invoiceId: invoiceIdNum,
            isRetainageRelease: invoice.is_retainage_release,
          },
        });
      }),
    );

    const failed = sendResults.filter((result) => result.error);
    if (failed.length > 0) {
      const message = failed
        .map((result) => result.error?.message)
        .filter(Boolean)
        .join("; ");
      return NextResponse.json(
        {
          error: "Subcontractor invoice invitation failed to send",
          details: message,
        },
        { status: 502 },
      );
    }

    const { data: updated, error: updateError } = await supabase
      .from("subcontractor_invoices")
      .update({ status: "invited", updated_at: now })
      .eq("id", invoiceIdNum)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json(
        {
          error: "Invitation sent but invoice status could not be updated",
          details: updateError.message,
        },
        { status: 500 },
      );
    }

    await supabase.from("subcontractor_invoice_audit_log").insert({
      invoice_id: invoiceIdNum,
      actor_user_id: user.id,
      actor_email: user.email ?? null,
      event_type: "invoice.invited",
      new_value: {
        recipients: recipients.map((recipient) => recipient.email),
        status: "invited",
      },
      notes: `Invited ${recipients.length} invoice contact${recipients.length === 1 ? "" : "s"} to submit the invoice.`,
    });

    return NextResponse.json({
      data: updated,
      message: `Invoice invitation sent to ${recipients.length} contact${recipients.length === 1 ? "" : "s"}.`,
    });
  },
);
