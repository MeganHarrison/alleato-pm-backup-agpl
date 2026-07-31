"use client";

import type { ChangeEventHistoryEntry } from "@/types/change-events";
import { Text } from "@/components/ds/text";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { EmptyState } from "@/components/ds";
import { Clock } from "lucide-react";

interface ChangeEventHistoryTabProps {
  entries: ChangeEventHistoryEntry[];
  isLoading: boolean;
}

function getActionVariant(
  action: string
): "default" | "secondary" | "destructive" | "outline" {
  const upper = action.toUpperCase();
  if (upper === "CREATE") return "default";
  if (upper === "UPDATE") return "secondary";
  if (upper === "DELETE" || upper === "VOID") return "destructive";
  return "outline";
}

function formatUser(
  changedBy: string | { id: string; email: string } | null
): string {
  if (!changedBy) return "System";
  if (typeof changedBy === "object" && "email" in changedBy)
    return changedBy.email;
  if (typeof changedBy === "string") return changedBy;
  return "System";
}

export function ChangeEventHistoryTab({
  entries,
  isLoading,
}: ChangeEventHistoryTabProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner />
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <EmptyState
        icon={<Clock className="h-8 w-8 text-muted-foreground" />}
        title="No history recorded"
        description="Changes to this event will be tracked here automatically."
      />
    );
  }

  return (
    <div className="border border-border rounded-md overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-[auto_100px_1fr_1fr_160px] bg-muted/50 px-4 py-2 text-xs font-medium text-muted-foreground">
        <div className="min-w-[140px]">User</div>
        <div>Action</div>
        <div>Description</div>
        <div>Change</div>
        <div>Date</div>
      </div>

      {/* Rows */}
      {entries.map((entry) => (
        <div
          key={entry.id}
          className="grid grid-cols-[auto_100px_1fr_1fr_160px] px-4 py-2.5 border-t border-border hover:bg-muted/30 text-sm"
        >
          <div className="min-w-[140px] truncate">
            <Text size="sm">{formatUser(entry.changedBy)}</Text>
          </div>
          <div>
            <Badge variant={getActionVariant(entry.action)}>
              {entry.action}
            </Badge>
          </div>
          <div className="truncate">
            <Text size="sm">{entry.description || "--"}</Text>
          </div>
          <div>
            {entry.action.toUpperCase() === "UPDATE" &&
            entry.oldValue != null &&
            entry.newValue != null ? (
              <Text size="sm">
                <span className="text-muted-foreground">{entry.fieldName}:</span>{" "}
                <span className="line-through text-muted-foreground">
                  {entry.oldValue}
                </span>{" "}
                &rarr; {entry.newValue}
              </Text>
            ) : (
              <Text size="sm" tone="muted">
                &mdash;
              </Text>
            )}
          </div>
          <div>
            <Text size="sm" tone="muted">
              {new Date(entry.changedAt).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
            </Text>
          </div>
        </div>
      ))}
    </div>
  );
}
