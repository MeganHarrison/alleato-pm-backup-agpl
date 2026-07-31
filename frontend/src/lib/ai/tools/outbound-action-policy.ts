import type { Tool, ToolSet } from "ai";
import type { ToolTracePayload } from "./tool-utils";

type ToolContext = Record<string, unknown>;

const OUTBOUND_ACTION_POLICY_FLAG = "ALLEATO_OUTBOUND_ACTION_POLICY_ENABLED";

const SECRET_KEY_PATTERN = /(api[_-]?key|token|secret|password|authorization|bearer|cookie|set-cookie|client[_-]?secret|refresh[_-]?token|access[_-]?token|signature|webhook[_-]?secret|dsn)/i;
const SECRET_VALUE_PATTERN = /(sk-[A-Za-z0-9_-]{12,}|xox[baprs]-[A-Za-z0-9-]{12,}|gh[pousr]_[A-Za-z0-9_]{12,}|Bearer\s+[A-Za-z0-9._~+\/-]+=*)/g;

export type OutboundActionPolicyDecision =
  | { allowed: true; mode: "confirmed-write" | "draft-only" | "read"; reason: string }
  | { allowed: false; mode: "denied"; reason: OutboundActionDenialReason; message: string };

export type OutboundActionDenialReason =
  | "UNCONFIRMED_WRITE_DENIED"
  | "MISSING_CONFIRMATION_FIELD"
  | "REDACTION_FAILED"
  | "TOOL_EXECUTION_MISSING";

export type OutboundActionDeniedResult = {
  __toolDenied: true;
  reason: OutboundActionDenialReason;
  message: string;
  toolName: string;
  policy: "outbound-action-policy";
};

export type OutboundActionRedactionFailureResult = {
  __toolError: true;
  source: string;
  message: string;
  guidance: string;
  policy: "outbound-action-policy";
};

export type OutboundActionPolicyHooks = {
  beforeToolCall: (call: { toolName: string; input: Record<string, unknown> }) => OutboundActionPolicyDecision;
  afterToolCall: (call: { toolName: string; input: Record<string, unknown>; output: unknown; decision: OutboundActionPolicyDecision }) => unknown;
};

export type OutboundActionPolicyOptions = {
  enabled?: boolean;
  onTrace?: (trace: ToolTracePayload) => void;
  writeToolNames?: Iterable<string>;
};

export function isOutboundActionPolicyEnabled(): boolean {
  return process.env[OUTBOUND_ACTION_POLICY_FLAG] === "1" || process.env[OUTBOUND_ACTION_POLICY_FLAG] === "true";
}

export function createDeniedToolResult(toolName: string, reason: OutboundActionDenialReason, message: string): OutboundActionDeniedResult {
  return { __toolDenied: true, reason, message, toolName, policy: "outbound-action-policy" };
}

function isDeniedDecision(
  decision: OutboundActionPolicyDecision,
): decision is Extract<OutboundActionPolicyDecision, { allowed: false }> {
  return decision.allowed === false;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isDraftLikeResult(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const status = typeof value.status === "string" ? value.status.toLowerCase() : "";
  const type = typeof value.type === "string" ? value.type.toLowerCase() : "";
  return status === "draft" || status === "preview" || status === "blocked" || type.includes("preview") || type.includes("draft");
}

export function redactToolOutput(output: unknown): unknown {
  const seen = new WeakSet<object>();
  const visit = (value: unknown): unknown => {
    if (typeof value === "string") return value.replace(SECRET_VALUE_PATTERN, "[REDACTED]");
    if (value == null || typeof value !== "object") return value;
    if (seen.has(value)) throw new Error("Cannot redact circular tool output.");
    seen.add(value);
    if (Array.isArray(value)) return value.map(visit);
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, nested]) => [
        key,
        SECRET_KEY_PATTERN.test(key) ? "[REDACTED]" : visit(nested),
      ]),
    );
  };
  return visit(output);
}

