"use client";

/**
 * TraceMenu — a clean, minimal way to inspect an assistant message's execution
 * trace. Renders as a single small icon in the message action row; clicking it
 * opens a popover with a step list (tool, status, duration), a one-line
 * diagnostics summary, and the raw input/output tucked behind a per-step
 * disclosure so the wall of JSON is never shown by default.
 *
 * Replaces the always-visible, bordered, JSON-dumping TracePanel under every
 * message. Same data source (`metadata.tool_trace` + diagnostics), quieter UI.
 */

import { useState } from "react";
import { ChevronRightIcon, WaypointsIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

import type { AssistantTraceDiagnostics, ToolTraceItem } from "./trace-panel";

// Persisted trace objects (JSONB) carry richer fields at runtime than the
// ToolTraceItem type declares — read them defensively.
type RawStep = ToolTraceItem & {
  toolName?: string;
  status?: string;
  durationMs?: number;
  detail?: string;
  source?: string | null;
  agent?: string;
};

type NormalizedStep = {
  name: string;
  failed: boolean;
  durationMs?: number;
  detail?: string;
  source?: string;
  errorText?: string;
  raw?: { input?: unknown; output?: unknown };
  subSteps: NormalizedStep[];
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function str(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function formatDuration(ms?: number): string | null {
  if (typeof ms !== "number" || !Number.isFinite(ms) || ms <= 0) return null;
  return ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(1)}s`;
}

function isFailed(step: { error?: string; status?: string }): boolean {
  if (step.error) return true;
  const status = (step.status ?? "").toLowerCase();
  return status === "failed" || status === "error";
}

function normalizeSubStep(raw: unknown): NormalizedStep | null {
  const record = asRecord(raw);
  if (!record) return null;
  const name = str(record.tool) ?? str(record.toolName) ?? "step";
  const failed = isFailed(record as RawStep);
  return {
    name,
    failed,
    durationMs:
      typeof record.durationMs === "number" ? record.durationMs : undefined,
    detail: str(record.detail) ?? undefined,
    source: str(record.source) ?? undefined,
    errorText: failed
      ? str(record.error) ?? str(record.detail) ?? undefined
      : undefined,
    subSteps: [],
  };
}

function normalizeStep(raw: RawStep): NormalizedStep {
  const failed = isFailed(raw);
  const output = asRecord(raw.output);
  const nested = Array.isArray(output?.toolTrace) ? output?.toolTrace : [];
  const subSteps = (nested as unknown[])
    .map(normalizeSubStep)
    .filter((s): s is NormalizedStep => Boolean(s));

  const hasRaw =
    (raw.input && Object.keys(raw.input).length > 0) || raw.output != null;

  return {
    name: str(raw.tool) ?? str(raw.toolName) ?? "tool",
    failed,
    durationMs: typeof raw.durationMs === "number" ? raw.durationMs : undefined,
    detail: str(raw.detail) ?? undefined,
    source: str(raw.source) ?? undefined,
    errorText: failed ? str(raw.error) ?? str(raw.detail) ?? undefined : undefined,
    raw: hasRaw ? { input: raw.input, output: raw.output } : undefined,
    subSteps,
  };
}

function inferIntent(traces: RawStep[]): string | null {
  for (const trace of traces) {
    const intent = str(trace.input?.intent);
    if (intent) return intent;
    const out = asRecord(trace.output);
    if (out) {
      const outIntent = str(out.intent);
      if (outIntent) return outIntent;
    }
  }
  return null;
}

function StatusDot({ failed }: { failed: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full",
        failed ? "bg-destructive" : "bg-muted-foreground/50",
      )}
    />
  );
}

function StepRow({ step }: { step: NormalizedStep }) {
  const [open, setOpen] = useState(false);
  const duration = formatDuration(step.durationMs);
  const expandable =
    Boolean(step.raw) || step.subSteps.length > 0 || Boolean(step.detail);

  const rowContent = (
    <>
      <StatusDot failed={step.failed} />
      <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
        {step.name}
      </span>
      {duration && (
        <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
          {duration}
        </span>
      )}
      {expandable && (
        <ChevronRightIcon
          className={cn(
            "mt-0.5 h-3 w-3 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-90",
          )}
        />
      )}
    </>
  );

  return (
    <div className="py-1.5">
      {expandable ? (
        <Button
          type="button"
          variant="ghost"
          onClick={() => setOpen((value) => !value)}
          className="flex h-auto w-full items-start justify-start gap-2 p-0 text-left font-normal hover:bg-transparent"
        >
          {rowContent}
        </Button>
      ) : (
        <div className="flex w-full items-start gap-2">{rowContent}</div>
      )}

      {step.errorText && !open && (
        <p className="mt-0.5 pl-3.5 text-[11px] leading-4 text-destructive">
          {step.errorText}
        </p>
      )}

      {open && (
        <div className="mt-1 space-y-2 pl-3.5">
          {step.detail && (
            <p className="text-[11px] leading-4 text-muted-foreground">
              {step.detail}
            </p>
          )}
          {step.errorText && (
            <p className="text-[11px] leading-4 text-destructive">
              {step.errorText}
            </p>
          )}
          {step.source && (
            <p className="text-[11px] text-muted-foreground">
              source: {step.source}
            </p>
          )}

          {step.subSteps.length > 0 && (
            <div className="border-l border-border/50 pl-2.5">
              {step.subSteps.map((sub, index) => (
                <div
                  key={`${sub.name}-${index}`}
                  className="flex items-start gap-2 py-0.5"
                >
                  <StatusDot failed={sub.failed} />
                  <span className="min-w-0 flex-1 truncate text-[11px] text-foreground/90">
                    {sub.name}
                    {sub.failed && sub.errorText ? (
                      <span className="text-destructive"> — {sub.errorText}</span>
                    ) : null}
                  </span>
                  {formatDuration(sub.durationMs) && (
                    <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                      {formatDuration(sub.durationMs)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {step.raw && (
            <details className="group/raw">
              <summary className="cursor-pointer list-none text-[11px] font-medium text-muted-foreground hover:text-foreground">
                Raw input / output
              </summary>
              <pre className="mt-1 max-h-48 overflow-auto rounded-md bg-muted/40 p-2 text-[10px] leading-4 text-foreground/80">
                {JSON.stringify(
                  { input: step.raw.input, output: step.raw.output },
                  null,
                  2,
                )}
              </pre>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

interface TraceMenuProps {
  traces: ToolTraceItem[];
  diagnostics?: AssistantTraceDiagnostics;
  className?: string;
}

export function TraceMenu({ traces, diagnostics, className }: TraceMenuProps) {
  const rawSteps = (traces ?? []) as RawStep[];
  const steps = rawSteps.map(normalizeStep);

  const intent = inferIntent(rawSteps);
  const providerPath =
    diagnostics?.providerPath ??
    str(asRecord(diagnostics?.providerDecision)?.providerPath);
  const model =
    diagnostics?.model ?? str(asRecord(diagnostics?.providerDecision)?.modelId);

  const summaryBits = [intent, providerPath, model].filter(Boolean) as string[];

  if (steps.length === 0 && summaryBits.length === 0) return null;

  const totalMs = steps.reduce((sum, step) => sum + (step.durationMs ?? 0), 0);
  const totalLabel = formatDuration(totalMs);
  const stepCount = steps.length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className={className}
          aria-label="Trace"
          title="Trace"
        >
          <WaypointsIcon className="h-3.5 w-3.5" />
          <span className="sr-only">View execution trace</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="max-h-96 w-80 overflow-y-auto p-0 sm:w-96"
      >
        <div className="flex items-baseline justify-between gap-2 px-3 pt-3">
          <span className="text-xs font-semibold text-foreground">Trace</span>
          {stepCount > 0 && (
            <span className="text-[11px] text-muted-foreground">
              {stepCount} {stepCount === 1 ? "step" : "steps"}
              {totalLabel ? ` · ${totalLabel}` : ""}
            </span>
          )}
        </div>

        {summaryBits.length > 0 && (
          <p className="px-3 pt-1 text-[11px] text-muted-foreground">
            {summaryBits.join(" · ")}
          </p>
        )}

        <div className="mt-1 divide-y divide-border/40 px-3 pb-3">
          {steps.map((step, index) => (
            <StepRow key={`${step.name}-${index}`} step={step} />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
