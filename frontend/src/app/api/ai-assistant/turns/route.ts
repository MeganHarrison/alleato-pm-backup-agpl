import { randomUUID } from "node:crypto";

import {
  AssistantTurnNotFoundError,
  createAssistantTurn,
  createSupabaseAssistantTurnRepository,
  type AssistantTurnActor,
  type AssistantTurnRepository,
} from "@/lib/ai/assistant-turn";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createServiceClient } from "@/lib/supabase/service";
import { getApiRouteUserFromRequest } from "@/lib/supabase/server";

function repository(): AssistantTurnRepository {
  return createSupabaseAssistantTurnRepository(createServiceClient());
}

function observationService() {
  return createAssistantTurn({
    repository: repository(),
    createTurnId: randomUUID,
    defer: () => {
      throw new Error("Observation must never schedule generation work.");
    },
    runtime: {
      async generate() {
        throw new Error("Observation must never start generation work.");
      },
      async cancel() {
        throw new Error("Observation must never cancel generation work.");
      },
    },
  });
}

async function requireActor(
  request: Request,
  permission: "assistant:execute" | "assistant:observe" = "assistant:observe",
): Promise<AssistantTurnActor> {
  const user = await getApiRouteUserFromRequest(request);
  if (!user) {
    throw new GuardrailError({
      code: "AUTH_EXPIRED",
      where: "ai-assistant/turns",
      message: "Sign in to inspect an AI Assistant turn.",
      status: 401,
    });
  }
  return {
    id: user.id,
    organizationId: null,
    permissions: [permission],
  };
}

function turnQuery(request: Request) {
  const url = new URL(request.url);
  const turnId = url.searchParams.get("turnId")?.trim();
  if (!turnId) {
    throw new GuardrailError({
      code: "INVALID_PAYLOAD",
      where: "ai-assistant/turns",
      message: "turnId query parameter is required.",
      status: 400,
    });
  }
  const afterRaw = url.searchParams.get("afterSequence");
  const afterSequence = afterRaw === null ? 0 : Number(afterRaw);
  if (!Number.isInteger(afterSequence) || afterSequence < 0) {
    throw new GuardrailError({
      code: "INVALID_PAYLOAD",
      where: "ai-assistant/turns",
      message: "afterSequence must be a non-negative integer.",
      status: 400,
    });
  }
  return { turnId, afterSequence };
}

export const GET = withApiGuardrails(
  "ai-assistant/turns#GET",
  async ({ request }) => {
    const actor = await requireActor(request);
    const query = turnQuery(request);
    try {
      const observation = await observationService().observe(query, actor);
      return Response.json(observation, {
        headers: { "cache-control": "no-store" },
      });
    } catch (error) {
      if (error instanceof AssistantTurnNotFoundError) {
        throw new GuardrailError({
          code: "NOT_FOUND",
          where: "ai-assistant/turns#GET",
          message: error.message,
          status: 404,
        });
      }
      throw error;
    }
  },
);

export const DELETE = withApiGuardrails(
  "ai-assistant/turns#DELETE",
  async ({ request }) => {
    const actor = await requireActor(request, "assistant:execute");
    const { turnId } = turnQuery(request);
    const turnRepository = repository();
    const current = await turnRepository.get(turnId, actor);
    if (!current) {
      throw new GuardrailError({
        code: "NOT_FOUND",
        where: "ai-assistant/turns#DELETE",
        message: `Assistant turn "${turnId}" was not found for this actor.`,
        status: 404,
      });
    }
    if (current.status === "canceled") {
      return Response.json(
        { disposition: "already_canceled", receipt: current },
        { headers: { "cache-control": "no-store" } },
      );
    }
    if (current.lifecycle === "terminal") {
      throw new GuardrailError({
        code: "PRECONDITION_FAILED",
        where: "ai-assistant/turns#DELETE",
        message: `Assistant turn "${turnId}" already ended with status "${current.status}" and cannot be canceled.`,
        status: 409,
        details: { reason: "ASSISTANT_TURN_ALREADY_TERMINAL" },
      });
    }

    throw new GuardrailError({
      code: "NOT_IMPLEMENTED",
      where: "ai-assistant/turns#DELETE",
      message:
        "Eve 0.22.6 has no supported durable out-of-band cancellation protocol. Use Stop while the live Eve request is connected; this durable turn remains active.",
      status: 501,
      details: { reason: "EVE_DURABLE_CANCEL_UNAVAILABLE" },
    });
  },
);
