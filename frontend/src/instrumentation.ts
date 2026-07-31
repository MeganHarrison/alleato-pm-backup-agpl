/**
 * Next.js 15 instrumentation hook — runs once at server startup.
 *
 * Validates required env vars at boot so a misconfigured deployment fails fast
 * rather than crashing on the first user-facing request. Also warns if the
 * alert webhook is absent in deployed runtimes so operators know alerts are
 * suppressed. Local development intentionally stays quiet unless an alertable
 * error actually occurs.
 *
 * Sentry is only initialized when NEXT_PUBLIC_SENTRY_DSN (or SENTRY_DSN) is set,
 * so dev environments without the env var are completely unaffected.
 *
 * Phoenix tracing: set PHOENIX_TRACING=true in .env.local, then run:
 *   pip install arize-phoenix && python -m phoenix.server.main
 *   open http://localhost:6006
 */

import * as Sentry from "@sentry/nextjs";

const sentryDsnPresent = Boolean(
  process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN,
);

const langfuseConfigured = Boolean(
  process.env.LANGFUSE_PUBLIC_KEY?.trim() &&
    process.env.LANGFUSE_SECRET_KEY?.trim(),
);

// Holds the live Langfuse span processor once register() wires it up so route
// handlers can force a flush before the serverless function suspends. ES module
// live bindings mean importers observe this assignment after startup.
let langfuseSpanProcessor: { forceFlush: () => Promise<void> } | null = null;

/**
 * Flush any buffered Langfuse spans. Call from `after()` in AI route handlers
 * so traces are not lost when the serverless function suspends. No-ops when
 * Langfuse is not configured.
 */
export async function flushLangfuse(): Promise<void> {
  if (!langfuseSpanProcessor) return;
  await langfuseSpanProcessor.forceFlush();
}

export async function register() {
  if (sentryDsnPresent && process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  }

  if (sentryDsnPresent && process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }

  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Langfuse takes precedence over Phoenix: both register a global OTel tracer
    // provider, and only one can win. Langfuse is the production observability
    // path; Phoenix stays a local-only opt-in fallback.
    if (langfuseConfigured) {
      const { LangfuseSpanProcessor } = await import("@langfuse/otel");
      const { NodeTracerProvider } = await import(
        "@opentelemetry/sdk-trace-node"
      );
      const { maskLangfuse } = await import("./lib/ai/langfuse-mask");

      // baseUrl MUST be passed explicitly. @langfuse/otel resolves it from
      // LANGFUSE_BASE_URL / LANGFUSE_BASEURL only — it does NOT read LANGFUSE_HOST
      // (which is the var actually set in our env) and otherwise defaults to the
      // EU endpoint https://cloud.langfuse.com. Our project is on US cloud, so
      // without this every OTel span was POSTed to the wrong region and silently
      // dropped — the real reason chat traces vanished on 2026-06-10 when the
      // handler moved to the AI SDK telemetry/OTel path.
      const langfuseBaseUrl =
        process.env.LANGFUSE_BASE_URL?.trim() ||
        process.env.LANGFUSE_HOST?.trim() ||
        "https://us.cloud.langfuse.com";

      // Redact PII (emails / SSN / card / phone) before egress to us.cloud.
      //
      // exportMode "immediate" (SimpleSpanProcessor) is REQUIRED on Vercel's
      // serverless/Fluid Compute: the default BatchSpanProcessor buffers spans
      // and the function can freeze after the response before the batch's timer
      // fires, dropping every span. Immediate mode POSTs each span as it ends,
      // while the request is still alive. This is why traces appeared locally
      // (long-lived dev process) but not in prod until now.
      // Ref: https://langfuse.com/faq/all/existing-sentry-setup (AWS Lambda note)
      const processor = new LangfuseSpanProcessor({
        baseUrl: langfuseBaseUrl,
        publicKey: process.env.LANGFUSE_PUBLIC_KEY,
        secretKey: process.env.LANGFUSE_SECRET_KEY,
        exportMode: "immediate",
        mask: maskLangfuse,
      });
      langfuseSpanProcessor = processor;

      // Langfuse owns the GLOBAL OTel provider. `provider.register()` installs
      // both the tracer provider AND a context manager (AsyncHooksContextManager),
      // so startActiveObservation/getActiveTraceId track an active span and the
      // AI SDK's `ai`-scope spans flow through LangfuseSpanProcessor.
      //
      // This requires Sentry NOT to claim the global provider first: Sentry v9
      // grabs the global TracerProvider during Sentry.init() unless
      // `skipOpenTelemetrySetup: true` is set (see sentry.server.config.ts). With
      // that flag, Sentry keeps full error monitoring (no OTel perf tracing) and
      // Langfuse gets the global provider here — the mechanism that worked before
      // Sentry's DSN was added, now restored.
      //
      // An isolated provider via setLangfuseTracerProvider() was tried and
      // FAILED: it sets the tracer but installs no context manager, so
      // startActiveObservation never established an active span ("No active OTEL
      // span in context") and zero traces exported. Do not reintroduce it.
      // Ref: https://langfuse.com/faq/all/existing-sentry-setup (Option A)
      const provider = new NodeTracerProvider({
        spanProcessors: [processor],
      });
      provider.register();

      console.log(
        "[instrumentation] Langfuse tracing enabled (global provider) → " +
          langfuseBaseUrl,
      );
    } else if (process.env.PHOENIX_TRACING === "true") {
      const { NodeSDK } = await import("@opentelemetry/sdk-node");
      const { OTLPTraceExporter } = await import(
        "@opentelemetry/exporter-trace-otlp-http"
      );
      const { OpenAIInstrumentation } = await import(
        "@arizeai/openinference-instrumentation-openai"
      );

      const sdk = new NodeSDK({
        traceExporter: new OTLPTraceExporter({
          url:
            process.env.PHOENIX_ENDPOINT ??
            "http://localhost:4318/v1/traces",
        }),
        instrumentations: [new OpenAIInstrumentation({})],
      });

      sdk.start();
      console.log(
        "[instrumentation] Phoenix tracing enabled → http://localhost:6006",
      );
    }

    const { validateEnvVars } = await import("@/lib/guardrails/env");

    validateEnvVars("instrumentation/startup", [
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      "SUPABASE_SERVICE_ROLE_KEY",
    ]);

    const shouldWarnForMissingAlertWebhook =
      process.env.NODE_ENV !== "development" ||
      process.env.VERCEL_ENV === "preview";

    if (
      shouldWarnForMissingAlertWebhook &&
      !process.env.ERROR_ALERT_WEBHOOK_URL?.trim()
    ) {
      console.warn(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          level: "warn",
          event: "startup_config_warning",
          where: "instrumentation/startup",
          message:
            "ERROR_ALERT_WEBHOOK_URL is not set. Critical/high-severity errors will be logged but not alerted externally. Set this env var to enable webhook alerting.",
        }),
      );
    }
  }
}

// Capture errors from Server Components, middleware, and route handlers.
// Sentry no-ops when the SDK was not initialized because no DSN is configured.
export const onRequestError = Sentry.captureRequestError;
