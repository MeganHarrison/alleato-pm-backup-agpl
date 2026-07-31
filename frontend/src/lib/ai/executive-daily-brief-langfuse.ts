import {
  getActiveTraceId,
  propagateAttributes,
  startActiveObservation,
  updateActiveObservation,
  type LangfuseObservationType,
  type LangfuseSpanAttributes,
} from "@langfuse/tracing";

import {
  EXECUTIVE_DAILY_BRIEF_WORKFLOW_ID,
  EXECUTIVE_DAILY_BRIEF_WORKFLOW_VERSION,
} from "@/lib/ai-ops/executive-daily-brief-workflow";
import { langfuseConfigured } from "@/lib/ai/ai-telemetry";

type MetadataValue = string | number | boolean | null | undefined;
type Metadata = Record<string, MetadataValue>;
type ActiveObservationType = Exclude<LangfuseObservationType, "event">;

type TraceContext = {
  configured: boolean;
  traceId?: string;
};

type UpdatableObservation = {
  traceId: string;
  update(attributes: LangfuseSpanAttributes): unknown;
};

type ObservationOptions = {
  type?: ActiveObservationType;
  input?: unknown;
  metadata?: Metadata;
  output?: (result: unknown) => unknown;
};

const MAX_PROPAGATED_VALUE_LENGTH = 200;

function cleanMetadata(metadata: Metadata | undefined): Metadata {
  const output: Metadata = {};
  for (const [key, value] of Object.entries(metadata ?? {})) {
    if (value === undefined) continue;
    output[key] = value;
  }
  return output;
}

function propagatedMetadata(
  metadata: Metadata | undefined,
): Record<string, string> {
  const cleaned = cleanMetadata(metadata);
  const output: Record<string, string> = {};
  for (const [key, value] of Object.entries(cleaned)) {
    output[key] = String(value).slice(0, MAX_PROPAGATED_VALUE_LENGTH);
  }
  return output;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function failureOutput(error: unknown) {
  return {
    ok: false,
    error: errorMessage(error).slice(0, 800),
  };
}

function startTypedActiveObservation<T>(
  name: string,
  type: ActiveObservationType,
  fn: (observation: UpdatableObservation) => Promise<T>,
): Promise<T> {
  switch (type) {
    case "agent":
      return startActiveObservation(name, fn, { asType: "agent" });
    case "tool":
      return startActiveObservation(name, fn, { asType: "tool" });
    case "chain":
      return startActiveObservation(name, fn, { asType: "chain" });
    case "retriever":
      return startActiveObservation(name, fn, { asType: "retriever" });
    case "evaluator":
      return startActiveObservation(name, fn, { asType: "evaluator" });
    case "guardrail":
      return startActiveObservation(name, fn, { asType: "guardrail" });
    case "generation":
      return startActiveObservation(name, fn, { asType: "generation" });
    case "embedding":
      return startActiveObservation(name, fn, { asType: "embedding" });
    case "span":
      return startActiveObservation(name, fn, { asType: "span" });
  }
}

export function executiveDailyBriefTraceMetadata(
  metadata: Metadata = {},
): Metadata {
  return cleanMetadata({
    workflowId: EXECUTIVE_DAILY_BRIEF_WORKFLOW_ID,
    workflowVersion: EXECUTIVE_DAILY_BRIEF_WORKFLOW_VERSION,
    surface: "executive_daily_brief",
    ...metadata,
  });
}

export function currentExecutiveDailyBriefTraceId(): string | undefined {
  if (!langfuseConfigured()) return undefined;
  return getActiveTraceId();
}

export async function withExecutiveDailyBriefTrace<T>(
  input: {
    name: string;
    sessionId: string;
    triggerType: string;
    userId?: string;
    metadata?: Metadata;
    input?: unknown;
    tags?: string[];
  },
  fn: (context: TraceContext) => Promise<T>,
): Promise<T> {
  const metadata = executiveDailyBriefTraceMetadata({
    triggerType: input.triggerType,
    ...(input.metadata ?? {}),
  });

  if (!langfuseConfigured()) {
    return fn({ configured: false });
  }

  return startActiveObservation(
    input.name,
    async (observation) =>
      propagateAttributes(
        {
          traceName: input.name,
          userId: input.userId ?? "system",
          sessionId: input.sessionId,
          version: EXECUTIVE_DAILY_BRIEF_WORKFLOW_VERSION,
          tags: [
            "executive_daily_brief",
            `trigger:${input.triggerType}`,
            ...(input.tags ?? []),
          ],
          metadata: propagatedMetadata(metadata),
        },
        async () => {
          observation.update({
            input: input.input,
            metadata,
          });
          try {
            const result = await fn({
              configured: true,
              traceId: observation.traceId,
            });
            observation.update({
              output: { ok: true },
              metadata: {
                ...metadata,
                traceId: observation.traceId,
              },
            });
            return result;
          } catch (error) {
            observation.update({
              level: "ERROR",
              statusMessage: errorMessage(error),
              output: failureOutput(error),
              metadata,
            });
            throw error;
          }
        },
      ),
    { asType: "agent" },
  );
}

export async function withExecutiveDailyBriefObservation<T>(
  name: string,
  options: ObservationOptions,
  fn: () => Promise<T>,
): Promise<T> {
  if (!langfuseConfigured()) return fn();

  return startTypedActiveObservation(
    name,
    options.type ?? "span",
    async (observation) => {
      const metadata = executiveDailyBriefTraceMetadata(options.metadata);
      observation.update({
        input: options.input,
        metadata,
      } satisfies LangfuseSpanAttributes);
      try {
        const result = await fn();
        observation.update({
          output: options.output ? options.output(result) : { ok: true },
          metadata,
        });
        return result;
      } catch (error) {
        observation.update({
          level: "ERROR",
          statusMessage: errorMessage(error),
          output: failureOutput(error),
          metadata,
        });
        throw error;
      }
    },
  );
}

export function updateExecutiveDailyBriefObservation(input: {
  output?: unknown;
  metadata?: Metadata;
  level?: "DEBUG" | "DEFAULT" | "WARNING" | "ERROR";
  statusMessage?: string;
}) {
  if (!langfuseConfigured()) return;
  updateActiveObservation({
    output: input.output,
    metadata: executiveDailyBriefTraceMetadata(input.metadata),
    level: input.level,
    statusMessage: input.statusMessage,
  });
}
