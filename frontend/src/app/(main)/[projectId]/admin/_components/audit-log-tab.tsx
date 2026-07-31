"use client";

import { useQuery } from "@tanstack/react-query";
import { EmptyState } from "@/components/ds";

interface AuditEntry {
  id: string;
  action: string;
  module: string | null;
  old_level: string | null;
  new_level: string | null;
  created_at: string;
  person: { first_name: string; last_name: string; email: string } | null;
  template: { name: string } | null;
}

const ACTION_LABELS: Record<string, string> = {
  set_override: "Override set",
  remove_override: "Override removed",
  assign_template: "Template assigned",
};

interface Props {
  projectId: string;
}

export function AuditLogTab({ projectId }: Props) {
  const { data: entries = [], isLoading } = useQuery<AuditEntry[]>({
    queryKey: ["permissions-audit-log", projectId],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/permissions/audit`);
      if (!res.ok) throw new Error("Failed to load audit log");
      const { data } = await res.json();
      return data;
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-14 bg-muted rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <EmptyState
        title="No activity yet"
        description="Permission changes will appear here as you assign templates and set overrides."
      />
    );
  }

  return (
    <div className="space-y-1">
      {entries.map((entry) => (
        <div
          key={entry.id}
          className="flex items-start justify-between gap-4 px-4 py-3 rounded-lg hover:bg-muted/50 transition-colors"
        >
          <div className="space-y-0.5 min-w-0">
            <p className="text-sm text-foreground">
              <span className="font-medium">
                {entry.person
                  ? `${entry.person.first_name} ${entry.person.last_name}`
                  : "Unknown user"}
              </span>
              {" — "}
              {ACTION_LABELS[entry.action] ?? entry.action}
              {entry.module && (
                <span className="text-muted-foreground">
                  {" "}on{" "}
                  <span className="capitalize">{entry.module.replace("_", " ")}</span>
                </span>
              )}
              {entry.template && (
                <span className="text-muted-foreground"> to {entry.template.name}</span>
              )}
            </p>
            {entry.old_level && entry.new_level && (
              <p className="text-xs text-muted-foreground">
                {entry.old_level} → {entry.new_level}
              </p>
            )}
          </div>
          <time className="text-xs text-muted-foreground shrink-0 pt-0.5">
            {new Date(entry.created_at).toLocaleString()}
          </time>
        </div>
      ))}
    </div>
  );
}
