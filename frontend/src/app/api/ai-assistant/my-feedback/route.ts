export const dynamic = "force-dynamic";

import { z } from "zod";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { getApiRouteUser } from "@/lib/supabase/server";
import {
  listMyFeedback,
  editMyFeedback,
  retractMyFeedback,
  MyFeedbackError,
  type MyFeedbackSignalTone,
} from "@/lib/ai/services/my-feedback-service";

const WHERE = "/api/ai-assistant/my-feedback";

async function requireUser(where: string) {
  const user = await getApiRouteUser();
  if (!user) {
    throw new GuardrailError({
      code: "AUTH_EXPIRED",
      where,
      message: "Authentication required.",
      status: 401,
    });
  }
  return user;
}

function mapMyFeedbackError(err: unknown, where: string): never {
  if (err instanceof MyFeedbackError) {
    const status =
      err.kind === "forbidden" ? 403 : err.kind === "not_found" ? 404 : 400;
    throw new GuardrailError({
      code: err.kind === "forbidden" ? "FORBIDDEN" : "VALIDATION_ERROR",
      where,
      message: err.message,
      status,
    });
  }
  throw new GuardrailError({
    code: "INTERNAL_ERROR",
    where,
    message: err instanceof Error ? err.message : "Unexpected error.",
    status: 500,
  });
}

/** GET — list the current user's submitted feedback across every surface. */
export const GET = withApiGuardrails(`${WHERE}#GET`, async ({ request }) => {
  const user = await requireUser(`${WHERE}#GET`);
  const params = new URL(request.url).searchParams;
  const surface = params.get("surface") || undefined;
  const toneParam = params.get("signal");
  const signalTone: MyFeedbackSignalTone | undefined =
    toneParam === "positive" || toneParam === "negative" ? toneParam : undefined;

  const result = await listMyFeedback({ userId: user.id, surface, signalTone });
  return Response.json(result);
});

const patchSchema = z.object({
  id: z.string().uuid(),
  signal: z.enum(["positive", "negative"]).optional(),
  note: z.string().max(2000).nullable().optional(),
});

/** PATCH — change a rating (task feedback) or edit the note on any item. */
export const PATCH = withApiGuardrails(`${WHERE}#PATCH`, async ({ request }) => {
  const user = await requireUser(`${WHERE}#PATCH`);
  const parsed = patchSchema.safeParse(await request.json());
  if (!parsed.success) {
    throw new GuardrailError({
      code: "VALIDATION_ERROR",
      where: `${WHERE}#PATCH`,
      message: "Invalid request body.",
      details: parsed.error.flatten(),
      status: 400,
    });
  }

  try {
    await editMyFeedback({
      userId: user.id,
      eventId: parsed.data.id,
      signal: parsed.data.signal,
      note: parsed.data.note,
    });
  } catch (err) {
    mapMyFeedbackError(err, `${WHERE}#PATCH`);
  }
  return Response.json({ success: true });
});

const deleteSchema = z.object({ id: z.string().uuid() });

/** DELETE — undo (retract) a submitted feedback item. */
export const DELETE = withApiGuardrails(`${WHERE}#DELETE`, async ({ request }) => {
  const user = await requireUser(`${WHERE}#DELETE`);
  const parsed = deleteSchema.safeParse(await request.json());
  if (!parsed.success) {
    throw new GuardrailError({
      code: "VALIDATION_ERROR",
      where: `${WHERE}#DELETE`,
      message: "Invalid request body.",
      details: parsed.error.flatten(),
      status: 400,
    });
  }

  try {
    await retractMyFeedback(user.id, parsed.data.id);
  } catch (err) {
    mapMyFeedbackError(err, `${WHERE}#DELETE`);
  }
  return Response.json({ success: true });
});
