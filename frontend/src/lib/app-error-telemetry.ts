import { createServiceClient } from "@/lib/supabase/service";
import type { Database } from "@/types/database.types";

type Json = Database["public"]["Tables"]["admin_feedback_items"]["Row"]["metadata"];

export type AppErrorSource =
  | "client"
  | "api"
  | "server"
  | "background"
  | "sync"
  | "ai_tool";

export type AppErrorSeverity = "critical" | "high" | "medium" | "low";

export interface AppErrorTelemetryInput {
  source: AppErrorSource;
  severity?: AppErrorSeverity;
  userId?: string | null;
  projectId?: number | null;
  pageUrl?: string | null;
  pagePath?: string | null;
  route?: string | null;
  action?: string | null;
  errorCode?: string | null;
  errorMessage: string;
  stack?: string | null;
  componentStack?: string | null;
  requestId?: string | null;
  statusCode?: number | null;
  userAgent?: string | null;
  appVersion?: string | null;
  releaseSha?: string | null;
  fingerprint?: string | null;
  browserMetadata?: Record<string, unknown>;
  context?: Record<string, unknown>;
}

type TelemetryPayload = {
  source: AppErrorSource;
  severity: AppErrorSeverity;
  user_id?: string;
  project_id?: number;
  page_url?: string;
  page_path?: string;
  route?: string;
  action?: string;
  error_code?: string;
  error_message: string;
  stack?: string;
  component_stack?: string;
  request_id?: string;
  status_code?: number;
  user_agent?: string;
  app_version?: string;
  release_sha?: string;
  fingerprint?: string;
  browser_metadata?: Json;
  context?: Json;
};

const MAX_MESSAGE_LENGTH = 2_000;
const MAX_STACK_LENGTH = 8_000;
const MAX_CONTEXT_STRING_LENGTH = 2_000;

function trimText(value: string | null | undefined, maxLength: number): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  return trimmed.length > maxLength ? trimmed.slice(0, maxLength) : trimmed;
}

function sanitizeJson(value: unknown): Json {
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    if (typeof value === "string" && value.length > MAX_CONTEXT_STRING_LENGTH) {
      return value.slice(0, MAX_CONTEXT_STRING_LENGTH);
    }
    return value;
  }

  if (Array.isArray(value)) {
    return value.slice(0, 50).map((item) => sanitizeJson(item));
  }

  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value)
        .slice(0, 50)
        .map(([key, item]) => [key, sanitizeJson(item)]),
    );
  }

  if (typeof value === "undefined") {
    return null;
  }

  return String(value).slice(0, MAX_CONTEXT_STRING_LENGTH);
}

function buildPayload(input: AppErrorTelemetryInput): TelemetryPayload {
  return {
    source: input.source,
    severity: input.severity ?? "medium",
    ...(trimText(input.userId, 200) ? { user_id: trimText(input.userId, 200) } : {}),
    ...(typeof input.projectId === "number" ? { project_id: input.projectId } : {}),
    ...(trimText(input.pageUrl, 1000) ? { page_url: trimText(input.pageUrl, 1000) } : {}),
    ...(trimText(input.pagePath, 500) ? { page_path: trimText(input.pagePath, 500) } : {}),
    ...(trimText(input.route, 500) ? { route: trimText(input.route, 500) } : {}),
    ...(trimText(input.action, 300) ? { action: trimText(input.action, 300) } : {}),
    ...(trimText(input.errorCode, 120) ? { error_code: trimText(input.errorCode, 120) } : {}),
    error_message:
      trimText(input.errorMessage, MAX_MESSAGE_LENGTH) ?? "Unknown application error",
    ...(trimText(input.stack, MAX_STACK_LENGTH) ? { stack: trimText(input.stack, MAX_STACK_LENGTH) } : {}),
    ...(trimText(input.componentStack, MAX_STACK_LENGTH)
      ? { component_stack: trimText(input.componentStack, MAX_STACK_LENGTH) }
      : {}),
    ...(trimText(input.requestId, 200) ? { request_id: trimText(input.requestId, 200) } : {}),
    ...(typeof input.statusCode === "number" ? { status_code: input.statusCode } : {}),
    ...(trimText(input.userAgent, 1000) ? { user_agent: trimText(input.userAgent, 1000) } : {}),
    ...(trimText(input.appVersion, 120) ? { app_version: trimText(input.appVersion, 120) } : {}),
    ...(trimText(input.releaseSha, 120) ? { release_sha: trimText(input.releaseSha, 120) } : {}),
    ...(trimText(input.fingerprint, 500) ? { fingerprint: trimText(input.fingerprint, 500) } : {}),
    browser_metadata: sanitizeJson(input.browserMetadata ?? {}) as Json,
    context: sanitizeJson(input.context ?? {}) as Json,
  };
}

export async function recordAppErrorEvent(
  input: AppErrorTelemetryInput,
): Promise<{ eventId: string | null; error: string | null }> {
  try {
    const supabase = createServiceClient();
    const payload = buildPayload(input);
    const { data, error } = await supabase.rpc("record_app_error_event", {
      payload,
    });

    if (error) {
      console.warn(
        JSON.stringify({
          event: "app_error_telemetry_write_failed",
          reason: error.message,
          route: input.route,
          action: input.action,
        }),
      );
      return { eventId: null, error: error.message };
    }

    return { eventId: typeof data === "string" ? data : null, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(
      JSON.stringify({
        event: "app_error_telemetry_write_failed",
        reason: message,
        route: input.route,
        action: input.action,
      }),
    );
    return { eventId: null, error: message };
  }
}
