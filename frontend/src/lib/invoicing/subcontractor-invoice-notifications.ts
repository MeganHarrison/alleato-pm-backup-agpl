/**
 * Subcontractor invoice decision notifications.
 *
 * Closes the previously-silent ball-in-court hand-offs: when a PM approves,
 * approves-as-noted, or returns an invoice for revision, the subcontractor is
 * notified by email + a best-effort in-app/Teams notification. Before this,
 * the subcontractor only learned the outcome by logging back in.
 *
 * Designed to be called fire-and-forget from the workflow API routes — it
 * creates its own service client and never throws into the caller.
 */
import { createServiceClient } from "@/lib/supabase/service";
import { sendEmail } from "@/lib/email/send";
import { APP_BASE_URL } from "@/lib/email/client";
import { logger } from "@/lib/logger";
import { notifyStatusChange } from "@/services/notificationService";

type InvoiceDecision = "approved" | "approved_as_noted" | "revise";

interface ContactRecipient {
  id: string;
  name: string;
  email: string;
}

async function loadInvoiceContacts(
  supabase: ReturnType<typeof createServiceClient>,
  invoice: { subcontract_id: string | null; purchase_order_id: string | null },
): Promise<ContactRecipient[]> {
  let contactIds: string[] = [];

  if (invoice.subcontract_id) {
    const { data } = await supabase
      .from("subcontracts")
      .select("invoice_contact_ids")
      .eq("id", invoice.subcontract_id)
      .maybeSingle();
    contactIds = data?.invoice_contact_ids || [];
  } else if (invoice.purchase_order_id) {
    const { data } = await supabase
      .from("purchase_orders")
      .select("invoice_contact_ids")
      .eq("id", invoice.purchase_order_id)
      .maybeSingle();
    contactIds = data?.invoice_contact_ids || [];
  }

  if (contactIds.length === 0) return [];

  const { data: people } = await supabase
    .from("people")
    .select("id, first_name, last_name, email")
    .in("id", contactIds);

  return ((people || []) as Array<{
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
  }>)
    .filter((person): person is typeof person & { email: string } => !!person.email)
    .map((person) => ({
      id: person.id,
      name: `${person.first_name || ""} ${person.last_name || ""}`.trim() || "Invoice Contact",
      email: person.email,
    }));
}

export async function notifySubcontractorOfInvoiceDecision(args: {
  projectId: number;
  invoiceId: number;
  decision: InvoiceDecision;
  notes?: string | null;
}): Promise<void> {
  const { projectId, invoiceId, decision, notes } = args;
  const supabase = createServiceClient();

  try {
    const { data: invoice } = await supabase
      .from("subcontractor_invoices")
      .select("id, invoice_number, subcontract_id, purchase_order_id")
      .eq("id", invoiceId)
      .maybeSingle();
    if (!invoice) return;

    const contacts = await loadInvoiceContacts(supabase, invoice);
    if (contacts.length === 0) return;

    const { data: project } = await supabase
      .from("projects")
      .select("name")
      .eq("id", projectId)
      .maybeSingle();
    const projectName = project?.name || `Project #${projectId}`;
    const invoiceNumber = invoice.invoice_number || `#${invoice.id}`;
    const invoiceUrl = `${APP_BASE_URL}/${projectId}/invoicing/subcontractor/${invoiceId}`;

    if (decision === "revise") {
      const { default: InvoiceRejectedToSub } = await import(
        "@/emails/subcontractor/InvoiceRejectedToSub"
      );
      await Promise.all(
        contacts.map((contact) =>
          sendEmail({
            template: "invoice-rejected",
            to: contact.email,
            subject: `Invoice ${invoiceNumber} needs revisions`,
            react: InvoiceRejectedToSub({
              subcontractorName: contact.name,
              projectName,
              invoiceNumber,
              reviewNotes: notes ?? null,
              resubmitUrl: invoiceUrl,
            }),
            entity: { type: "subcontractor_invoice", id: invoiceId },
            idempotencyKey: `invoice-rejected/${invoiceId}/${contact.email}`,
          }),
        ),
      );
    } else {
      const approvedAmount = await computeApprovedAmount(supabase, invoiceId);
      const { default: InvoiceApprovedToSub } = await import(
        "@/emails/subcontractor/InvoiceApprovedToSub"
      );
      await Promise.all(
        contacts.map((contact) =>
          sendEmail({
            template: "invoice-approved",
            to: contact.email,
            subject: `Invoice ${invoiceNumber} approved`,
            react: InvoiceApprovedToSub({
              subcontractorName: contact.name,
              projectName,
              invoiceNumber,
              invoiceAmount: approvedAmount,
              approvedAsNoted: decision === "approved_as_noted",
              notes: notes ?? null,
              invoiceUrl,
            }),
            entity: { type: "subcontractor_invoice", id: invoiceId },
            idempotencyKey: `invoice-approved/${invoiceId}/${decision}/${contact.email}`,
          }),
        ),
      );
    }

    // Best-effort in-app + Teams notification (never blocks the email path).
    try {
      const { data: authLinks } = await supabase
        .from("users_auth")
        .select("auth_user_id")
        .in("person_id", contacts.map((contact) => contact.id));
      const authUserIds = ((authLinks || []) as Array<{ auth_user_id: string | null }>)
        .map((row) => row.auth_user_id)
        .filter((id): id is string => !!id);
      if (authUserIds.length > 0) {
        await notifyStatusChange(authUserIds, {
          projectId,
          entityType: "subcontractor_invoice",
          entityId: String(invoiceId),
          from: "under_review",
          to: decision === "revise" ? "revise_and_resubmit" : "approved",
        });
      }
    } catch (err) {
      logger.error({
        msg: "[invoice-decision] in-app notification failed",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  } catch (err) {
    logger.error({
      msg: "[invoice-decision] subcontractor notification failed",
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

async function computeApprovedAmount(
  supabase: ReturnType<typeof createServiceClient>,
  invoiceId: number,
): Promise<string> {
  const { data: lineItems } = await supabase
    .from("subcontractor_invoice_line_items")
    .select(
      "work_completed_period, materials_stored, retainage_amount, materials_retainage_amount, work_retainage_released, materials_retainage_released",
    )
    .eq("invoice_id", invoiceId);

  const total = ((lineItems || []) as Array<{
    work_completed_period: number | null;
    materials_stored: number | null;
    retainage_amount: number | null;
    materials_retainage_amount: number | null;
    work_retainage_released: number | null;
    materials_retainage_released: number | null;
  }>).reduce((sum, row) => {
    const work = Number(row.work_completed_period ?? 0);
    const mat = Number(row.materials_stored ?? 0);
    const ret =
      Number(row.retainage_amount ?? 0) + Number(row.materials_retainage_amount ?? 0);
    const released =
      Number(row.work_retainage_released ?? 0) +
      Number(row.materials_retainage_released ?? 0);
    return sum + work + mat - ret + released;
  }, 0);

  return total.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });
}