export function createOutboundActionPolicy(writeToolNames: Iterable<string>): OutboundActionPolicyHooks {
  const writes = new Set(writeToolNames);
  return {
    beforeToolCall({ toolName, input }) {
      if (!writes.has(toolName)) return { allowed: true, mode: "read", reason: "Tool is not registered as an outbound write." };
      if (!Object.prototype.hasOwnProperty.call(input, "confirmed")) {
        return {
          allowed: false,
          mode: "denied",
          reason: "MISSING_CONFIRMATION_FIELD",
          message: `Outbound write tool ${toolName} is missing the confirmed field required by policy.`,
        };
      }
      return input.confirmed === true
        ? { allowed: true, mode: "confirmed-write", reason: "User confirmation was provided." }
        : { allowed: true, mode: "draft-only", reason: "No user confirmation; execution is limited to draft/preview output." };
    },
    afterToolCall({ toolName, output, decision }) {
      const redacted = redactToolOutput(output);
      if (decision.allowed && decision.mode === "draft-only" && !isDraftLikeResult(redacted)) {
        return createDeniedToolResult(
          toolName,
          "UNCONFIRMED_WRITE_DENIED",
          `Outbound write tool ${toolName} was not confirmed and did not return a draft/preview result.`,
        );
      }
      return redacted;
    },
  };
}

function redactionFailure(toolName: string): OutboundActionRedactionFailureResult {
  return {
    __toolError: true,
    source: toolName,
    message: `Outbound action policy failed to redact output for ${toolName}.`,
    guidance: "The tool result was withheld safely. Retry after removing circular or non-serializable secret-bearing output.",
    policy: "outbound-action-policy",
  };
}

export function wrapToolSetWithOutboundActionPolicy<TTools extends ToolSet>(tools: TTools, options: OutboundActionPolicyOptions = {}): TTools {
  const enabled = options.enabled ?? isOutboundActionPolicyEnabled();
  if (!enabled) return tools;

  const policy = createOutboundActionPolicy(options.writeToolNames ?? Object.keys(tools));
  const wrapped = Object.fromEntries(
    Object.entries(tools).map(([toolName, definition]) => {
      const execute = definition.execute;
      if (!execute) return [toolName, definition];
      type ExecuteInput = Parameters<NonNullable<typeof execute>>[0];
      type ExecuteOptions = Parameters<NonNullable<typeof execute>>[1];
      const wrappedExecute = async (
        input: ExecuteInput,
        executionOptions?: ExecuteOptions,
      ) => {
        const decision = policy.beforeToolCall({ toolName, input });
        if (isDeniedDecision(decision)) {
          const denied = createDeniedToolResult(toolName, decision.reason, decision.message);
          options.onTrace?.({ tool: toolName, input, output: denied, timestamp: new Date().toISOString() });
          return denied;
        }
        const output = await execute(input, executionOptions as ExecuteOptions);
        const safeOutput = (() => {
          try {
            return policy.afterToolCall({ toolName, input, output, decision });
          } catch {
            return redactionFailure(toolName);
          }
        })();
        if ((safeOutput as OutboundActionDeniedResult).__toolDenied || (safeOutput as OutboundActionRedactionFailureResult).__toolError) {
          options.onTrace?.({ tool: toolName, input, output: safeOutput, timestamp: new Date().toISOString() });
        }
        return safeOutput;
      };
      return [
        toolName,
        {
          ...(definition as Tool<
            Record<string, unknown>,
            unknown,
            ToolContext
          >),
          execute: wrappedExecute,
        },
      ];
    }),
  );
  return wrapped as TTools;
}

export function safeRedactToolTrace(trace: ToolTracePayload): ToolTracePayload | OutboundActionRedactionFailureResult {
  try {
    return { ...trace, output: trace.output === undefined ? undefined : redactToolOutput(trace.output) };
  } catch {
    return redactionFailure(trace.tool);
  }
}
