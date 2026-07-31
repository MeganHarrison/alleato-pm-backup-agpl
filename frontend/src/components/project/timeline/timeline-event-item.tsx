"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, ChevronDown } from "lucide-react";
import { StatusBadge } from "@/components/ds/status-badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { resolveTimelineLink } from "./timeline-link";
import { TimelineMarkdown } from "./timeline-markdown";
import { KIND_LABEL } from "./timeline-types";
import type { TimelineEvent, TimelineEventKind } from "./timeline-types";

const DOT_COLOR: Record<TimelineEventKind, string> = {
  project_created:          "bg-primary",
  project_start:            "bg-primary",
  meeting:                  "bg-muted-foreground",
  rfi:                      "bg-orange-500",
  submittal:                "bg-violet-500",
  commitment:               "bg-green-600",
  commitment_executed:      "bg-green-600",
  change_event:             "bg-amber-500",
  change_order:             "bg-destructive",
  prime_contract:           "bg-blue-600",
  prime_contract_executed:  "bg-blue-600",
};

interface Props {
  event: TimelineEvent;
  isLast: boolean;
}

export function TimelineEventItem({ event, isLast }: Props) {
  const [open, setOpen] = useState(false);
  const link = resolveTimelineLink(event.project_id, event.kind, event.entity_id);
  const date = new Date(event.occurred_at);
  const dateLabel = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const kindLabel = KIND_LABEL[event.kind] ?? event.kind;
  const hasDetails = Boolean(event.summary);

  return (
    <div className="flex gap-3">
      {/* Dot + vertical connector */}
      <div className="flex flex-col items-center">
        <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", DOT_COLOR[event.kind])} />
        {!isLast && <span className="mt-1 w-px flex-1 bg-border" />}
      </div>

      {/* Date */}
      <span className="w-14 shrink-0 pt-0.5 text-xs tabular-nums text-muted-foreground">
        {dateLabel}
      </span>

      {/* Content */}
      <div className="min-w-0 pb-5 flex-1">
        {/* Header row — clickable if there are details */}
        <Button
          variant="ghost"
          onClick={() => hasDetails && setOpen((v) => !v)}
          className={cn(
            "h-auto w-full justify-start p-0 text-left font-normal hover:bg-transparent",
            !hasDetails && "cursor-default pointer-events-none",
          )}
          disabled={!hasDetails}
        >
          <div className="flex-1 min-w-0">
            <span className="text-sm font-medium leading-snug">
              {event.title}
            </span>
            <span className="ml-1.5 text-xs text-muted-foreground">
              · {kindLabel}
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
            {event.status && (
              <StatusBadge status={event.status} className="text-[11px]" />
            )}
            {hasDetails && (
              <ChevronDown
                className={cn(
                  "h-3.5 w-3.5 text-muted-foreground transition-transform duration-150",
                  open && "rotate-180",
                )}
              />
            )}
          </div>
        </Button>

        {/* Expanded detail panel */}
        {open && event.summary && (
          <div className="mt-2 rounded-md bg-muted/50 p-3">
            <TimelineMarkdown content={event.summary} />
          </div>
        )}

        {/* View link — always visible when a detail page exists */}
        {link && (
          <Link
            href={link}
            className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            View <ArrowRight className="h-3 w-3" />
          </Link>
        )}
      </div>
    </div>
  );
}
