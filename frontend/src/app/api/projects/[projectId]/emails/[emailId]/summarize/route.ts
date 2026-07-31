export const dynamic = "force-dynamic";

import { generateText } from "ai";
import { NextResponse } from "next/server";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { buildOwnEmailsFilter } from "@/lib/emails/access";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { getLanguageModel } from "@/lib/ai/providers";

const WHERE = "projects/[projectId]/emails/[emailId]/summarize#POST";

/**
 * POST /api/projects/[projectId]/emails/[emailId]/summarize
 * Generates a 1-2 sentence AI summary of a single project email.
 *
 * Access mirrors the email GET route: admins can summarize any email in the
 * project; non-admins are scoped to emails they sent/received. A summary is
 * never fabricated for an email the caller cannot see — the lookup runs through
 * the same access filter and returns 404 otherwise.
 */
export const POST = withApiGuardrails<{ projectId: string; emailId: string }>(
  WHERE,
  async ({ params }) => {
    const { projectId, emailId } = await params;
    const supabase = await createClient();

    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: WHERE,
        message: "Authentication required.",
      });
    }

    const numericEmailId = Number.parseInt(emailId, 10);
    const numericProjectId = Number.parseInt(projectId, 10);
    if (
      !Number.isFinite(numericEmailId) ||
      numericEmailId <= 0 ||
      !Number.isFinite(numericProjectId) ||
      numericProjectId <= 0
    ) {
      throw new GuardrailError({
        code: "VALIDATION_ERROR",
        where: WHERE,
        message: "Invalid project or email ID.",
        status: 400,
      });
    }

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("is_admin")
      .eq("id", user.id)
      .maybeSingle();
    const isAdmin = profile?.is_admin === true;

    let query = supabase
      .from("project_emails")
      .select("subject, from_name, from_email, body_text, body, body_html")
      .eq("id", numericEmailId)
      .eq("project_id", numericProjectId)
      .is("deleted_at", null);

    if (!isAdmin) {
      const filter = buildOwnEmailsFilter({
        authUserId: user.id,
        email: user.email,
      });
      if (!filter) {
        throw new GuardrailError({
          code: "NOT_FOUND",
          where: WHERE,
          message: "Email not found.",
          status: 404,
        });
      }
      query = query.or(filter);
    }

    const { data: email, error } = await query.maybeSingle();

    if (error) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where: WHERE,
        message: error.message,
      });
    }

    if (!email) {
      throw new GuardrailError({
        code: "NOT_FOUND",
        where: WHERE,
        message: "Email not found.",
        status: 404,
      });
    }

    const source =
      email.body_text?.trim() ||
      email.body?.trim() ||
      email.body_html?.trim() ||
      "";
    const truncatedBody = source.slice(0, 4000);

    if (!truncatedBody) {
      return NextResponse.json({
        summary: "This email has no body content to summarize.",
      });
    }

    const { text } = await generateText({
      model: getLanguageModel("gpt-4.1-mini"),
      instructions:
        "You are an assistant for a construction project management team. " +
        "Summarize the email in 1-2 plain sentences capturing the key point, " +
        "any request or decision, and any deadline. No preamble, no greeting, " +
        "no bullet points — return only the summary sentences.",
      prompt: `Subject: ${email.subject ?? "(no subject)"}
From: ${email.from_name ?? email.from_email ?? "Unknown sender"}

---
${truncatedBody}
---`,
      maxOutputTokens: 200,
    });

    return NextResponse.json({ summary: text.trim() });
  },
);
