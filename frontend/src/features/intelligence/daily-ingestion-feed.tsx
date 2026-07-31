"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Calendar, ArrowRight, FileText, Mail, MessageSquare } from "lucide-react";

import { EmptyState, InfoAlert } from "@/components/ds";
import { Sparkline } from "@/components/ui/charts";
import {
  InlineTable,
  InlineTableBody,
  InlineTableCell,
  InlineTableHeader,
  InlineTableHeaderCell,
  InlineTableHeaderRow,
  InlineTableRow,
} from "@/components/ds/inline-table";
import { apiFetch } from "@/lib/api-client";
import type {
  IngestionFeedResponse,
  IngestionItem,
} from "@/app/api/projects/[projectId]/ingestion-feed/route";

function formatItemDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const currentYear = new Date().getUTCFullYear();
  const opts: Intl.DateTimeFormatOptions =
    d.getUTCFullYear() === currentYear
      ? { month: "short", day: "numeric", timeZone: "UTC" }
      : { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" };
  return d.toLocaleDateString("en-US", opts);
}

function CategoryTable({
  label,
  emptyNoun,
  icon,
  items,
  capped,
  trend,
  showSource = false,
}: {
  label: string;
  emptyNoun: string;
  icon: React.ReactNode;
  items: IngestionItem[];
  capped: boolean;
  trend: number[];
  showSource?: boolean;
}) {
  const hasTrend = trend.some((v) => v > 0);
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">{icon}</span>
        <p className="text-sm font-semibold text-foreground">{label}</p>
        <span className="text-xs tabular-nums text-muted-foreground">
          {items.length}
          {capped ? "+" : ""}
        </span>
        {hasTrend ? (
          <Sparkline
            data={trend.map((v) => ({ v }))}
            categories={["v"]}
            height="22px"
            className="ml-auto w-20 shrink-0"
            colors={["hsl(var(--primary))"]}
          />
        ) : null}
      </div>

      {items.length === 0 ? (
        <p className="px-3 py-2 text-xs text-muted-foreground">No {emptyNoun} for this project yet.</p>
      ) : (
        <InlineTable variant="read">
          <InlineTableHeader>
            <InlineTableHeaderRow>
              <InlineTableHeaderCell>Title</InlineTableHeaderCell>
              {showSource ? <InlineTableHeaderCell>Source</InlineTableHeaderCell> : null}
              <InlineTableHeaderCell align="right">Date</InlineTableHeaderCell>
            </InlineTableHeaderRow>
          </InlineTableHeader>
          <InlineTableBody>
            {items.map((item) => (
              <InlineTableRow key={item.id}>
                <InlineTableCell>
                  {item.link ? (
                    <a
                      href={item.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-foreground hover:text-primary hover:underline"
                    >
                      <span className="line-clamp-1">{item.title}</span>
                      <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                    </a>
                  ) : (
                    <span className="line-clamp-1 text-foreground">{item.title}</span>
                  )}
                </InlineTableCell>
                {showSource ? (
                  <InlineTableCell className="text-muted-foreground">{item.sourceSystem ?? "—"}</InlineTableCell>
                ) : null}
                <InlineTableCell align="right" numeric className="text-muted-foreground">
                  {formatItemDate(item.date)}
                </InlineTableCell>
              </InlineTableRow>
            ))}
          </InlineTableBody>
        </InlineTable>
      )}
    </div>
  );
}

export function DailyIngestionFeed({ projectId }: { projectId: number }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["ingestion-feed", projectId],
    queryFn: () => apiFetch<IngestionFeedResponse>(`/api/projects/${projectId}/ingestion-feed`),
    staleTime: 60_000,
  });

  const limit = data?.perCategoryLimit ?? 25;
  const total =
    (data?.counts.meetings ?? 0) +
    (data?.counts.documents ?? 0) +
    (data?.counts.emails ?? 0) +
    (data?.counts.teams ?? 0);
  const capped = (c?: number) => (c ?? 0) >= limit;

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Source ingestion</p>
        <p className="text-lg font-semibold text-foreground">
          Recent activity
          <span className="ml-2 text-sm font-normal text-muted-foreground">
            {isLoading ? "" : `${total}${total >= limit ? "+" : ""} item${total === 1 ? "" : "s"}`}
          </span>
        </p>
      </div>

      {isError ? (
        <InfoAlert variant="error" role="alert">
          Could not load source ingestion for this project.
        </InfoAlert>
      ) : isLoading ? (
        <p className="py-6 text-sm text-muted-foreground">Loading ingested items…</p>
      ) : total === 0 ? (
        <EmptyState
          icon={<Calendar className="h-6 w-6" />}
          title="Nothing ingested for this project yet"
          description="Meetings, documents, emails, and Teams messages synced for this project will appear here."
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <CategoryTable
            label="Meetings"
            emptyNoun="meetings"
            icon={<Calendar className="h-4 w-4" />}
            items={data?.meetings ?? []}
            capped={capped(data?.counts.meetings)}
            trend={data?.trends.meetings ?? []}
          />
          <CategoryTable
            label="SharePoint documents"
            emptyNoun="SharePoint documents"
            icon={<FileText className="h-4 w-4" />}
            items={data?.documents ?? []}
            capped={capped(data?.counts.documents)}
            trend={data?.trends.documents ?? []}
            showSource
          />
          <CategoryTable
            label="Emails"
            emptyNoun="emails"
            icon={<Mail className="h-4 w-4" />}
            items={data?.emails ?? []}
            capped={capped(data?.counts.emails)}
            trend={data?.trends.emails ?? []}
          />
          <CategoryTable
            label="Teams messages"
            emptyNoun="Teams messages"
            icon={<MessageSquare className="h-4 w-4" />}
            items={data?.teams ?? []}
            capped={capped(data?.counts.teams)}
            trend={data?.trends.teams ?? []}
          />
        </div>
      )}
    </section>
  );
}
