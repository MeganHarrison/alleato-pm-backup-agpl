import { type NextRequest, NextResponse } from "next/server";

import {
  DOCS_TRAINING_AUDIENCE,
  DocsTrainingProgressSchema,
  isAllowedDocsTrainingOrigin,
} from "@/lib/analytics/docs-training-contract";
import {
  DocsTrainingAssertionError,
  verifyDocsTrainingAssertion,
} from "@/lib/analytics/docs-training-assertion";
import { isTrackableVideoLesson } from "@/lib/analytics/video-tracking";
import { parseJsonBody, withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createServiceClient } from "@/lib/supabase/service";
import { serviceDb } from "@/lib/supabase/service-db";

const WHERE = "api.engagement.docs.progress#POST";
const ALLOWED_HEADERS = "authorization, content-type";

function addCorsHeaders(response: Response, origin: string): Response {
  response.headers.set("access-control-allow-origin", origin);
  response.headers.set("access-control-allow-methods", "POST, OPTIONS");
  response.headers.set("access-control-allow-headers", ALLOWED_HEADERS);
  response.headers.set("access-control-max-age", "600");
  response.headers.set("vary", "Origin");
  return response;
}

function assertionFrom(request: Request): string {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    throw new GuardrailError({
      code: "AUTH_EXPIRED",
      where: WHERE,
      message: "Reopen this documentation from Alleato to record training progress.",
      status: 401,
    });
  }
  const assertion = authorization.slice("Bearer ".length).trim();
  if (!assertion) {
    throw new GuardrailError({
      code: "AUTH_EXPIRED",
      where: WHERE,
      message: "Reopen this documentation from Alleato to record training progress.",
      status: 401,
    });
  }
  return assertion;
}

function assertionSubject(assertion: string, sourceId: string): string {
  try {
    const claims = verifyDocsTrainingAssertion(assertion, {
      audience: DOCS_TRAINING_AUDIENCE,
    });
    if (claims.sourceId !== sourceId) {
      throw new GuardrailError({
        code: "FORBIDDEN",
        where: WHERE,
        message: "This documentation training link belongs to a different video lesson.",
        status: 403,
      });
    }
    return claims.subject;
  } catch (error) {
    if (error instanceof DocsTrainingAssertionError) {
      throw new GuardrailError({
        code:
          error.failure === "wrong_audience" ||
          error.failure === "wrong_purpose"
            ? "FORBIDDEN"
            : "AUTH_EXPIRED",
        where: WHERE,
        message:
          error.failure === "expired"
            ? "This documentation training link expired. Reopen it from Alleato."
            : "This documentation training link is not valid for progress recording.",
        status:
          error.failure === "wrong_audience" ||
          error.failure === "wrong_purpose"
            ? 403
            : 401,
      });
    }
    throw error;
  }
}

const guardedPost = withApiGuardrails(WHERE, async ({ request }) => {
  const origin = request.headers.get("origin");
  if (!isAllowedDocsTrainingOrigin(origin)) {
    throw new GuardrailError({
      code: "FORBIDDEN",
      where: WHERE,
      message: "Training progress is accepted only from an approved Alleato documentation origin.",
      status: 403,
    });
  }

  const input = await parseJsonBody(
    request,
    DocsTrainingProgressSchema,
    WHERE,
  );
  const learnerId = assertionSubject(assertionFrom(request), input.sourceId);
  const { data: content, error: contentError } = await serviceDb
    .from("knowledge_content_item")
    .select("id, content_kind, source_type")
    .eq("source_type", "docs")
    .eq("source_id", input.sourceId)
    .maybeSingle();

  if (contentError) {
    throw new GuardrailError({
      code: "DATABASE_ERROR",
      where: WHERE,
      message: "Training progress could not resolve its cataloged documentation lesson.",
      details: contentError.message,
    });
  }
  if (!content || !isTrackableVideoLesson(content)) {
    throw new GuardrailError({
      code: "NOT_FOUND",
      where: WHERE,
      message: "This documentation video is not registered for training progress.",
      status: 404,
    });
  }

  const { data, error } = await createServiceClient().rpc(
    "record_video_learning_progress",
    {
      p_content_item_id: content.id,
      p_learner_id: learnerId,
      p_checkpoint: input.checkpoint,
      p_position_seconds: Math.round(input.positionSeconds),
      p_watched_seconds: Math.round(input.watchedSeconds),
    },
  );
  if (error) {
    throw new GuardrailError({
      code: "DATABASE_ERROR",
      where: WHERE,
      message: "Training progress could not be recorded.",
      details: error.message,
    });
  }

  const result = data?.[0];
  return NextResponse.json({
    schemaVersion: 1,
    accepted: true,
    checkpoint: result?.checkpoint ?? input.checkpoint,
    completed: result?.completed ?? input.checkpoint === 90,
  });
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<Record<string, string>> },
): Promise<Response> {
  const origin = request.headers.get("origin");
  const response = await guardedPost(request, context);
  return isAllowedDocsTrainingOrigin(origin)
    ? addCorsHeaders(response, origin)
    : response;
}

export function OPTIONS(request: NextRequest): Response {
  const origin = request.headers.get("origin");
  if (!isAllowedDocsTrainingOrigin(origin)) {
    return NextResponse.json(
      {
        success: false,
        error_code: "FORBIDDEN",
        error_message:
          "Training progress is accepted only from an approved Alleato documentation origin.",
        where_it_failed: "api.engagement.docs.progress#OPTIONS",
      },
      { status: 403 },
    );
  }
  return addCorsHeaders(new Response(null, { status: 204 }), origin);
}
