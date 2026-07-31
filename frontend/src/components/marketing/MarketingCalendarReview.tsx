"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  ArchiveIcon,
  CheckIcon,
  ArrowRightIcon,
  RotateCcwIcon,
} from "lucide-react";

import { Button, EmptyState, ErrorState, StatusBadge } from "@/components/ds";
import type { Json, Tables } from "@/types/database.types";

type CalendarItem = Tables<"marketing_content_calendar_items">;
type Asset = Tables<"marketing_content_assets">;
type Source = Tables<"marketing_intelligence_items">;

export type MarketingCalendarReviewItem = CalendarItem & {
  assets: Asset[];
  sources: Source[];
};

type Citation = {
  title?: string;
  url?: string | null;
  sourceTable?: string;
  sourceId?: string;
};

function formatDate(value: string): string {
  return new Date(`${value}T12:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatLabel(value: string): string {
  return value.replaceAll("_", " ");
}

function citationsFromJson(value: Json): Citation[] {
  return Array.isArray(value)
    ? value.filter((item): item is Citation => typeof item === "object" && item !== null)
    : [];
}

export function MarketingCalendarReview({
  items,
}: {
  items: MarketingCalendarReviewItem[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function updateStatus(target: "calendar" | "asset", id: string, status: string) {
    setBusyId(id);
    setError(null);
    startTransition(async () => {
      const url =
        target === "calendar"
          ? `/api/ai-assistant/marketing/calendar/${id}`
          : `/api/ai-assistant/marketing/assets/${id}`;
      const response = await fetch(url, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        setError(payload?.error_message ?? "Marketing review update failed.");
      }
      setBusyId(null);
      router.refresh();
    });
  }

  if (items.length === 0) {
    return (
      <EmptyState
        title="No marketing calendar drafts yet"
        description="CMO-generated calendar items and draft assets will appear here after they are saved from the assistant."
      />
    );
  }

  return (
    <div className="space-y-6">
      {error ? (
        <ErrorState
          title="Marketing review update failed"
          error={error}
          className="items-start py-2 text-left"
        />
      ) : null}

      <div className="overflow-hidden rounded-lg border border-border">
        <div className="grid grid-cols-1 gap-3 border-b border-border bg-muted/30 px-4 py-2 text-xs font-medium uppercase text-muted-foreground md:grid-cols-[0.7fr_0.8fr_1.5fr_0.9fr_0.8fr_auto] md:items-center">
          <span>Date</span>
          <span>Channel</span>
          <span>Content</span>
          <span>Audience</span>
          <span>Status</span>
          <span className="text-right">Review</span>
        </div>

        <div className="divide-y divide-border/70">
          {items.map((item) => (
            <div key={item.id} className="space-y-4 px-4 py-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-[0.7fr_0.8fr_1.5fr_0.9fr_0.8fr_auto] md:items-start">
                <time className="text-sm text-muted-foreground">
                  {formatDate(item.planned_date)}
                </time>
                <div className="text-sm capitalize text-foreground">
                  {formatLabel(item.channel)}
                  <div className="mt-1 text-xs capitalize text-muted-foreground">
                    {formatLabel(item.funnel_stage)}
                  </div>
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-foreground">{item.title}</div>
                  <p className="mt-1 text-sm text-muted-foreground">{item.angle}</p>
                  <p className="mt-2 text-xs text-muted-foreground">{item.rationale}</p>
                </div>
                <span className="text-sm text-muted-foreground">
                  {item.target_audience ?? "Not specified"}
                </span>
                <StatusBadge status={formatLabel(item.status)} />
                <div className="flex justify-start gap-2 md:justify-end">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isPending && busyId === item.id}
                    onClick={() => updateStatus("calendar", item.id, "approved")}
                  >
                    <CheckIcon className="h-4 w-4" />
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={isPending && busyId === item.id}
                    onClick={() => updateStatus("calendar", item.id, "archived")}
                  >
                    <ArchiveIcon className="h-4 w-4" />
                    Archive
                  </Button>
                </div>
              </div>

              {item.sources.length > 0 ? (
                <div className="space-y-2 border-l border-border pl-3">
                  <div className="text-xs font-medium uppercase text-muted-foreground">
                    Sources
                  </div>
                  <div className="space-y-1">
                    {item.sources.map((source) => (
                      <div key={source.id} className="text-sm text-muted-foreground">
                        <span className="font-medium text-foreground">{source.title}</span>
                        {source.source_date ? ` - ${source.source_date}` : ""}
                        <span className="block text-xs">{source.summary}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {item.assets.length > 0 ? (
                <div className="space-y-3 border-l border-border pl-3">
                  <div className="text-xs font-medium uppercase text-muted-foreground">
                    Draft assets
                  </div>
                  <div className="divide-y divide-border/70">
                    {item.assets.map((asset) => {
                      const citations = citationsFromJson(asset.source_citations);
                      return (
                        <div key={asset.id} className="space-y-2 py-3 first:pt-0">
                          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                            <div>
                              <div className="text-sm font-medium text-foreground">
                                {asset.title}
                              </div>
                              <div className="text-xs capitalize text-muted-foreground">
                                {formatLabel(asset.asset_type)} - not approved for publishing
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <StatusBadge status={formatLabel(asset.status)} />
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={isPending && busyId === asset.id}
                                onClick={() => updateStatus("asset", asset.id, "approved")}
                              >
                                <CheckIcon className="h-4 w-4" />
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={isPending && busyId === asset.id}
                                onClick={() => updateStatus("asset", asset.id, "revision_requested")}
                              >
                                <RotateCcwIcon className="h-4 w-4" />
                                Revise
                              </Button>
                            </div>
                          </div>
                          <p className="whitespace-pre-wrap text-sm leading-6 text-foreground">
                            {asset.body}
                          </p>
                          {citations.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                              {citations.map((citation, index) => (
                                <span
                                  key={`${asset.id}-${citation.sourceId ?? index}`}
                                  className="inline-flex items-center gap-1 text-xs text-muted-foreground"
                                >
                                  {citation.url ? (
                                    <a
                                      href={citation.url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="inline-flex items-center gap-1 hover:text-foreground"
                                    >
                                      {citation.title ?? "Source"}
                                      <ArrowRightIcon className="h-3 w-3" />
                                    </a>
                                  ) : (
                                    citation.title ?? "Source"
                                  )}
                                </span>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
