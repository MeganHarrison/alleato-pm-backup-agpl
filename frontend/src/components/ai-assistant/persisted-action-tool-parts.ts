import { hasAssistantDynamicToolComponent } from "./assistant-widget-renderer";
import type { ToolTraceItem } from "./trace-panel";

export interface PersistedActionToolPart {
  type: string;
  toolCallId: string;
  input: unknown;
  state: string;
  output?: unknown;
  errorText?: string;
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function getPersistedActionToolParts(
  traces: ToolTraceItem[],
): PersistedActionToolPart[] {
  return traces.reduce<PersistedActionToolPart[]>((parts, trace, index) => {
    const toolName =
      typeof trace.tool === "string" && trace.tool.trim()
        ? trace.tool.trim()
        : null;
    if (!toolName) return parts;

    const output = asObject(trace.output);
    if (Object.keys(output).length === 0) return parts;
    const persistedPart: PersistedActionToolPart = {
      type: `tool-${toolName}`,
      toolCallId: `persisted-${toolName}-${trace.timestamp ?? index}`,
      input: trace.input ?? {},
      state: output.error ? "output-error" : "output-available",
      output,
      errorText: typeof output.error === "string" ? output.error : undefined,
    };
    // Dynamic tool widgets otherwise vanish after conversation reload because
    // AI SDK tool parts are streamed but only the normalized trace is stored.
    // Rehydrate only tools with a registered renderer; unknown write traces
    // stay in the trace menu instead of becoming generic UI noise.
    if (!hasAssistantDynamicToolComponent(persistedPart)) return parts;

    parts.push(persistedPart);
    return parts;
  }, []);
}
