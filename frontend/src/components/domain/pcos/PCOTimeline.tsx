"use client";

import {
  Plus,
  Layers,
  Send,
  RotateCcw,
  CheckCircle2,
  FileText,
  MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SectionHeader, EmptyState } from "@/components/ds";
import { Badge } from "@/components/ui/badge";
import type { PCO } from "@/hooks/use-pcos";
import { formatCurrency } from "@/lib/utils";

interface PCOTimelineProps {
  pco: PCO;
  projectId: string;
}

interface TimelineEvent {
  id: string;
  type: string;
  heading: string;
  description: string;
  actor: string | null;
  timestamp: string;
}

const eventConfig: Record<
  string,
  { icon: React.ElementType; colorClass: string }
> = {
  CREATED: { icon: Plus, colorClass: "bg-green-500" },
  GROUPED_INTO_PCO: { icon: Layers, colorClass: "bg-blue-500" },
  PCO_SUBMITTED: { icon: Send, colorClass: "bg-amber-500" },
  CLIENT_REVISION_REQUESTED: { icon: RotateCcw, colorClass: "bg-red-500" },
  PCO_APPROVED: { icon: CheckCircle2, colorClass: "bg-green-500" },
  CO_CREATED: { icon: FileText, colorClass: "bg-purple-500" },
  COMMENT_ADDED: { icon: MessageSquare, colorClass: "bg-muted-foreground" },
};

function buildTimelineFromPCO(pco: PCO): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  // PCO creation
  events.push({
    id: `pco-created-${pco.id}`,
    type: "CREATED",
    heading: "PCO Created",
    description: `PCO #${pco.number} "${pco.title}" was created`,
    actor: null,
    timestamp: pco.created_at,
  });

  // Change events grouped
  if (pco.change_events) {
    for (const ce of pco.change_events) {
      events.push({
        id: `ce-grouped-${ce.id}`,
        type: "GROUPED_INTO_PCO",
        heading: `Change Event #${ce.number} Linked`,
        description: ce.title,
        actor: null,
        timestamp: pco.created_at, // approximate
      });
    }
  }

  // Submission
  if (pco.submitted_at) {
    events.push({
      id: `pco-submitted-${pco.id}`,
      type: "PCO_SUBMITTED",
      heading: "Submitted to Client",
      description: `PCO #${pco.number} was submitted for review`,
      actor: null,
      timestamp: pco.submitted_at,
    });
  }

  // Versions (revisions)
  if (pco.versions) {
    for (const ver of pco.versions) {
      if (ver.client_decision === "revision_requested") {
        events.push({
          id: `revision-${ver.id}`,
          type: "CLIENT_REVISION_REQUESTED",
          heading: `Revision Requested (v${ver.version})`,
          description: ver.client_decision_note || "Client requested changes",
          actor: null,
          timestamp: ver.client_decision_at || ver.submitted_at,
        });
      }
    }
  }

  // Approval
  if (pco.approved_at) {
    events.push({
      id: `pco-approved-${pco.id}`,
      type: "PCO_APPROVED",
      heading: "PCO Approved",
      description: `Approved value: ${formatCurrency(pco.approved_value)}`,
      actor: null,
      timestamp: pco.approved_at,
    });
  }

  // CO created
  if (pco.prime_change_order_id) {
    events.push({
      id: `co-created-${pco.id}`,
      type: "CO_CREATED",
      heading: "Change Order Created",
      description: `Converted to Change Order #${pco.prime_change_order_id}`,
      actor: null,
      timestamp: pco.approved_at || pco.updated_at,
    });
  }

  // Sort ascending
  events.sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  return events;
}

export function PCOTimeline({ pco, projectId }: PCOTimelineProps) {
  const events = buildTimelineFromPCO(pco);

  return (
    <div className="space-y-4">
      <SectionHeader title="Timeline" count={events.length} />

      {events.length === 0 ? (
        <EmptyState
          icon={<FileText />}
          title="No timeline events"
          description="Events will appear here as the PCO progresses."
        />
      ) : (
        <div className="relative ml-4 space-y-6 border-l border-border pl-6">
          {events.map((event) => {
            const config = eventConfig[event.type] ?? eventConfig.COMMENT_ADDED;
            const Icon = config.icon;

            return (
              <div key={event.id} className="relative">
                {/* Dot on the rail */}
                <div
                  className={cn(
                    "absolute -left-[calc(1.5rem+5px)] top-1 flex h-2.5 w-2.5 rounded-full",
                    config.colorClass
                  )}
                />

                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium text-foreground">
                      {event.heading}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {event.description}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(event.timestamp).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Linked Change Events */}
      {pco.change_events && pco.change_events.length > 0 && (
        <div className="mt-6 space-y-3">
          <SectionHeader
            title="Change Events"
            count={pco.change_events.length}
          />
          <div className="space-y-2">
            {pco.change_events.map((ce) => (
              <a
                key={ce.id}
                href={`/${pco.project_id}/change-events/${ce.id}`}
                className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2.5 transition-colors hover:bg-muted"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">
                      CE #{ce.number}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {ce.type}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{ce.title}</p>
                </div>
                <span className="text-sm font-medium text-foreground">
                  {formatCurrency(ce.estimated_amount)}
                </span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Comments placeholder */}
      <div className="mt-6">
        <SectionHeader title="Comments" />
        <EmptyState
          icon={<MessageSquare />}
          title="Comments coming soon"
          description="Discussion and notes will appear here."
        />
      </div>
    </div>
  );
}
