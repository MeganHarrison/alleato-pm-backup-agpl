"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CalendarRangeIcon, ChevronDownIcon, RefreshCwIcon } from "lucide-react";

type TimelineSource = "email" | "teams" | "meeting" | "insight";

type TimelineItem = {
  id: string;
  source: TimelineSource;
  title: string;
  detail: string | null;
  timestamp: string;
  href: string | null;
};

type TimelineResponse = {
  items: TimelineItem[];
  counts: Record<TimelineSource, number>;
};

function defaultStartDate(): string {
  const d = new Date();
  d.setDate(d.getDate() - 14);
  return d.toISOString().slice(0, 10);
}

function defaultEndDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function sourceLabel(source: TimelineSource): string {
  switch (source) {
    case "email":
      return "Email";
    case "teams":
      return "Teams";
    case "meeting":
      return "Meeting";
    case "insight":
      return "AI Insight";
    default:
      return source;
  }
}

export function CrossSourceTimeline({
  projectId,
}: {
  projectId?: number | null;
}) {
  const [open, setOpen] = useState(false);
  const [startDate, setStartDate] = useState(defaultStartDate);
  const [endDate, setEndDate] = useState(defaultEndDate);
  const [isLoading, setIsLoading] = useState(false);
  const [timeline, setTimeline] = useState<TimelineResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (projectId) params.set("projectId", String(projectId));
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    return params.toString();
  }, [projectId, startDate, endDate]);

  const loadTimeline = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/ai-assistant/timeline?${queryString}`);
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Failed to load timeline");
      }
      const body = (await response.json()) as TimelineResponse;
      setTimeline(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load timeline");
      setTimeline(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    void loadTimeline();
  }, [open, queryString]);

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="mt-4 rounded-xl border border-border/70 bg-muted/20"
    >
      <CollapsibleTrigger className="flex w-full items-center justify-between px-3 py-2.5 text-sm font-medium">
        <span className="flex items-center gap-2">
          <CalendarRangeIcon className="h-4 w-4 text-muted-foreground" />
          Cross-Source Timeline
        </span>
        <ChevronDownIcon className="h-4 w-4 text-muted-foreground transition-transform data-[state=open]:rotate-180" />
      </CollapsibleTrigger>

      <CollapsibleContent className="space-y-3 border-t border-border/60 px-3 pb-3 pt-2">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="h-8 w-auto text-xs"
          />
          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="h-8 w-auto text-xs"
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => void loadTimeline()}
            disabled={isLoading}
            className="h-8 px-2 text-xs"
          >
            <RefreshCwIcon className={`mr-1 h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          {!projectId && (
            <span className="text-xs text-muted-foreground">
              Showing all projects. Pin a project for tighter context.
            </span>
          )}
        </div>

        {timeline?.counts && (
          <div className="flex flex-wrap gap-1.5">
            {(["email", "teams", "meeting", "insight"] as TimelineSource[]).map(
              (source) => (
                <Badge key={source} variant="outline" className="text-[11px]">
                  {sourceLabel(source)} {timeline.counts[source] ?? 0}
                </Badge>
              ),
            )}
          </div>
        )}

        {error && <p className="text-xs text-destructive">{error}</p>}

        {!error && timeline && timeline.items.length === 0 && (
          <p className="text-xs text-muted-foreground">
            No timeline activity found for this range.
          </p>
        )}

        {!error && timeline && timeline.items.length > 0 && (
          <div className="space-y-2">
            {timeline.items.slice(0, 24).map((item) => (
              <div key={item.id} className="rounded-md border border-border/60 bg-background px-2.5 py-2">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <Badge variant="secondary" className="text-[10px]">
                    {sourceLabel(item.source)}
                  </Badge>
                  <span className="text-[11px] text-muted-foreground">
                    {new Date(item.timestamp).toLocaleString()}
                  </span>
                </div>
                <p className="text-sm font-medium text-foreground">{item.title}</p>
                {item.detail && (
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                    {item.detail}
                  </p>
                )}
                {item.href && (
                  <div className="mt-1.5">
                    <Link href={item.href} className="text-xs text-primary hover:underline">
                      Open source
                    </Link>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
