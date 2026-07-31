"use client";
/* eslint-disable design-system/no-raw-heading */

import type { DynamicToolUIPart, ToolUIPart } from "ai";
import type { ComponentProps, ReactNode } from "react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { DetailField, DetailFieldGrid } from "@/components/ds/DetailField";
import { cn } from "@/lib/utils";
import {
  CheckCircleIcon,
  ChevronDownIcon,
  CircleIcon,
  ClockIcon,
  FileCheck2Icon,
  XCircleIcon,
} from "lucide-react";
import { isValidElement } from "react";

import { CodeBlock } from "./code-block";

export type ToolProps = ComponentProps<typeof Collapsible>;

export const Tool = ({ className, ...props }: ToolProps) => (
  <Collapsible
    className={cn("group not-prose mb-4 w-full rounded-md", className)}
    {...props}
  />
);

export type ToolPart = ToolUIPart | DynamicToolUIPart;

export type ToolHeaderProps = {
  title?: string;
  className?: string;
} & (
  | { type: ToolUIPart["type"]; state: ToolUIPart["state"]; toolName?: never }
  | {
      type: DynamicToolUIPart["type"];
      state: DynamicToolUIPart["state"];
      toolName: string;
    }
);

const statusLabels: Record<ToolPart["state"], string> = {
  "approval-requested": "Needs your approval",
  "approval-responded": "Decision recorded",
  "input-available": "Running",
  "input-streaming": "Pending",
  "output-available": "Completed",
  "output-denied": "Not approved",
  "output-error": "Error",
};

const statusIcons: Record<ToolPart["state"], ReactNode> = {
  "approval-requested": <ClockIcon className="size-3.5 text-warning" />,
  "approval-responded": <ClockIcon className="size-3.5 text-muted-foreground" />,
  "input-available": (
    <ClockIcon className="size-3.5 animate-pulse text-muted-foreground" />
  ),
  "input-streaming": <CircleIcon className="size-3.5 text-muted-foreground" />,
  "output-available": <CheckCircleIcon className="size-3.5 text-success" />,
  "output-denied": <XCircleIcon className="size-3.5 text-muted-foreground" />,
  "output-error": <XCircleIcon className="size-3.5 text-destructive" />,
};

export const getStatusBadge = (status: ToolPart["state"]) => (
  <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
    {statusIcons[status]}
    {statusLabels[status]}
  </span>
);

export const ToolHeader = ({
  className,
  title,
  type,
  state,
  toolName,
  ...props
}: ToolHeaderProps) => {
  const derivedName =
    type === "dynamic-tool" ? toolName : type.split("-").slice(1).join("-");

  return (
    <CollapsibleTrigger
      className={cn(
        "flex w-full items-center justify-between gap-4 p-4",
        className
      )}
      {...props}
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className="truncate text-sm font-medium">
          {title ?? derivedName}
        </span>
        {getStatusBadge(state)}
      </div>
      <ChevronDownIcon className="size-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
    </CollapsibleTrigger>
  );
};

export type ToolContentProps = ComponentProps<typeof CollapsibleContent>;

export const ToolContent = ({ className, ...props }: ToolContentProps) => (
  <CollapsibleContent
    className={cn(
      "data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2 space-y-4 p-4 text-popover-foreground outline-none data-[state=closed]:animate-out data-[state=open]:animate-in",
      className
    )}
    {...props}
  />
);

export type ToolInputProps = ComponentProps<"div"> & {
  input: ToolPart["input"];
  toolName?: string;
  variant?: "default" | "approval";
};

type DisplayField = {
  label: string;
  value: string;
  wide?: boolean;
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const asText = (value: unknown): string | null => {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number") return String(value);
  return null;
};

const humanizeValue = (value: unknown): string | null => {
  const text = asText(value);
  if (!text) return null;

  const normalized = text.toLowerCase();
  if (normalized === "no" || normalized === "none") return "None";
  if (normalized === "yes") return "Yes";
  if (normalized === "tbd") return "To be determined";
  if (normalized === "open") return "Open";

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const date = new Date(`${text}T00:00:00Z`);
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    }).format(date);
  }

  return text;
};

const approvalFieldsByTool: Record<
  string,
  Array<{ key: string; label: string; wide?: boolean }>
> = {
  createRFI: [
    { key: "subject", label: "Subject", wide: true },
    { key: "question", label: "Question", wide: true },
    { key: "dueDate", label: "Due date" },
    { key: "ballInCourt", label: "Ball in court" },
    { key: "costImpact", label: "Cost impact" },
    { key: "scheduleImpact", label: "Schedule impact" },
  ],
};

export const getApprovalDisplayFields = (
  toolName: string | undefined,
  input: unknown,
): DisplayField[] => {
  const record = asRecord(input);
  const definitions = toolName ? approvalFieldsByTool[toolName] : undefined;

  if (definitions) {
    return definitions.flatMap(({ key, label, wide }) => {
      const value = humanizeValue(record[key]);
      return value ? [{ label, value, wide }] : [];
    });
  }

  return Object.entries(record)
    .filter(([key]) => !/^(projectId|tenantId|idempotencyKey)$/i.test(key))
    .slice(0, 6)
    .flatMap(([key, rawValue]) => {
      const value = humanizeValue(rawValue);
      const label = key
        .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
        .replace(/[_-]+/g, " ")
        .replace(/^./, (character) => character.toUpperCase());
      return value ? [{ label, value }] : [];
    });
};

