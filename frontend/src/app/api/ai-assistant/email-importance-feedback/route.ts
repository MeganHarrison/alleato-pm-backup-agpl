export const dynamic = "force-dynamic";

import { z } from "zod";

import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { getApiRouteUser } from "@/lib/supabase/server";
import {
  EMAIL_IMPORTANCE_REASON_CATEGORIES,
  EMAIL_IMPORTANCE_SIGNALS,
} from "@/lib/ai/email-importance-feedback-types";
import {
  clearEmailImportanceFeedback,
  getLatestEmailImportanceFeedback,
  recordEmailImportanceFeedback,
} from "@/lib/ai/services/email-importance-feedback-service";
import type { Json } from "@/types/database.types";

const postBodySchema = z.object({
  emailId: z.number().int().positive(),
  projectId: z.number().int().positive().nullable().optional(),
  signal: z.enum(EMAIL_IMPORTANCE_SIGNALS),
  reasonCategory: z
    .enum(EMAIL_IMPORTANCE_REASON_CATEGORIES)
    .nullable()
    .optional(),
  reason: z.string().max(1000).nullable().optional(),
  emailSnapshot: z.record(z.string(), z.unknown()),
});

const deleteBodySchema = z.object({
  emailId: z.number().int().positive(),
  projectId: z.number().int().positive().nullable().optional(),
  emailSnapshot: z.record(z.string(), z.unknown()).optional(),
});

export const GET = withApiGuardrails(
  "/api/ai-assistant/email-importance-feedback#GET",
  async ({ request }) => {
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "/api/ai-assistant/email-importance-feedback#GET",
        message: "Authentication required.",
        status: 401,
      });
    }

    const { searchParams } = new URL(request.url);
    const emailIds = searchParams
      .getAll("emailId")
      .map((value) => Number.parseInt(value, 10))
      .filter((value) => Number.isInteger(value) && value > 0);

    const feedbackByEmailId = await getLatestEmailImportanceFeedback(
      user.id,
      emailIds,
    );

    return Response.json({ feedbackByEmailId });
  },
);

export const POST = withApiGuardrails(
  "/api/ai-assistant/email-importance-feedback#POST",
  async ({ request }) => {
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "/api/ai-assistant/email-importance-feedback#POST",
        message: "Authentication required.",
        status: 401,
      });
    }

    const body = await request.json();
    const parsed = postBodySchema.safeParse(body);
    if (!parsed.success) {
      throw new GuardrailError({
        code: "VALIDATION_ERROR",
        where: "/api/ai-assistant/email-importance-feedback#POST",
        message: "Invalid request body.",
        details: parsed.error.flatten(),
        status: 400,
      });
    }

    const { emailId, projectId, signal, reasonCategory, reason, emailSnapshot } =
      parsed.data;

    const event = await recordEmailImportanceFeedback({
      userId: user.id,
      emailId,
      projectId: projectId ?? null,
      signal,
      reasonCategory: reasonCategory ?? null,
      reason: reason ?? null,
      emailSnapshot: emailSnapshot as Json,
    });

    return Response.json({ success: true, id: event.id });
  },
);

export const DELETE = withApiGuardrails(
  "/api/ai-assistant/email-importance-feedback#DELETE",
  async ({ request }) => {
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "/api/ai-assistant/email-importance-feedback#DELETE",
        message: "Authentication required.",
        status: 401,
      });
    }

    const body = await request.json();
    const parsed = deleteBodySchema.safeParse(body);
    if (!parsed.success) {
      throw new GuardrailError({
        code: "VALIDATION_ERROR",
        where: "/api/ai-assistant/email-importance-feedback#DELETE",
        message: "Invalid request body.",
        details: parsed.error.flatten(),
        status: 400,
      });
    }

    const { emailId, projectId, emailSnapshot } = parsed.data;

    const event = await clearEmailImportanceFeedback({
      userId: user.id,
      emailId,
      projectId: projectId ?? null,
      emailSnapshot: emailSnapshot ? (emailSnapshot as Json) : undefined,
    });

    return Response.json({ success: true, id: event.id, feedback: null });
  },
);
