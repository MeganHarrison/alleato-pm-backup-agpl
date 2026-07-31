"use client";

import { memo } from "react";
import { History } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api-client";
import { EmptyState } from "@/components/ds/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ds/text";
import { Badge } from "@/components/ui/badge";

interface ChangeHistoryTabProps {
  commitmentId: string;
}

interface AuditActor {
  email: string | null;
  full_name: string | null;
}

interface AuditEntry {
  id: string;
  commitment_id: string;
  commitment_type: "subcontract" | "purchase_order";
  action: "INSERT" | "UPDATE" | "DELETE";
  changed_fields: Record<string, unknown> | null;
  actor_id: string | null;
  actor: AuditActor | null;
  created_at: string;
}

const HIDDEN_FIELDS = new Set([
  "id",
  "created_by",
  "created_at",
  "updated_at",
  "project_id",
]);

interface HistoryResponse {
  data?: AuditEntry[];
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value || "—";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function formatField(field: string): string {
  return field
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function actionBadgeVariant(action: AuditEntry["action"]) {
  if (action === "INSERT") return "default" as const;
  if (action === "DELETE") return "destructive" as const;
  return "secondary" as const;
}

export const ChangeHistoryTab = memo(function ChangeHistoryTab({
  commitmentId,
}: ChangeHistoryTabProps) {
  const { data, error, isLoading } = useQuery<AuditEntry[]>({
    queryKey: ["commitment-history", commitmentId],
    queryFn: async ({ signal }) => {
      const payload = await apiFetch<HistoryResponse>(
        `/api/commitments/${commitmentId}/history`,
        { signal },
      );
      return payload.data ?? [];
    },
    enabled: !!commitmentId,
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <Text tone="destructive">
        {error instanceof Error ? error.message : "Failed to load change history."}
      </Text>
    );
  }

  if (!data || data.length === 0) {
    return (
      <EmptyState
        icon={<History className="h-8 w-8" />}
        title="No changes recorded yet"
        description="Edits to this commitment will appear here automatically."
      />
    );
  }

  return (
    <div className="space-y-3">
      {data.map((entry) => {
        const when = new Date(entry.created_at);
        const actorName = entry.actor?.full_name || entry.actor?.email || "System";
        const diffFields =
          entry.action === "UPDATE" && entry.changed_fields
            ? Object.entries(entry.changed_fields).filter(
                ([field]) => !HIDDEN_FIELDS.has(field),
              )
            : [];

        return (
          <div
            key={entry.id}
            className="rounded-md bg-card p-3"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Badge variant={actionBadgeVariant(entry.action)}>
                  {entry.action}
                </Badge>
                <Text size="sm" className="font-medium">
                  {actorName}
                </Text>
              </div>
              <Text size="xs" tone="muted">
                {when.toLocaleString()}
              </Text>
            </div>

            {entry.action === "UPDATE" && diffFields.length > 0 ? (
              <ul className="mt-2 space-y-1">
                {diffFields.map(([field, change]) => {
                  const c = change as { old?: unknown; new?: unknown } | null;
                  return (
                    <li key={field} className="text-sm">
                      <span className="font-medium">{formatField(field)}:</span>{" "}
                      <span className="text-muted-foreground line-through">
                        {formatValue(c?.old)}
                      </span>{" "}
                      <span className="text-muted-foreground">→</span>{" "}
                      <span>{formatValue(c?.new)}</span>
                    </li>
                  );
                })}
              </ul>
            ) : null}

            {entry.action === "INSERT" ? (
              <Text size="xs" tone="muted" className="mt-1">
                Commitment created.
              </Text>
            ) : null}

            {entry.action === "DELETE" ? (
              <Text size="xs" tone="muted" className="mt-1">
                Commitment deleted.
              </Text>
            ) : null}
          </div>
        );
      })}
    </div>
  );
});

ChangeHistoryTab.displayName = "ChangeHistoryTab";