export const ToolInput = ({
  className,
  input,
  toolName,
  variant = "default",
  ...props
}: ToolInputProps) => {
  if (variant === "approval") {
    const fields = getApprovalDisplayFields(toolName, input);

    return (
      <div className={cn("space-y-4", className)} {...props}>
        {fields.length > 0 && (
          <DetailFieldGrid columns={2} className="gap-x-6 gap-y-4">
            {fields.map((field) => (
              <DetailField
                className={cn(
                  "grid-cols-1 gap-1 sm:grid-cols-1",
                )}
                key={field.label}
                label={field.label}
                span={field.wide ? 2 : 1}
              >
                <span className="whitespace-pre-wrap leading-6">
                  {field.value}
                </span>
              </DetailField>
            ))}
          </DetailFieldGrid>
        )}
        <details className="group">
          <summary className="cursor-pointer list-none text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
            Technical details
          </summary>
          <div className="mt-3 overflow-hidden rounded-md bg-background">
            <CodeBlock code={JSON.stringify(input, null, 2)} language="json" />
          </div>
        </details>
      </div>
    );
  }

  return (
    <div className={cn("space-y-2 overflow-hidden", className)} {...props}>
      <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Parameters
      </h4>
      <div className="rounded-md bg-muted/50">
        <CodeBlock code={JSON.stringify(input, null, 2)} language="json" />
      </div>
    </div>
  );
};

export type ToolOutputProps = ComponentProps<"div"> & {
  output: ToolPart["output"];
  errorText: ToolPart["errorText"];
  toolName?: string;
};

export const ToolOutput = ({
  className,
  output,
  errorText,
  toolName,
  ...props
}: ToolOutputProps) => {
  if (!(output || errorText)) {
    return null;
  }

  const outputRecord = asRecord(output);
  const result = Object.keys(asRecord(outputRecord.result)).length
    ? asRecord(outputRecord.result)
    : outputRecord;
  const record = asRecord(result.record);
  const receipt = asRecord(outputRecord.receipt);
  const isSuccessfulMutation =
    !errorText && result.success === true && Object.keys(record).length > 0;

  if (isSuccessfulMutation) {
    const number = humanizeValue(record.number);
    const subject =
      humanizeValue(record.subject) ??
      humanizeValue(record.title) ??
      humanizeValue(record.name);
    const status = humanizeValue(record.status);
    const recordLabel = toolName === "createRFI" ? "RFI" : "Record";

    return (
      <div
        className={cn(
          "space-y-4 rounded-lg bg-success-surface p-4 sm:p-5",
          className,
        )}
        {...props}
      >
        <div className="flex items-start gap-3">
          <FileCheck2Icon
            aria-hidden="true"
            className="mt-0.5 size-5 shrink-0 text-success"
          />
          <div className="min-w-0 space-y-1">
            <p className="font-medium text-foreground">
              {recordLabel}
              {number ? ` #${number}` : ""} created
            </p>
            {subject && (
              <p className="text-sm leading-6 text-muted-foreground">
                {subject}
              </p>
            )}
          </div>
        </div>
        <DetailFieldGrid
          columns={2}
          className="gap-3 border-t border-success-border/50 pt-4"
        >
          {status && (
            <DetailField
              className="grid-cols-[1fr_auto] gap-4 sm:grid-cols-1 sm:gap-1"
              label="Status"
            >
              <span className="font-medium">{status}</span>
            </DetailField>
          )}
          {Object.keys(receipt).length > 0 && (
            <DetailField
              className="grid-cols-[1fr_auto] gap-4 sm:grid-cols-1 sm:gap-1"
              label="Audit receipt"
            >
              <span className="font-medium">Recorded</span>
            </DetailField>
          )}
        </DetailFieldGrid>
        <details>
          <summary className="cursor-pointer list-none text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
            Technical receipt
          </summary>
          <div className="mt-3 overflow-hidden rounded-md bg-background/80">
            <CodeBlock code={JSON.stringify(output, null, 2)} language="json" />
          </div>
        </details>
      </div>
    );
  }

  let Output = <div>{output as ReactNode}</div>;

  if (typeof output === "object" && !isValidElement(output)) {
    Output = (
      <CodeBlock code={JSON.stringify(output, null, 2)} language="json" />
    );
  } else if (typeof output === "string") {
    Output = <CodeBlock code={output} language="json" />;
  }

  return (
    <div className={cn("space-y-2", className)} {...props}>
      <h4 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
        {errorText ? "Error" : "Result"}
      </h4>
      <div
        className={cn(
          "overflow-x-auto rounded-md text-xs [&_table]:w-full",
          errorText
            ? "bg-destructive/10 text-destructive"
            : "bg-muted/50 text-foreground"
        )}
      >
        {errorText && <div>{errorText}</div>}
        {Output}
      </div>
    </div>
  );
};
