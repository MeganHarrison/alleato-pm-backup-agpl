type NonCriticalFailureContext = {
  area: string;
  operation: string;
  error: unknown;
  userVisibleFallback: string;
  metadata?: Record<string, string | number | boolean | null | undefined>;
};

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Unknown error";
}

export function reportNonCriticalFailure({
  area,
  operation,
  error,
  userVisibleFallback,
  metadata,
}: NonCriticalFailureContext) {
  const message = errorMessage(error);
  const payload = {
    event: "non_critical_failure",
    timestamp: new Date().toISOString(),
    area,
    operation,
    user_visible_fallback: userVisibleFallback,
    error: message,
    metadata,
  };

  console.warn(JSON.stringify(payload));

  if (typeof window === "undefined") return;

  void import("@/lib/app-error-reporter")
    .then(({ reportBrowserError }) => {
      reportBrowserError({
        source: "client",
        severity: "medium",
        route: window.location.pathname,
        action: `${area}:${operation}`,
        errorCode: "NON_CRITICAL_FAILURE",
        errorMessage: message,
        context: {
          userVisibleFallback,
          metadata,
        },
      });
    })
    .catch(() => {
      console.warn(
        JSON.stringify({
          ...payload,
          event: "non_critical_failure_telemetry_failed",
        }),
      );
    });
}
