/**
 * Single source of truth for Vercel AI SDK telemetry.
 *
 * The Langfuse OTel span processor is registered in `src/instrumentation.ts`.
 * When Langfuse is configured (or Phoenix is opted in for local dev), AI SDK
 * spans — model name, token usage, tool calls, and span hierarchy — are exported
 * automatically. Pass the object returned by `aiTelemetry()` as the
 * `telemetry` option on `streamText` / `generateText` / `generateObject`.
 *
 * Why a helper: telemetry enablement was previously gated only on
 * `PHOENIX_TRACING`, so the installed `@langfuse/otel` packages emitted nothing
 * to Langfuse. Centralizing the gate means every call site lights up together
 * and there is one place to evolve the policy.
 */

export function langfuseConfigured(): boolean {
  return Boolean(
    process.env.LANGFUSE_PUBLIC_KEY?.trim() &&
      process.env.LANGFUSE_SECRET_KEY?.trim(),
  );
}

export function aiTelemetryEnabled(): boolean {
  return langfuseConfigured() || process.env.PHOENIX_TRACING === "true";
}

type AiTelemetryOptions = {
  /** Stable identifier for this generation, e.g. "intent-planner". */
  functionId: string;
  /** Non-sensitive business context attached to the span. */
  metadata?: Record<string, string | number | boolean>;
};

/**
 * Build the `telemetry` config for an AI SDK call.
 *
 * `recordInputs`/`recordOutputs` default to enabled so prompts and completions
 * appear in Langfuse. Pass only non-sensitive metadata — anything in `metadata`
 * is shipped to the tracing backend.
 */
export function aiTelemetry({ functionId, metadata }: AiTelemetryOptions) {
  return {
    isEnabled: aiTelemetryEnabled(),
    functionId,
    recordInputs: true,
    recordOutputs: true,
    ...(metadata ? { metadata } : {}),
  };
}
