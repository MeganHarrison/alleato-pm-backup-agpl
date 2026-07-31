"use client";

import type { AppErrorSeverity, AppErrorSource } from "@/lib/app-error-telemetry";

interface BrowserErrorReport {
  source?: AppErrorSource;
  severity?: AppErrorSeverity;
  projectId?: number | null;
  route?: string | null;
  action?: string | null;
  errorCode?: string | null;
  errorMessage: string;
  stack?: string | null;
  componentStack?: string | null;
  requestId?: string | null;
  statusCode?: number | null;
  context?: Record<string, unknown>;
}

const REPORT_ENDPOINT = "/api/app-error-events";
const RECENT_WINDOW_MS = 30_000;
const recentReports = new Map<string, number>();

function currentProjectId(): number | null {
  if (typeof window === "undefined") return null;
  const firstSegment = window.location.pathname.split("/").filter(Boolean)[0];
  const parsed = Number.parseInt(firstSegment ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function stableFingerprint(report: BrowserErrorReport): string {
  const pagePath = typeof window === "undefined" ? "" : window.location.pathname;
  return [
    report.source ?? "client",
    report.errorCode ?? "",
    report.route ?? pagePath,
    report.action ?? "",
    report.statusCode ?? "",
    report.errorMessage.slice(0, 300),
    report.stack?.split("\n").slice(0, 3).join("\n") ?? "",
  ].join("|");
}

function shouldSkipDuplicate(fingerprint: string): boolean {
  const now = Date.now();
  const lastSeen = recentReports.get(fingerprint);
  recentReports.set(fingerprint, now);

  for (const [key, seenAt] of recentReports.entries()) {
    if (now - seenAt > RECENT_WINDOW_MS) {
      recentReports.delete(key);
    }
  }

  return typeof lastSeen === "number" && now - lastSeen < RECENT_WINDOW_MS;
}

function sendReport(payload: Record<string, unknown>): void {
  const body = JSON.stringify(payload);

  try {
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const sent = navigator.sendBeacon(
        REPORT_ENDPOINT,
        new Blob([body], { type: "application/json" }),
      );
      if (sent) return;
    }
  } catch (error) {
    console.warn(JSON.stringify({
      event: "app_error_send_beacon_failed",
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error),
    }));
  }

  fetch(REPORT_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    credentials: "same-origin",
    keepalive: true,
  }).catch((error) => {
    console.warn(JSON.stringify({
      event: "app_error_fetch_report_failed",
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error),
    }));
  });
}

export function reportBrowserError(report: BrowserErrorReport): void {
  if (typeof window === "undefined") return;

  const fingerprint = stableFingerprint(report);
  if (shouldSkipDuplicate(fingerprint)) return;

  sendReport({
    source: report.source ?? "client",
    severity: report.severity ?? "medium",
    projectId: report.projectId ?? currentProjectId(),
    pageUrl: window.location.href,
    pagePath: window.location.pathname,
    route: report.route ?? window.location.pathname,
    action: report.action ?? "browser_error",
    errorCode: report.errorCode,
    errorMessage: report.errorMessage,
    stack: report.stack,
    componentStack: report.componentStack,
    requestId: report.requestId,
    statusCode: report.statusCode,
    userAgent: navigator.userAgent,
    appVersion: process.env.NEXT_PUBLIC_APP_VERSION,
    releaseSha: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,
    fingerprint,
    browserMetadata: {
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
      language: navigator.language,
      online: navigator.onLine,
    },
    context: report.context ?? {},
  });
}

export function reportErrorObject(
  error: Error & { digest?: string },
  options?: Omit<BrowserErrorReport, "errorMessage" | "stack">,
): void {
  reportBrowserError({
    ...options,
    errorMessage: error.message || "Unhandled browser error",
    stack: error.stack,
    errorCode: options?.errorCode ?? error.digest ?? error.name,
    context: {
      ...options?.context,
      digest: error.digest,
      name: error.name,
    },
  });
}

export function installGlobalErrorReporter(): () => void {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const handleError = (event: ErrorEvent) => {
    const error = event.error instanceof Error ? event.error : null;
    reportBrowserError({
      severity: "high",
      action: "window_error",
      errorCode: error?.name ?? "WINDOW_ERROR",
      errorMessage: error?.message || event.message || "Unhandled window error",
      stack: error?.stack,
      context: {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      },
    });
  };

  const handleRejection = (event: PromiseRejectionEvent) => {
    const reason = event.reason;
    const error = reason instanceof Error ? reason : null;
    reportBrowserError({
      severity: "high",
      action: "unhandledrejection",
      errorCode: error?.name ?? "UNHANDLED_REJECTION",
      errorMessage: error?.message || String(reason || "Unhandled promise rejection"),
      stack: error?.stack,
    });
  };

  window.addEventListener("error", handleError);
  window.addEventListener("unhandledrejection", handleRejection);

  return () => {
    window.removeEventListener("error", handleError);
    window.removeEventListener("unhandledrejection", handleRejection);
  };
}
