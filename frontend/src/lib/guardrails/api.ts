import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getErrorCatalogEntry } from "@/lib/guardrails/error-catalog";
import { asGuardrailError, GuardrailError } from "@/lib/guardrails/errors";
import { validateEnvVars } from "@/lib/guardrails/env";
import { getOrCreateRequestId, logEvent, notifyOnError } from "@/lib/guardrails/observability";
import { recordAppErrorEvent } from "@/lib/app-error-telemetry";
import { getApiRouteUser } from "@/lib/supabase/server";

export interface ErrorEnvelope {
  success: false;
  error_code: string;
  error_message: string;
  where_it_failed: string;
  request_id: string;
  timestamp: string;
  details?: unknown;
}

type UnwrapParams<TParams> = TParams extends Promise<infer TUnwrapped>
  ? TUnwrapped
  : TParams;

type RouteParams = Record<string, string>;

interface HandlerContext<TParams = RouteParams> {
  request: NextRequest;
  params: TParams;
  requestId: string;
}

type WrappedHandler<TParams = RouteParams> = (
  context: HandlerContext<TParams>,
) => Promise<Response>;

let runtimeEnvValidated = false;

function projectIdFromPath(pathname: string): number | null {
  const firstSegment = pathname.split("/").filter(Boolean)[0];
  const parsed = Number.parseInt(firstSegment ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function ensureRuntimeEnv(where: string): void {
  if (runtimeEnvValidated) return;
  validateEnvVars(where, [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  ], {
    urlVars: ["NEXT_PUBLIC_SUPABASE_URL", "BACKEND_URL", "PYTHON_BACKEND_URL"],
  });
  runtimeEnvValidated = true;
}

function errorEnvelopeFrom(
  error: GuardrailError,
  requestId: string,
): ErrorEnvelope {
  return {
    success: false,
    error_code: error.code,
    error_message: error.message,
    where_it_failed: error.where,
    request_id: requestId,
    timestamp: new Date().toISOString(),
    ...(typeof error.details === "undefined" ? {} : { details: error.details }),
  };
}

async function resolveApiRouteUserForTelemetry(): Promise<Awaited<ReturnType<typeof getApiRouteUser>>> {
  if (typeof getApiRouteUser !== "function") {
    return null;
  }

  try {
    return await getApiRouteUser();
  } catch {
    return null;
  }
}

export function withApiGuardrails<TParams = RouteParams>(
  where: string,
  handler: WrappedHandler<UnwrapParams<TParams>>,
) {
  return async (
    request: NextRequest,
    args: { params: Promise<UnwrapParams<TParams>> },
  ): Promise<Response> => {
    const startedAt = Date.now();
    const requestId = getOrCreateRequestId(request.headers);

    try {
      ensureRuntimeEnv(where);

      logEvent({
        event: "api_request_started",
        requestId,
        where,
        details: {
          method: request.method,
          path: request.nextUrl.pathname,
        },
      });

      const response = await handler({
        request,
        params: args?.params
          ? await args.params
          : ({} as UnwrapParams<TParams>),
        requestId,
      });

      const durationMs = Date.now() - startedAt;
      logEvent({
        event: "api_request_succeeded",
        requestId,
        where,
        durationMs,
        details: {
          status: response.status,
        },
      });

      response.headers.set("x-request-id", requestId);
      return response;
    } catch (rawError) {
      const durationMs = Date.now() - startedAt;
      const error = asGuardrailError(rawError, {
        code: "INTERNAL_ERROR",
        where,
      });
      const catalog = getErrorCatalogEntry(error.code);

      logEvent({
        event: "api_request_failed",
        level: "error",
        requestId,
        where,
        durationMs,
        details: {
          error_code: error.code,
          status: error.status,
          reason: error.message,
          retryable: error.safeToRetry,
        },
      });

      // 401/403 are user-state, not application errors — do not pollute telemetry
      const authCodes = new Set(["AUTH_EXPIRED", "UNAUTHORIZED", "AUTH_FORBIDDEN", "FORBIDDEN"]);
      const httpStatus = error.status ?? catalog.httpStatus;
      const isAuthNoise = authCodes.has(error.code) || httpStatus === 401 || httpStatus === 403;

      // 4xx user-error codes are by-design rejections (bad input, not found, conflict) — not application bugs
      const userErrorCodes = new Set([
        "INVALID_PAYLOAD", "INVALID_INPUT", "BAD_REQUEST",
        "VALIDATION_ERROR", "VALIDATION",
        "NOT_FOUND", "ROUTE_BINDING_MISSING",
        "READ_ONLY_RESOURCE", "SUBMITTAL_WORKFLOW_NOT_ASSIGNED", "PRECONDITION_FAILED",
      ]);
      const is4xxUserError = userErrorCodes.has(error.code) && httpStatus >= 400 && httpStatus < 500;

      if (where !== "/api/app-error-events#POST" && !isAuthNoise && !is4xxUserError) {
        const user = await resolveApiRouteUserForTelemetry();
        await recordAppErrorEvent({
          source: "api",
          severity: error.severity ?? catalog.alertSeverity,
          userId: user?.id ?? null,
          projectId: projectIdFromPath(request.nextUrl.pathname),
          pageUrl: request.url,
          pagePath: request.nextUrl.pathname,
          route: request.nextUrl.pathname,
          action: `${request.method} ${where}`,
          errorCode: error.code,
          errorMessage: error.message,
          stack: rawError instanceof Error ? rawError.stack : undefined,
          requestId,
          statusCode: error.status ?? catalog.httpStatus,
          userAgent: request.headers.get("user-agent"),
          releaseSha: process.env.VERCEL_GIT_COMMIT_SHA,
          context: {
            where,
            retryable: error.safeToRetry,
            details: error.details,
          },
        });
      }

      await notifyOnError({
        severity: error.severity ?? catalog.alertSeverity,
        requestId,
        where,
        errorCode: error.code,
        message: error.message,
        details: error.details,
        timestamp: new Date().toISOString(),
      });

      const envelope = errorEnvelopeFrom(error, requestId);
      return NextResponse.json(envelope, {
        status: error.status ?? catalog.httpStatus,
        headers: {
          "x-request-id": requestId,
        },
      });
    }
  };
}

export async function parseJsonBody<T>(
  request: Request,
  schema: z.ZodType<T>,
  where: string,
): Promise<T> {
  const body = await request.json().catch(() => {
    throw new GuardrailError({
      code: "INVALID_PAYLOAD",
      where,
      message: "Malformed JSON payload.",
    });
  });

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new GuardrailError({
      code: "INVALID_PAYLOAD",
      where,
      details: parsed.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
  }
  return parsed.data;
}

export function validateResponseContract<T>(
  schema: z.ZodType<T>,
  data: unknown,
  where: string,
): T {
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    throw new GuardrailError({
      code: "SCHEMA_MISMATCH",
      where,
      details: parsed.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
  }
  return parsed.data;
}
