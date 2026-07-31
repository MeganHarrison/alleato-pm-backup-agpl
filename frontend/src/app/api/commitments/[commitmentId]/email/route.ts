/**
 * =============================================================================
 * COMMITMENT EMAIL API ENDPOINT
 * =============================================================================
 *
 * Send commitment details via email to specified recipients
 * Supports optional PDF attachment and custom messages
 */

import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

interface EmailRecipient {
  email: string;
  name: string;
}

interface EmailParams {
  recipients: EmailRecipient[];
  subject: string;
  message?: string;
  attach_pdf: boolean;
  include_sov_items: boolean;
}

interface CommitmentData {
  id: string;
  number: string;
  title: string;
  description: string | null;
  status: string;
  type: string;
  original_amount: number;
  revised_contract_amount: number;
  billed_to_date: number;
  balance_to_finish: number;
  contract_company: {
    name: string;
  } | null;
  line_items: Array<{
    line_number: number | null;
    description: string | null;
    amount: number | null;
    billed_to_date: number | null;
  }>;
}

/**
 * POST /api/commitments/[commitmentId]/email
 *
 * Sends commitment details via email to specified recipients.
 * Generates an HTML email containing commitment information, financial summary,
 * and optional SOV line items. Supports optional PDF attachment flag.
 *
 * @route POST /api/commitments/[commitmentId]/email
 * @param {string} commitmentId - Commitment UUID
 *
 * @requestBody {object}
 *   - recipients {Array<{email: string, name: string}>} (required) - At least one recipient
 *   - subject {string} (required) - Email subject line
 *   - message {string} [optional] - Custom message to include in the email body
 *   - attach_pdf {boolean} [default=true] - Whether to attach a PDF copy
 *   - include_sov_items {boolean} [default=true] - Include SOV breakdown in email
 *
 * @returns {object} 200 - {
 *     success: true,
 *     message: "Email sent to N recipient(s)",
 *     recipients: string[]
 *   }
 * @returns {object} 400 - Missing recipients, invalid subject, or invalid email address
 * @returns {object} 401 - Unauthorized (no user session)
 * @returns {object} 404 - Commitment not found
 * @returns {object} 500 - Email sending error
 *
 * @note Currently logs email but actual sending requires integration with an
 *   email service (SendGrid, AWS SES, Resend, Postmark).
 */
export const POST = withApiGuardrails<{ commitmentId: string }>(
  "commitments/[commitmentId]/email#POST",
  async ({ request, params }) => {
  
    const { commitmentId } = await params;
    const supabase = await createClient();

    // Check authentication
    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "commitments/[commitmentId]/email#POST", message: "Authentication required." });
    }

    const body = await request.json();

    // Validate request
    if (!body.recipients || !Array.isArray(body.recipients) || body.recipients.length === 0) {
      return NextResponse.json(
        { error: "At least one recipient is required" },
        { status: 400 }
      );
    }

    if (!body.subject || typeof body.subject !== "string" || !body.subject.trim()) {
      return NextResponse.json(
        { error: "Subject is required" },
        { status: 400 }
      );
    }

    // Validate email addresses
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalidEmails = body.recipients.filter(
      (r: EmailRecipient) => !emailRegex.test(r.email)
    );
    if (invalidEmails.length > 0) {
      return NextResponse.json(
        { error: `Invalid email address: ${invalidEmails[0].email}` },
        { status: 400 }
      );
    }

    const emailParams: EmailParams = {
      recipients: body.recipients,
      subject: body.subject.trim(),
      message: body.message?.trim() || "",
      attach_pdf: body.attach_pdf !== false,
      include_sov_items: body.include_sov_items !== false,
    };

    // Fetch commitment data
    const commitmentData = await fetchCommitmentData(supabase, commitmentId);
    if (!commitmentData) {
      return NextResponse.json(
        { error: "Commitment not found" },
        { status: 404 }
      );
    }

    // Get sender info
    const { data: senderProfile } = await supabase
      .from("people")
      .select("first_name, last_name, email")
      .eq("auth_user_id", user.id)
      .single();

    const senderName = senderProfile
      ? `${senderProfile.first_name || ""} ${senderProfile.last_name || ""}`.trim()
      : user.email?.split("@")[0] || "Alleato User";
    const senderEmail = senderProfile?.email || user.email || "noreply@alleato.com";

    // Generate email content
    const emailHTML = generateEmailHTML(commitmentData, emailParams, senderName);

    // Optionally generate a PDF attachment
    let pdfBase64: string | null = null;
    if (emailParams.attach_pdf) {
      try {
        const { renderPdfFromHtml } = await import("@/lib/documents/pdf");
        const pdfBuffer = await renderPdfFromHtml(emailHTML);
        pdfBase64 = Buffer.from(pdfBuffer).toString("base64");
      } catch (pdfError) {
        logger.error({ msg: "[commitment/email] PDF generation failed, sending without attachment", error: pdfError instanceof Error ? pdfError.message : String(pdfError) });
      }
    }

    // Send via Resend
    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);

    const toAddresses = emailParams.recipients.map((r) =>
      r.name ? `${r.name} <${r.email}>` : r.email
    );

    const { data: sendResult, error: sendError } = await resend.emails.send({
      from:
        process.env.EMAIL_FROM_ADDRESS ??
        "Alleato <notifications@alleato.app>",
      to: toAddresses,
      subject: emailParams.subject,
      html: emailHTML,
      ...(pdfBase64
        ? {
            attachments: [
              {
                filename: `commitment-${commitmentData.number}.pdf`,
                content: pdfBase64,
              },
            ],
          }
        : {}),
    });

    if (sendError) {
      logger.error({ msg: "[commitment/email] Resend error", error: sendError.message });
      return NextResponse.json(
        { error: "Failed to send email. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Email sent to ${emailParams.recipients.length} recipient(s)`,
      recipients: emailParams.recipients.map((r) => r.email),
      id: sendResult?.id,
    });
    },
);

