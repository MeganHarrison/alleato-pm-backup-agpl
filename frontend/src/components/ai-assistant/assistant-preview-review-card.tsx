"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getPreviewReviewCard } from "./preview-review-card";

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function toStringValue(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  return null;
}

function getPreviewHeading(previewTable: string | null): string {
  if (previewTable === "rfis") return "RFI draft";
  if (previewTable === "change_events") return "Change request draft";
  if (previewTable === "schedule_tasks" || previewTable === "tasks") return "Task draft";
  return "Draft";
}

function getPreviewFieldLabel(previewTable: string | null, key: string): string {
  const labels: Record<string, string> = {
    project_id: "Project",
    title: previewTable === "change_events" ? "Title" : "Title",
    subject: "Subject",
    question: "Question",
    status: "Status",
    due_date: "Due date",
  };
  return labels[key] ?? key.replace(/_/g, " ");
}

function formatPreviewValueForDisplay(value: unknown): string {
  if (value == null || value === "") return "Not set";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

export function AssistantPreviewReviewCard({
  preview,
  onApprove,
  onEdit,
  onRun,
}: {
  preview: Record<string, unknown>;
  onApprove?: () => void;
  onEdit?: () => void;
  onRun?: () => void;
}) {
  const previewFields = asObject(preview.fields);
  const previewEntries = Object.entries(previewFields);
  const previewReviewCard = getPreviewReviewCard(preview);
  const previewReviewGroups = previewReviewCard.groups;
  const previewTable = toStringValue(preview.table);

  return (
    <div
      className="space-y-2 rounded-xl bg-muted/40 p-3"
      data-testid="assistant-preview-review-card"
    >
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
        {getPreviewHeading(previewTable)}
      </p>
      {previewEntries.length > 0 && (
        <>
          {previewReviewGroups.length > 0 ? (
            <div className="space-y-3">
              {(previewReviewCard.title || previewReviewCard.subtitle) && (
                <div className="space-y-0.5">
                  {previewReviewCard.title ? (
                    <p className="text-sm font-semibold text-foreground">
                      {previewReviewCard.title}
                    </p>
                  ) : null}
                  {previewReviewCard.subtitle ? (
                    <p className="text-xs leading-5 text-muted-foreground">
                      {previewReviewCard.subtitle}
                    </p>
                  ) : null}
                </div>
              )}
              {previewReviewGroups.map((group) => (
                <div key={group.title} className="space-y-1.5">
                  <p className="text-[11px] font-medium text-muted-foreground">
                    {group.title}
                  </p>
                  <div className="space-y-1">
                    {group.fields.map((field) => (
                      <div
                        key={`${group.title}-${field.key}`}
                        className="grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.2fr)] gap-3 text-xs"
                      >
                        <span className="min-w-0 text-muted-foreground">
                          {field.label}
                          {field.required ? (
                            <span className="ml-1 text-foreground">*</span>
                          ) : null}
                        </span>
                        <span className="min-w-0 break-words text-right text-foreground">
                          {field.value ?? "Not set"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {previewReviewCard.notices.length > 0 ? (
                <div className="space-y-1 border-t border-border/60 pt-2">
                  {previewReviewCard.notices.map((notice) => (
                    <p
                      key={notice.text}
                      className={cn(
                        "text-[11px] leading-4",
                        notice.tone === "warning"
                          ? "text-destructive"
                          : "text-muted-foreground",
                      )}
                    >
                      {notice.text}
                    </p>
                  ))}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="space-y-1">
              {previewEntries.slice(0, 8).map(([key, value]) => (
                <div
                  key={key}
                  className="flex items-start justify-between gap-3 text-xs"
                >
                  <span className="text-muted-foreground">
                    {getPreviewFieldLabel(previewTable, key)}
                  </span>
                  <span className="w-2/3 break-words text-right text-foreground">
                    {formatPreviewValueForDisplay(value)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
      {(onApprove || onEdit || onRun) && (
        <div className="flex flex-wrap gap-2 pt-1">
          {onApprove ? (
            <Button type="button" size="sm" className="h-7 text-xs" onClick={onApprove}>
              Approve
            </Button>
          ) : null}
          {onEdit ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={onEdit}
            >
              Edit
            </Button>
          ) : null}
          {onRun ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="h-7 text-xs"
              onClick={onRun}
            >
              Run
            </Button>
          ) : null}
        </div>
      )}
    </div>
  );
}
