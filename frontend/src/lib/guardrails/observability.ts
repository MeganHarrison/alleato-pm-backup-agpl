import type { AlertSeverity } from "@/lib/guardrails/error-catalog";

type LogLevel = "info" | "warn" | "error";

interface LogPayload {
  event: string;
  level?: LogLevel;
  requestId: string;
  where: string;
  durationMs?: number;
  dependency?: string;
  details?: Record<string, unknown>;
}

interface AlertPayload {
  severity: AlertSeverity;
  requestId: string;
  where: string;
  errorCode: string;
  message: string;
  details?: unknown;
  timestamp: string;
}

const RECENT_ERROR_WINDOW_MS = 5 * 60 * 1000;
const REPEATED_ERROR_THRESHOLD = 3;
const recentErrorEvents = new Map<string, number[]>();

export function generateRequestId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function getOrCreateRequestId(headers?: Headers): string {
  const inbound = headers?.get("x-request-id")?.trim();
  if (inbound) return inbound;
  return generateRequestId();
}

export function logEvent(payload: LogPayload): void {
  const line = {
    timestamp: new Date().toISOString(),
    level: payload.level ?? "info",
    event: payload.event,
    request_id: payload.requestId,
    where: payload.where,
    duration_ms: payload.durationMs,
    dependency: payload.dependency,
    details: payload.details,
  };

  if ((payload.level ?? "info") === "error") {
    console.error(JSON.stringify(line));
    return;
  }
  if ((payload.level ?? "info") === "warn") {
    console.warn(JSON.stringify(line));
    return;
  }
  console.info(JSON.stringify(line));
}

export function shouldAlert(severity: AlertSeverity): boolean {
  return severity === "critical" || severity === "high";
}

function shouldEscalateRepeated(payload: AlertPayload): boolean {
  const key = `${payload.where}::${payload.errorCode}`;
  const now = Date.now();
  const timestamps = recentErrorEvents.get(key) ?? [];
  const pruned = timestamps.filter((ts) => now - ts <= RECENT_ERROR_WINDOW_MS);
  pruned.push(now);
  recentErrorEvents.set(key, pruned);
  return pruned.length >= REPEATED_ERROR_THRESHOLD;
}

export async function notifyOnError(payload: AlertPayload): Promise<void> {
  const alertDueToSeverity = shouldAlert(payload.severity);
  const alertDueToRepetition = shouldEscalateRepeated(payload);

  if (!alertDueToSeverity && !alertDueToRepetition) {
    return;
  }

  const webhook = process.env.ERROR_ALERT_WEBHOOK_URL?.trim();
  if (!webhook) {
    // Webhook not configured — log the suppressed alert so it's visible in server logs.
    logEvent({
      event: "alert_suppressed_no_webhook",
      level: "warn",
      requestId: payload.requestId,
      where: payload.where,
      details: {
        error_code: payload.errorCode,
        severity: payload.severity,
        message: payload.message,
        escalated_by_repetition: alertDueToRepetition,
        fix: "Set ERROR_ALERT_WEBHOOK_URL to enable external alerting",
      },
    });
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5_000);
  try {
    const response = await fetch(webhook, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok) {
      logEvent({
        event: "alert_send_failed",
        level: "warn",
        requestId: payload.requestId,
        where: payload.where,
        details: {
          status: response.status,
          errorCode: payload.errorCode,
          escalated_by_repetition: alertDueToRepetition,
        },
      });
    }
  } catch (error) {
    logEvent({
      event: "alert_send_failed",
      level: "warn",
      requestId: payload.requestId,
      where: payload.where,
      details: {
        reason: error instanceof Error ? error.message : String(error),
        errorCode: payload.errorCode,
        escalated_by_repetition: alertDueToRepetition,
      },
    });
  } finally {
    clearTimeout(timeout);
  }
}
