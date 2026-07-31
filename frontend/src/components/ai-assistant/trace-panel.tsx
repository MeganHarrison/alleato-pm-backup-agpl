"use client";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { ChevronDownIcon, ArrowRightIcon } from "lucide-react";

export interface ToolTraceItem {
  tool?: string;
  input?: Record<string, unknown>;
  output?: unknown;
  error?: string;
  timestamp?: string;
}

export interface AssistantTraceDiagnostics {
  providerPath?: string | null;
  model?: string | null;
  providerDecision?: Record<string, unknown> | null;
  loopDiagnostic?: Record<string, unknown> | null;
}

function toPrettyJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function truncate(text: string, max = 600): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}...`;
}

function toStringValue(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  return null;
}

function getRecordValue(
  value: Record<string, unknown> | null | undefined,
  key: string,
): unknown {
  return value ? value[key] : undefined;
}

function toRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function inferIntent(traces: ToolTraceItem[]): string | null {
  for (const trace of traces) {
    const intent = toStringValue(trace.input?.intent);
    if (intent) return intent;
    if (trace.output && typeof trace.output === "object") {
      const outputIntent = toStringValue(
        (trace.output as Record<string, unknown>).intent,
      );
      if (outputIntent) return outputIntent;
    }
  }
  return null;
}

function getExcalidrawMcpSummary(traces: ToolTraceItem[]): {
  status: "available" | "error";
  enabledTools: string[];
  error?: string;
} | null {
  const discoveryTrace = traces.find((trace) => {
    if (trace.tool !== "mcpToolDiscovery") return false;
    return toStringValue(trace.input?.server) === "excalidraw";
  });
  const discoveryOutput = toRecord(discoveryTrace?.output);
  const discoveryEnabledTools = toStringArray(
    getRecordValue(discoveryOutput, "enabledTools"),
  );
  const discoveryError = toStringValue(getRecordValue(discoveryOutput, "error"));

  const policyTrace = traces.find((trace) => trace.tool === "streamingToolPolicy");
  const policyOutput = toRecord(policyTrace?.output);
  const modelToolNames = toStringArray(getRecordValue(policyOutput, "modelToolNames"));
  const policyEnabledTools = modelToolNames.filter((name) =>
    name.startsWith("mcp_excalidraw_"),
  );

  const enabledTools = Array.from(
    new Set([...discoveryEnabledTools, ...policyEnabledTools]),
  ).sort();

  if (enabledTools.length > 0) {
    return { status: "available", enabledTools };
  }

  if (discoveryError) {
    return { status: "error", enabledTools: [], error: discoveryError };
  }

  return null;
}

interface TracePanelProps {
  traces: ToolTraceItem[];
  diagnostics?: AssistantTraceDiagnostics;
}

export function TracePanel({ traces, diagnostics }: TracePanelProps) {
  const providerDecision = diagnostics?.providerDecision ?? null;
  const loopDiagnostic = diagnostics?.loopDiagnostic ?? null;
  const providerPath =
    diagnostics?.providerPath ??
    toStringValue(getRecordValue(providerDecision, "providerPath"));
  const model =
    diagnostics?.model ?? toStringValue(getRecordValue(providerDecision, "modelId"));
  const policyTrace = traces.find((trace) => trace.tool === "streamingToolPolicy");
  const policyOutput =
    policyTrace?.output && typeof policyTrace.output === "object"
      ? (policyTrace.output as Record<string, unknown>)
      : null;
  const streamingTools = toStringValue(
    getRecordValue(policyOutput, "streamingModelToolsEnabled"),
  );
  const policyReason =
    toStringValue(getRecordValue(policyOutput, "reason")) ??
    toStringValue(getRecordValue(providerDecision, "reason"));
  const intent = inferIntent(traces);
  const excalidrawMcpSummary = getExcalidrawMcpSummary(traces);
  const hasDiagnostics = Boolean(
    providerPath ||
      model ||
      streamingTools ||
      policyReason ||
      intent ||
      loopDiagnostic ||
      excalidrawMcpSummary,
  );

  if (!traces.length && !hasDiagnostics) return null;

  return (
    <Collapsible className="mt-2 rounded-md border border-border/60 bg-muted/30 p-2">
      <CollapsibleTrigger className="flex w-full items-center justify-between text-xs font-medium text-muted-foreground">
        <span>Execution Trace ({traces.length} tool calls)</span>
        <ChevronDownIcon className="h-4 w-4" />
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 space-y-2">
        {hasDiagnostics && (
          <div className="space-y-2 rounded-md border border-border/50 bg-background p-2">
            <div className="flex flex-wrap gap-1.5">
              {intent && (
                <Badge variant="outline" className="text-[10px]">
                  intent: {intent}
                </Badge>
              )}
              {providerPath && (
                <Badge variant="outline" className="text-[10px]">
                  provider: {providerPath}
                </Badge>
              )}
              {model && (
                <Badge variant="outline" className="text-[10px]">
                  model: {model}
                </Badge>
              )}
              {streamingTools && (
                <Badge variant="secondary" className="text-[10px]">
                  streaming tools: {streamingTools}
                </Badge>
              )}
            </div>
            {policyReason && (
              <p className="text-[11px] leading-4 text-muted-foreground">
                {policyReason}
              </p>
            )}
            {excalidrawMcpSummary && (
              <div className="rounded-md border border-border/50 bg-muted/20 p-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant={
                      excalidrawMcpSummary.status === "available"
                        ? "secondary"
                        : "destructive"
                    }
                    className="text-[10px]"
                  >
                    Excalidraw MCP
                  </Badge>
                  <span className="text-[11px] text-muted-foreground">
                    {excalidrawMcpSummary.status === "available"
                      ? `${excalidrawMcpSummary.enabledTools.length} diagram tools available`
                      : "diagram tools unavailable"}
                  </span>
                  <a
                    href="https://excalidraw.com"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                  >
                    Open Excalidraw
                    <ArrowRightIcon className="h-3 w-3" />
                  </a>
                </div>
                {excalidrawMcpSummary.error && (
                  <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
                    {excalidrawMcpSummary.error}
                  </p>
                )}
              </div>
            )}
            {loopDiagnostic && (
              <div>
                <p className="text-[11px] font-medium text-muted-foreground">
                  Loop diagnostic
                </p>
                <pre className="overflow-x-auto text-[11px] whitespace-pre-wrap break-words text-foreground/90">
                  {truncate(toPrettyJson(loopDiagnostic))}
                </pre>
              </div>
            )}
          </div>
        )}
        {traces.map((trace, index) => {
          const inputText = truncate(toPrettyJson(trace.input ?? {}));
          const outputText = truncate(
            toPrettyJson(trace.error ? { error: trace.error } : trace.output),
          );
          return (
            <div
              key={`${trace.tool ?? "tool"}-${trace.timestamp ?? index}`}
              className="rounded-md border border-border/50 bg-background p-2"
            >
              <div className="mb-2 flex items-center gap-2">
                <Badge variant="outline" className="text-[10px]">
                  {trace.tool ?? "unknown_tool"}
                </Badge>
                {trace.error ? (
                  <Badge variant="destructive" className="text-[10px]">
                    error
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-[10px]">
                    success
                  </Badge>
                )}
              </div>
              <div className="space-y-2">
                <div>
                  <p className="text-[11px] font-medium text-muted-foreground">
                    Input
                  </p>
                  <pre className="overflow-x-auto text-[11px] whitespace-pre-wrap break-words text-foreground/90">
                    {inputText}
                  </pre>
                </div>
                <div>
                  <p className="text-[11px] font-medium text-muted-foreground">
                    Output
                  </p>
                  <pre className="overflow-x-auto text-[11px] whitespace-pre-wrap break-words text-foreground/90">
                    {outputText}
                  </pre>
                </div>
              </div>
            </div>
          );
        })}
      </CollapsibleContent>
    </Collapsible>
  );
}
