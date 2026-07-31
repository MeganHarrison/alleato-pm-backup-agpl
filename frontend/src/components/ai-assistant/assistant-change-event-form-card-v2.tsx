"use client";

import { FileText, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function formatValue(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return fallback;
}

function Field({
  label,
  value,
  className,
  multiline = false,
}: {
  label: string;
  value: string;
  className?: string;
  multiline?: boolean;
}) {
  return (
    <label className={cn("block space-y-1", className)}>
      <span className="text-[11px] font-medium text-muted-foreground">
        {label}
      </span>
      {multiline ? (
        <div
          role="textbox"
          aria-label={label}
          className="min-h-8 w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs font-medium leading-5 text-foreground"
        >
          <span className="break-words">{value}</span>
        </div>
      ) : (
        <Input
          readOnly
          value={value}
          className="h-8 rounded-md px-2 text-xs"
        />
      )}
    </label>
  );
}

function SectionHeader({
  title,
  actionLabel,
}: {
  title: string;
  actionLabel?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      <div className="h-px flex-1 bg-border" />
      {actionLabel ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 gap-1 px-2 text-xs"
          disabled
        >
          <Plus className="h-3 w-3" />
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}

export function AssistantChangeEventFormCardV2({
  preview,
  onConfirm,
  onCancel,
  confirmLabel = "Create change event",
  cancelLabel = "Discard",
}: {
  preview: Record<string, unknown>;
  onConfirm?: () => void;
  onCancel?: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
}) {
  const fields = asObject(preview.fields);
  const title = formatValue(fields.title);
  const description = formatValue(fields.description);
  const expectingRevenue =
    typeof fields.expecting_revenue === "boolean"
      ? fields.expecting_revenue
        ? "Yes"
        : "No"
      : "Yes";

  return (
    <div
      className="space-y-4 rounded-xl bg-muted/40 p-3"
      data-testid="assistant-change-event-form-card-v2"
    >
      <div className="flex items-center gap-2">
        <FileText className="h-4 w-4 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">
            New change event
          </p>
          <p className="text-xs text-muted-foreground">
            Form-style draft for review before creation.
          </p>
        </div>
        <Badge variant="outline" className="rounded-md text-[10px]">
          V2
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Field label="Number" value="Generated" />
        <Field label="Title" value={title} multiline />
        <Field label="Status" value={formatValue(fields.status, "Open")} />
        <Field label="Type" value={formatValue(fields.type)} />
        <Field label="Origin" value={formatValue(fields.origin)} />
        <Field label="Change reason" value={formatValue(fields.reason)} />
        <Field label="Scope" value={formatValue(fields.scope)} />
        <Field
          label="Prime contract"
          value={formatValue(fields.prime_contract_id, "Not set")}
          multiline
        />
        <Field label="Expecting revenue" value={expectingRevenue} />
        <Field
          label="Line item revenue source"
          value={formatValue(fields.line_item_revenue_source, "Not set")}
        />
      </div>

      <label className="block space-y-1">
        <span className="text-[11px] font-medium text-muted-foreground">
          Description
        </span>
        <Textarea
          readOnly
          value={description}
          rows={3}
          className="min-h-20 resize-none rounded-md px-2 py-2 text-xs"
        />
      </label>

      <Separator />

      <section className="space-y-2">
        <SectionHeader title="Line items" actionLabel="Add line item" />
        <div className="space-y-2 rounded-md border border-dashed border-border bg-background/60 p-2">
          <div className="grid grid-cols-3 gap-2">
            <Field label="Commitment" value="Not selected" />
            <Field label="Budget code" value="Not selected" />
            <Field label="Vendor" value="N/A" />
          </div>
          <Field label="Line item description" value="Not added yet" />
          <div className="grid grid-cols-3 gap-2">
            <Field label="Cost ROM" value="$0.00" />
            <Field label="Revenue ROM" value="$0.00" />
            <Field label="Non-committed" value="$0.00" />
          </div>
          <p className="text-[11px] leading-4 text-muted-foreground">
            Preview only. Chat create does not write line items yet.
          </p>
        </div>
        <div className="flex items-center justify-between rounded-md bg-muted/50 px-2 py-1.5 text-xs">
          <span className="font-medium text-foreground">Totals</span>
          <span className="text-muted-foreground">
            Cost $0.00 | Revenue $0.00 | Net $0.00
          </span>
        </div>
      </section>

      {(onConfirm || onCancel) && (
        <div className="flex justify-end gap-2 pt-1">
          {onCancel ? (
            <Button type="button" variant="outline" size="sm" onClick={onCancel}>
              {cancelLabel}
            </Button>
          ) : null}
          {onConfirm ? (
            <Button type="button" size="sm" onClick={onConfirm}>
              {confirmLabel}
            </Button>
          ) : null}
        </div>
      )}
    </div>
  );
}