// =============================================================================
// DATA FETCHING
// =============================================================================

async function fetchCommitmentData(
  supabase: Awaited<ReturnType<typeof createClient>>,
  id: string
): Promise<CommitmentData | null> {
  // Determine type from unified view
  const { data: unifiedData, error: unifiedError } = await supabase
    .from("commitments_unified")
    .select("commitment_type")
    .eq("id", id)
    .single();

  if (unifiedError || !unifiedData) {
    return null;
  }

  const isSubcontract = unifiedData.commitment_type === "subcontract";
  const sovTableName = isSubcontract
    ? "subcontract_sov_items"
    : "purchase_order_sov_items";
  const sovFkColumn = isSubcontract ? "subcontract_id" : "purchase_order_id";
  const totalsViewName = isSubcontract
    ? "subcontracts_with_totals"
    : "purchase_orders_with_totals";

  // Fetch base record (no embedded company — FK is not declared in the
  // generated schema, so we look it up separately). Narrow by type so TS
  // can distinguish the two row shapes.
  const baseRecord = isSubcontract
    ? await supabase
        .from("subcontracts")
        .select(
          "id, contract_number, title, description, status, contract_company_id",
        )
        .eq("id", id)
        .single()
    : await supabase
        .from("purchase_orders")
        .select(
          "id, contract_number, title, description, status, contract_company_id",
        )
        .eq("id", id)
        .single();

  if (baseRecord.error || !baseRecord.data) {
    return null;
  }
  const data = baseRecord.data;

  // Separate companies lookup for the contract company name.
  let contractCompany: { name: string } | null = null;
  if (data.contract_company_id) {
    const { data: companyRow } = await supabase
      .from("companies")
      .select("name")
      .eq("id", data.contract_company_id)
      .maybeSingle();
    if (companyRow) contractCompany = { name: companyRow.name };
  }

  // Fetch financial totals
  const { data: totalsData } = await (supabase as unknown as {
    from: (table: string) => {
      select: (cols: string) => {
        eq: (col: string, val: string) => {
          single: () => Promise<{
            data: {
              total_sov_amount: number | null;
              total_billed_to_date: number | null;
              total_amount_remaining: number | null;
            } | null;
          }>;
        };
      };
    };
  })
    .from(totalsViewName)
    .select("total_sov_amount, total_billed_to_date, total_amount_remaining")
    .eq("id", id)
    .single();

  // Fetch SOV line items
  const { data: sovItems } = await (supabase as unknown as {
    from: (table: string) => {
      select: (cols: string) => {
        eq: (col: string, val: string) => {
          order: (col: string, opts: { ascending: boolean }) => Promise<{
            data: Array<{
              line_number: number | null;
              description: string | null;
              amount: number | null;
              billed_to_date: number | null;
            }> | null;
          }>;
        };
      };
    };
  })
    .from(sovTableName)
    .select("line_number, description, amount, billed_to_date")
    .eq(sovFkColumn, id)
    .order("line_number", { ascending: true });

  const originalAmount = Number(totalsData?.total_sov_amount) || 0;
  const billedToDate = Number(totalsData?.total_billed_to_date) || 0;
  const balanceToFinish = Number(totalsData?.total_amount_remaining) || 0;

  if (!data.id) {
    return null;
  }

  return {
    id: data.id,
    number: data.contract_number,
    title: data.title ?? "",
    description: data.description,
    status: data.status,
    type: unifiedData.commitment_type ?? (isSubcontract ? "subcontract" : "purchase_order"),
    original_amount: originalAmount,
    revised_contract_amount: originalAmount,
    billed_to_date: billedToDate,
    balance_to_finish: balanceToFinish,
    contract_company: contractCompany,
    line_items: sovItems ?? [],
  };
}

