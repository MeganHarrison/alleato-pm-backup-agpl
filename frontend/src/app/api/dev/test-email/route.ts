/**
 * Dev-only endpoint to test email templates via Resend.
 *
 * POST /api/dev/test-email
 * Body: { template: "user-invite" | "forgot-password" | "sov-invitation" | "invoice-submitted-to-pm", to?: string }
 *
 * Defaults `to` to "delivered@resend.dev" (Resend's test inbox — always succeeds).
 * In production, this route is a no-op.
 */

import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { sendEmail } from "@/lib/email/send";
import InviteUser from "@/emails/auth/InviteUser";
import ForgotPassword from "@/emails/auth/ForgotPassword";
import SOVInvitation from "@/emails/subcontractor/SOVInvitation";
import InvoiceSubmittedToPM from "@/emails/subcontractor/InvoiceSubmittedToPM";
import { createServiceClient } from "@/lib/supabase/service";
import { APP_BASE_URL } from "@/lib/email/client";
import { buildPasswordResetUrl } from "@/lib/email/invite-links";

const SAMPLE_BASE = "https://app.alleato.com";

const TEMPLATES: Record<
  string,
  { subject: string; react: React.ReactElement }
> = {
  "user-invite": {
    subject: "You've been invited to Alleato",
    react: InviteUser({
      inviterName: "Megan Harrison",
      inviteeName: "John Smith",
      role: "Project Manager",
      acceptUrl: `${SAMPLE_BASE}/auth/accept-invite?token=test123`,
      expiresInHours: 72,
    }),
  },
  "forgot-password": {
    subject: "Reset your Alleato password",
    react: ForgotPassword({
      userName: "John",
      resetUrl: `${SAMPLE_BASE}/auth/update-password?token=test123`,
      expiresInMinutes: 60,
      requestIp: "192.168.1.1",
    }),
  },
  "sov-invitation": {
    subject: "Submit your Schedule of Values — Vermillion Rise Warehouse",
    react: SOVInvitation({
      subcontractorName: "ABC Electrical",
      projectName: "Vermillion Rise Warehouse",
      projectNumber: "VRW-2026",
      commitmentNumber: "SC-001",
      contractAmount: "$245,000.00",
      dueDate: "April 30, 2026",
      submissionUrl: `${SAMPLE_BASE}/67/commitments/1/sov`,
      pmName: "Megan Harrison",
    }),
  },
  "invoice-submitted-to-pm": {
    subject: "New invoice from ABC Electrical — Vermillion Rise Warehouse",
    react: InvoiceSubmittedToPM({
      pmName: "Megan",
      subcontractorName: "ABC Electrical",
      projectName: "Vermillion Rise Warehouse",
      invoiceNumber: "INV-2026-004",
      invoiceAmount: "$38,750.00",
      billingPeriod: "March 2026",
      reviewUrl: `${SAMPLE_BASE}/67/invoicing/subcontractor/invoices/1`,
    }),
  },
};

export const POST = withApiGuardrails(
  "dev/test-email#POST",
  async ({ request }) => {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const template = body.template as string;
  const to = (body.to as string) || "delivered@resend.dev";
  // realInvite => generate a working set-password link for an existing account
  // (recovery link → /auth/confirm → /auth/update-password) and send the real
  // invite from the production sender. This is exactly what the employee rollout
  // sends, since every employee account already exists.
  const realInvite = body.realInvite === true && template === "user-invite";

  if (!template || !TEMPLATES[template]) {
    return NextResponse.json(
      {
        error: "Invalid template",
        available: Object.keys(TEMPLATES),
      },
      { status: 400 },
    );
  }

  let { subject, react } = TEMPLATES[template];
  let from = "Alleato Test <onboarding@resend.dev>";

  if (realInvite) {
    const serviceClient = createServiceClient();
    const { data: linkData, error: linkError } = await serviceClient.auth.admin.generateLink({
      type: "recovery",
      email: to,
      options: { redirectTo: `${APP_BASE_URL}/auth/callback` },
    });
    if (linkError || !linkData.properties?.action_link) {
      return NextResponse.json(
        { error: linkError?.message ?? "Could not create invite link" },
        { status: 500 },
      );
    }
    subject = "You're invited to Alleato Project Management Platform";
    react = InviteUser({
      inviterName: "Alleato Group",
      email: to,
      acceptUrl: buildPasswordResetUrl(linkData.properties.action_link, to),
      expiresInHours: 24,
    });
    from = process.env.EMAIL_FROM_ADDRESS || "Alleato <info@alleatogroup.com>";
  }

  const result = await sendEmail({
    template: template as Parameters<typeof sendEmail>[0]["template"],
    to,
    subject,
    react,
    from,
    entity: { type: "test", id: "test-" + Date.now() },
    idempotencyKey: `test/${template}/${Date.now()}`,
    metadata: { source: "dev-test-endpoint" },
  });

  if (result.error) {
    return NextResponse.json({ error: result.error.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    resendId: result.id,
    template,
    to,
    message: `Email sent! Check ${to === "delivered@resend.dev" ? "Resend dashboard" : to} for delivery.`,
  });
  },
);

export const GET = withApiGuardrails(
  "dev/test-email#GET",
  async () => {
  return NextResponse.json({
    usage: "POST /api/dev/test-email with { template, to? }",
    templates: Object.keys(TEMPLATES),
    defaultTo: "delivered@resend.dev",
  });
  },
);
