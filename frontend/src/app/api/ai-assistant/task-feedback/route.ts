export const dynamic = "force-dynamic";

import { z } from "zod";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { getApiRouteUser } from "@/lib/supabase/server";
import { requireAdmin } from "@/app/api/admin/_shared";
import { logger } from "@/lib/logger";
import {
  recordTaskFeedback,
  promoteTaskFeedback,
  demoteTaskFeedback,
  TASK_FEEDBACK_REASON_CATEGORIES,
} from "@/lib/ai/services/task-training-service";

const postBodySchema = z.object({
  projectId: z.number().int().positive().nullable().optional(),
  taskId: z.string().uuid().nullable().optional(),
  signal: z.enum(["good", "bad"]),
  reasonCategory: z.enum(TASK_FEEDBACK_REASON_CATEGORIES).nullable().optional(),
  reason: z.string().max(1000).nullable().optional(),
  taskSnapshot: z.object({
    name: z.string().min(1).max(500),
    assignee: z.string().max(200).nullable().optional(),
    dueDate: z.string().nullable().optional(),
    priority: z.string().max(50),
    notes: z.string().max(2000).nullable().optional(),
    projectId: z.number().int().positive().nullable().optional(),
    source: z.string().max(100).nullable().optional(),
    generatedBy: z.string().max(200).nullable().optional(),
  }),
  sessionId: z.string().nullable().optional(),
});

const patchBodySchema = z.object({
  id: z.string().uuid(),
  promoted: z.boolean(),
});

/**
 * POST /api/ai-assistant/task-feedback
 *
 * Records user feedback (good/bad signal) on an AI-generated task.
 */
export const POST = withApiGuardrails(
  "/api/ai-assistant/task-feedback#POST",
  async ({ request }) => {
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "/api/ai-assistant/task-feedback#POST",
        message: "Authentication required.",
        status: 401,
      });
    }

    const body = await request.json();
    const parsed = postBodySchema.safeParse(body);
    if (!parsed.success) {
      throw new GuardrailError({
        code: "VALIDATION_ERROR",
        where: "/api/ai-assistant/task-feedback#POST",
        message: "Invalid request body.",
        details: parsed.error.flatten(),
        status: 400,
      });
    }

    const {
      projectId,
      taskId,
      signal,
      reasonCategory,
      reason,
      taskSnapshot,
      sessionId,
    } =
      parsed.data;

    try {
      const { id } = await recordTaskFeedback({
        userId: user.id,
        projectId,
        taskId,
        signal,
        reasonCategory,
        reason,
        taskSnapshot,
        sessionId,
      });

      logger.info({
        msg: "[TaskFeedback] Recorded",
        data: { id, signal, projectId },
      });

      return Response.json({ success: true, id });
    } catch (err) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where: "/api/ai-assistant/task-feedback#POST",
        message: err instanceof Error ? err.message : "Failed to record task feedback.",
        status: 500,
      });
    }
  },
);

/**
 * PATCH /api/ai-assistant/task-feedback
 *
 * Admin-only: promote or demote a task feedback record for training inclusion.
 */
export const PATCH = withApiGuardrails(
  "/api/ai-assistant/task-feedback#PATCH",
  async ({ request }) => {
    await requireAdmin("/api/ai-assistant/task-feedback#PATCH");

    const body = await request.json();
    const parsed = patchBodySchema.safeParse(body);
    if (!parsed.success) {
      throw new GuardrailError({
        code: "VALIDATION_ERROR",
        where: "/api/ai-assistant/task-feedback#PATCH",
        message: "Invalid request body.",
        details: parsed.error.flatten(),
        status: 400,
      });
    }

    const { id, promoted } = parsed.data;

    if (promoted) {
      await promoteTaskFeedback(id);
    } else {
      await demoteTaskFeedback(id);
    }

    return Response.json({ success: true });
  },
);
