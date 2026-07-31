import Link from "next/link";
import { ArrowUpRightIcon } from "lucide-react";

import { EmptyState, StatusBadge } from "@/components/ds";
import { scoreFeatureRequestReadiness } from "@/lib/feature-requests/readiness";
import type { FeatureRequestRow } from "@/lib/feature-requests/types";
import { ReadinessBadge } from "./ReadinessBadge";

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

export function FeatureRequestList({ requests }: { requests: FeatureRequestRow[] }) {
  if (requests.length === 0) {
    return (
      <EmptyState
        title="No feature request packets yet"
        description="AIS packets will appear here when stakeholder requests are captured from chat."
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="grid grid-cols-[1.6fr_0.7fr_0.7fr_0.7fr_0.7fr_auto] gap-4 border-b border-border bg-muted/30 px-4 py-2 text-xs font-medium uppercase text-muted-foreground">
        <span>Request</span>
        <span>Requester</span>
        <span>Status</span>
        <span>Readiness</span>
        <span>Linear</span>
        <span className="text-right">Updated</span>
      </div>
      <div className="divide-y divide-border/70">
        {requests.map((request) => {
          const readiness = scoreFeatureRequestReadiness({ request, latestPlan: null });
          const workflows = asStringArray(request.affected_workflows);
          return (
            <Link
              key={request.id}
              href={`/ai-assistant/feature-requests/${request.id}`}
              className="grid grid-cols-1 gap-3 px-4 py-3 hover:bg-muted/40 md:grid-cols-[1.6fr_0.7fr_0.7fr_0.7fr_0.7fr_auto] md:items-center md:gap-4"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium text-foreground">{request.title}</span>
                  <ArrowUpRightIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                </div>
                <div className="mt-1 truncate text-xs text-muted-foreground">
                  {workflows.length > 0 ? workflows.join(", ") : request.request_type.replaceAll("_", " ")}
                </div>
              </div>
              <span className="text-sm text-muted-foreground">{request.requester_name}</span>
              <StatusBadge status={request.status.replaceAll("_", " ")} />
              <ReadinessBadge readyForBuild={readiness.readyForBuild} label={readiness.label} />
              <StatusBadge status={request.linear_sync_status.replaceAll("_", " ")} />
              <time className="text-left text-xs text-muted-foreground md:text-right">
                {new Date(request.updated_at).toLocaleDateString()}
              </time>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
