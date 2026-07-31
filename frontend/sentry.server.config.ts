import * as Sentry from "@sentry/nextjs";

const SENTRY_DSN = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

function parseSampleRate(value: string | undefined, fallback: number) {
  if (!value) return fallback;

  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1
    ? parsed
    : fallback;
}

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    release: process.env.VERCEL_GIT_COMMIT_SHA,
    sendDefaultPii: process.env.SENTRY_SEND_DEFAULT_PII === "true",
    enableLogs: true,
    // Do NOT let Sentry claim the global OpenTelemetry TracerProvider. Sentry v9
    // grabs it during init(), and OTel allows only one global provider — that
    // pre-empts Langfuse's provider.register() in src/instrumentation.ts, so AI
    // SDK spans never reach the LangfuseSpanProcessor and chat traces silently
    // stop (observed 2026-06-10). With this flag Langfuse owns the global
    // provider for LLM observability; Sentry keeps full error monitoring but not
    // its OTel-based performance tracing. To restore Sentry perf tracing later,
    // install @sentry/opentelemetry and register both Langfuse + Sentry span
    // processors on one shared provider (Langfuse "existing Sentry setup" Option B).
    skipOpenTelemetrySetup: true,
    tracesSampleRate: parseSampleRate(
      process.env.SENTRY_TRACES_SAMPLE_RATE,
      process.env.NODE_ENV === "production" ? 0.1 : 1.0,
    ),
    includeLocalVariables: process.env.SENTRY_INCLUDE_LOCAL_VARIABLES === "true",
    ignoreErrors: ["NEXT_NOT_FOUND", "NEXT_REDIRECT"],
  });
}
