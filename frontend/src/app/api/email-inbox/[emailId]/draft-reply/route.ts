export const dynamic = "force-dynamic";

import { z } from "zod";
import { generateText } from "ai";
import { NextResponse } from "next/server";
import { withApiGuardrails, parseJsonBody } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { getLanguageModel } from "@/lib/ai/providers";
import {
  createOutlookIntakeServiceClient,
  createServiceClient,
} from "@/lib/supabase/service";
import { serviceDb } from "@/lib/supabase/service-db";
import {
  deriveBrandonDraftLearning,
  formatBrandonDraftLearningGuidance,
  type BrandonAssistantReviewLearningRow,
} from "@/lib/email-assistant/brandon-learning";

const BodySchema = z.object({
  // Optionally pass context; if absent we fetch the email ourselves
  subject: z.string().optional(),
  fromName: z.string().nullable().optional(),
  fromEmail: z.string().nullable().optional(),
  bodyText: z.string().nullable().optional(),
  projectName: z.string().nullable().optional(),
  tone: z.enum(["professional", "concise", "detailed"]).default("professional"),
});

export const POST = withApiGuardrails<{ emailId: string }>(
  "email-inbox/[emailId]/draft-reply#POST",
  async ({ request, params }) => {
    const supabase = await createClient();
    const appService = createServiceClient();
    const intakeService = createOutlookIntakeServiceClient();
    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "email-inbox/[emailId]/draft-reply#POST",
        message: "Authentication required.",
      });
    }

    const { emailId: rawId } = await params;
    const emailId = parseInt(rawId, 10);

    if (!Number.isFinite(emailId) || emailId <= 0) {
      throw new GuardrailError({
        code: "VALIDATION_ERROR",
        where: "email-inbox/[emailId]/draft-reply#POST",
        message: "Invalid email ID.",
        status: 400,
      });
    }

    const parsed = await parseJsonBody(
      request,
      BodySchema,
      "email-inbox/[emailId]/draft-reply#POST",
    );

    // Fetch email if context wasn't passed inline
    let subject = parsed.subject;
    let fromName = parsed.fromName;
    let fromEmail = parsed.fromEmail;
    let bodyText = parsed.bodyText;
    let projectName = parsed.projectName;
    let projectId: number | null = null;

    if (!subject) {
      const { data: email } = await intakeService
        .from("outlook_email_intake")
        .select(
          "subject, from_name, from_email, body_text, body, project_id",
        )
        .eq("id", emailId)
        .is("deleted_at", null)
        .maybeSingle();

      if (!email) {
        throw new GuardrailError({
          code: "NOT_FOUND",
          where: "email-inbox/[emailId]/draft-reply#POST",
          message: "Email not found.",
          status: 404,
        });
      }

      subject = email.subject;
      fromName = email.from_name;
      fromEmail = email.from_email;
      bodyText = email.body_text ?? email.body;
      projectId = email.project_id ?? null;
    }

    if (!projectName && projectId) {
      const { data: project, error: projectError } = await serviceDb.from("projects")
        .select("name")
        .eq("id", projectId)
        .maybeSingle();

      if (projectError) {
        throw new GuardrailError({
          code: "INTERNAL_ERROR",
          where: "email-inbox/[emailId]/draft-reply#POST",
          message: projectError.message,
        });
      }

      projectName = project?.name ?? null;
    }

    const truncatedBody = (bodyText ?? "").slice(0, 3000);
    const projectContext = projectName ? `\nThis email is related to project: ${projectName}.` : "";
    const toneInstructions =
      parsed.tone === "concise"
        ? "Be brief and to the point — 2-4 sentences max."
        : parsed.tone === "detailed"
          ? "Provide a thorough, detailed response addressing all points raised."
          : "Be professional, warm, and clear.";
    const { data: reviewRows, error: reviewError } = await supabase
      .from("outlook_email_assistant_reviews")
      .select(
        "review_outcome, draft_body, assistant_action, assistant_priority, reviewer_note, created_at",
      )
      .eq("mailbox_user_id", "bclymer@alleatogroup.com")
      .order("created_at", { ascending: false })
      .limit(25);

    if (reviewError) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where: "email-inbox/[emailId]/draft-reply#POST",
        message: `Failed to load Brandon email review learnings: ${reviewError.message}`,
      });
    }

    const learning = deriveBrandonDraftLearning(
      (reviewRows ?? []) as BrandonAssistantReviewLearningRow[],
    );
    const learningGuidance = formatBrandonDraftLearningGuidance(learning);
    const learningContext = learningGuidance ? `\n\n${learningGuidance}` : "";

    const { text } = await generateText({
      model: getLanguageModel("gpt-4.1-mini"),
      instructions: `You are a professional construction project manager assistant drafting email replies on behalf of a PM at Alleato Group, a construction management firm based in Indianapolis.${projectContext}

${toneInstructions}
${learningContext}

Write only the body of the reply — no subject line, no headers. Do not include any opening like "Subject:" or "From:". Start directly with the greeting or first sentence.`,
      prompt: `Draft a professional reply to this email:

From: ${fromName ?? fromEmail ?? "Unknown sender"}
Subject: ${subject ?? "(no subject)"}

---
${truncatedBody || "(no body)"}
---

Write a reply that:
- Opens with a natural greeting
- Addresses the key points in the email
- Is actionable and clear
- Maintains a professional construction industry tone
- Does not promise specific timelines or commitments without context`,
      maxOutputTokens: 600,
    });

    return NextResponse.json({
      draft: text,
      learning: {
        reviewCount: learning.reviewCount,
        draftCount: learning.draftCount,
        guidance: learning.guidance,
        guidanceItems: learning.guidanceItems,
      },
    });
  },
);
