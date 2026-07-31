"use client";

import { History } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ds";
import { useDrawingChangeHistory } from "@/hooks/use-drawings";

interface DrawingChangeHistoryProps {
  projectId: string;
  drawingId: string;
}

const CHANGE_TYPE_LABELS: Record<string, string> = {
  create: "Created",
  update: "Updated",
  publish: "Published",
  unpublish: "Unpublished",
  obsolete: "Marked Obsolete",
  restore: "Restored",
  delete: "Deleted",
  revision_added: "New Revision",
};

const CHANGE_TYPE_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  publish: "default",
  unpublish: "secondary",
  obsolete: "destructive",
  restore: "outline",
  revision_added: "default",
  create: "default",
  update: "secondary",
  delete: "destructive",
};

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

export function DrawingChangeHistory({
  projectId,
  drawingId,
}: DrawingChangeHistoryProps) {
  const { data: history, isLoading } = useDrawingChangeHistory(projectId, drawingId);

  if (isLoading) {
    return (
      <div className="py-8 text-center text-muted-foreground text-sm">
        Loading change history...
      </div>
    );
  }

  if (!history || history.length === 0) {
    return (
      <EmptyState
        icon={<History className="h-6 w-6 text-muted-foreground" />}
        title="No changes recorded"
        description="All edits and status changes to this drawing will be tracked here."
      />
    );
  }

  return (
    <div className="space-y-1">
      {history.map((event) => (
        <div
          key={event.id}
          className="flex items-start gap-3 py-3 border-b border-border last:border-0"
        >
          <div className="mt-0.5 flex-shrink-0">
            <Badge variant={CHANGE_TYPE_VARIANTS[event.change_type] ?? "secondary"} className="text-xs">
              {CHANGE_TYPE_LABELS[event.change_type] ?? event.change_type}
            </Badge>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-foreground">
                {event.changed_by_name}
              </span>
              {event.field_name !== event.change_type && (
                <span className="text-sm text-muted-foreground capitalize">
                  {event.field_name.replace(/_/g, " ")}
                </span>
              )}
            </div>
            {event.old_value && event.new_value && (
              <p className="text-xs text-muted-foreground mt-0.5">
                <span className="line-through">{event.old_value}</span>
                {" → "}
                <span className="text-foreground">{event.new_value}</span>
              </p>
            )}
            {!event.old_value && event.new_value && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {event.new_value}
              </p>
            )}
          </div>
          <div className="text-xs text-muted-foreground flex-shrink-0 mt-0.5">
            {formatRelativeTime(event.changed_at)}
          </div>
        </div>
      ))}
    </div>
  );
}