// =============================================================================
// EMAIL HTML GENERATION
// =============================================================================

function generateEmailHTML(
  data: CommitmentData,
  params: EmailParams,
  senderName: string
): string {
  let sovSection = "";
  if (params.include_sov_items && data.line_items.length > 0) {
    const sovRows = data.line_items
      .map(
        (item) => `
        <tr>
          <td style="border: 1px solid #e2e8f0; padding: 8px;">${item.line_number || "-"}</td>
          <td style="border: 1px solid #e2e8f0; padding: 8px;">${escapeHTML(item.description || "")}</td>
          <td style="border: 1px solid #e2e8f0; padding: 8px; text-align: right;">${formatCurrency(item.amount || 0)}</td>
        </tr>
      `
      )
      .join("");

    sovSection = `
      <h3 style="color: #1e40af; margin-top: 24px;">Schedule of Values</h3>
      <table style="width: 100%; border-collapse: collapse; margin-top: 8px;">
        <thead>
          <tr style="background-color: #f1f5f9;">
            <th style="border: 1px solid #e2e8f0; padding: 8px; text-align: left;">Line #</th>
            <th style="border: 1px solid #e2e8f0; padding: 8px; text-align: left;">Description</th>
            <th style="border: 1px solid #e2e8f0; padding: 8px; text-align: right;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${sovRows}
        </tbody>
      </table>
    `;
  }

  const customMessage = params.message
    ? `
    <div style="background-color: #fef3c7; padding: 16px; border-radius: 8px; margin-bottom: 24px;">
      <p style="margin: 0; white-space: pre-wrap;">${escapeHTML(params.message)}</p>
    </div>
  `
    : "";

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">

  <div style="background-color: #1e40af; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
    <h1 style="margin: 0; font-size: 20px;">${escapeHTML(data.number)}</h1>
    <p style="margin: 4px 0 0 0; opacity: 0.9;">${escapeHTML(data.title)}</p>
  </div>

  <div style="background-color: #f8fafc; padding: 20px; border: 1px solid #e2e8f0; border-top: none;">
    ${customMessage}

    <div style="background-color: white; padding: 16px; border-radius: 8px; margin-bottom: 16px;">
      <table style="width: 100%;">
        <tr>
          <td style="padding: 4px 0;"><strong>Contractor:</strong></td>
          <td style="padding: 4px 0;">${escapeHTML(data.contract_company?.name || "N/A")}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0;"><strong>Status:</strong></td>
          <td style="padding: 4px 0;">${escapeHTML(data.status)}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0;"><strong>Type:</strong></td>
          <td style="padding: 4px 0;">${escapeHTML(data.type)}</td>
        </tr>
      </table>
    </div>

    <h3 style="color: #1e40af; margin-top: 24px;">Financial Summary</h3>
    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px;">
      <div style="background-color: white; padding: 12px; border-radius: 8px; text-align: center;">
        <div style="font-size: 12px; color: #64748b;">Contract Amount</div>
        <div style="font-size: 18px; font-weight: 600; color: #1e40af;">${formatCurrency(data.original_amount)}</div>
      </div>
      <div style="background-color: white; padding: 12px; border-radius: 8px; text-align: center;">
        <div style="font-size: 12px; color: #64748b;">Billed to Date</div>
        <div style="font-size: 18px; font-weight: 600; color: #1e40af;">${formatCurrency(data.billed_to_date)}</div>
      </div>
      <div style="background-color: white; padding: 12px; border-radius: 8px; text-align: center;">
        <div style="font-size: 12px; color: #64748b;">Balance to Finish</div>
        <div style="font-size: 18px; font-weight: 600; color: #1e40af;">${formatCurrency(data.balance_to_finish)}</div>
      </div>
    </div>

    ${sovSection}

    ${params.attach_pdf ? '<p style="margin-top: 24px; color: #64748b; font-size: 14px;">A PDF copy of this commitment is attached to this email.</p>' : ""}
  </div>

  <div style="padding: 16px; text-align: center; color: #64748b; font-size: 12px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px;">
    <p style="margin: 0;">Sent by ${escapeHTML(senderName)} via Alleato Project Management</p>
    <p style="margin: 4px 0 0 0;">${new Date().toLocaleDateString()}</p>
  </div>

</body>
</html>
  `;
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function escapeHTML(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
