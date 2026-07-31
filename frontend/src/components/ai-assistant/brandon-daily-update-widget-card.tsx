"use client";

import Link from "next/link";
import { ArrowRight, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SectionRuleHeading } from "@/components/layout";
import { AiResponseFeedback } from "@/components/ai/AiResponseFeedback";
import type {
  BrandonBriefItem,
  BrandonDailyUpdatePacket,
  ExecutiveOperatingBrief,
} from "@/lib/executive/brandon-daily-update";
import { cn } from "@/lib/utils";

type Tone = NonNullable<BrandonBriefItem["tone"]>;

const toneStyles: Record<Tone, string> = {
  neutral: "bg-muted text-muted-foreground border-transparent",
  good: "bg-primary/10 text-primary border-primary/20",
  watch: "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800/40",
  risk: "bg-destructive/10 text-destructive border-destructive/20",
};

function formatGeneratedAt(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function metricTone(count: number, variant: "danger" | "warning" | "info"): string {
  if (variant === "danger") return count > 0 ? "text-destructive" : "text-muted-foreground";
  if (variant === "warning") return count > 0 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground";
  return count > 0 ? "text-primary" : "text-muted-foreground";
}

function Section({
  title,
  items,
}: {
  title: string;
  items: BrandonBriefItem[];
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <SectionRuleHeading label={title} className="mb-0 pb-0" />
        <Badge variant="outline">{items.length}</Badge>
      </div>
      {items.length > 0 ? (
        <div className="space-y-2">
          {items.map((item) => (
            <article
              key={`${item.sourceId ?? item.title}-${item.date}`}
              className="rounded-xl bg-background/60 px-3 py-3"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 space-y-1">
                  <div className="text-sm font-semibold leading-5 text-foreground">{item.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {[item.project, item.date].filter(Boolean).join(" • ")}
                  </div>
                </div>
                {item.status ? (
                  <span
                    className={cn(
                      "inline-flex w-fit items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
                      toneStyles[item.tone ?? "neutral"],
                    )}
                  >
                    {item.status}
                  </span>
                ) : null}
              </div>
              {item.recommendedAction ? (
                <div className="mt-3 border-l-2 border-foreground/20 pl-3 text-sm leading-6 text-foreground">
                  <span className="font-medium">Next move: </span>
                  <span>{item.recommendedAction}</span>
                </div>
              ) : null}
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.summary}</p>
              {item.bullets.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {item.bullets.slice(0, 2).map((bullet) => (
                    <span
                      key={bullet}
                      className="inline-flex max-w-full rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground"
                    >
                      {bullet}
                    </span>
                  ))}
                </div>
              ) : null}
              {(Array.isArray(item.citations) && item.citations.length > 0) || item.sourceUrl ? (
                <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  {(Array.isArray(item.citations) && item.citations.length > 0
                    ? item.citations
                    : [{
                        source: item.source,
                        sourceDetail: item.sourceDetail,
                        sourceUrl: item.sourceUrl,
                        sourceId: item.sourceId,
                        evidence: item.evidence,
                        date: item.date,
                      }]
                  ).slice(0, 3).map((citation, idx) => (
                    <div
                      key={`${citation.sourceId ?? citation.sourceUrl ?? citation.sourceDetail}-${idx}`}
                      className="flex min-w-0 flex-wrap items-center gap-1"
                    >
                      <span className="font-medium text-foreground">{citation.source}</span>
                      {citation.sourceDetail ? <span>· {citation.sourceDetail}</span> : null}
                      {citation.sourceUrl ? (
                        <a
                          href={citation.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 font-medium text-foreground underline-offset-4 hover:underline"
                        >
                          View source
                          <ArrowRight className="h-3 w-3" />
                        </a>
                      ) : null}
                    </div>
                  ))}
                  {Array.isArray(item.citations) && item.citations.length > 3 ? (
                    <span>{item.citations.length - 3} more source(s)</span>
                  ) : null}
                </div>
              ) : null}
            </article>
          ))}
        </div>
      ) : (
        <div className="rounded-xl bg-background/60 px-4 py-3 text-sm text-muted-foreground">
          No current items in this section.
        </div>
      )}
    </section>
  );
}

function TopFocus({
  brief,
}: {
  brief: ExecutiveOperatingBrief;
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <SectionRuleHeading label="Top executive focus" className="mb-0 pb-0" />
        <Badge variant="outline">{brief.topExecutiveFocus.length}</Badge>
      </div>
      <div className="space-y-2">
        {brief.topExecutiveFocus.map((entry) => (
          <article
            key={`${entry.item.sourceId ?? entry.item.title}-${entry.item.date}`}
            className="rounded-xl bg-background/60 px-3 py-3"
          >
            <div className="text-sm font-semibold leading-5 text-foreground">
              {entry.item.title}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {[entry.item.project, entry.owner ? `Owner: ${entry.owner}` : null]
                .filter(Boolean)
                .join(" • ")}
            </div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {entry.recommendedNextMove}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

export function BrandonDailyUpdateWidgetCard({
  packet,
}: {
  packet: BrandonDailyUpdatePacket;
}) {
  const brief = packet.operatingBrief;
  const firstAction =
    brief?.topExecutiveFocus[0]?.item ??
    packet.sections.needsBrandon[0] ??
    packet.sections.waitingOnOthers[0] ??
    null;
  const startHere = brief?.startHere.join(" ");

  return (
    <div className="mb-4 rounded-xl bg-muted/40 p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-base font-semibold text-foreground">
            CEO Operating Brief for Brandon
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {startHere ??
              "What needs a decision, what is blocked on others, and what changed across the business."}
          </p>
          <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
            <span>
              Updated {formatGeneratedAt(packet.generatedAt)} • last {packet.windowDays} day(s)
            </span>
            <AiResponseFeedback
              subject={{
                surface: "daily_digest",
                subjectType: "ceo_daily_brief",
                subjectId: packet.generatedAt, // generation timestamp is the natural id
                projectId: null,
                sessionId: null,
                contentSnapshot: {
                  text: [
                    brief?.startHere.join(" ") ?? "",
                    ...(brief?.topExecutiveFocus ?? []).map((f) => f.item),
                  ]
                    .filter(Boolean)
                    .join("\n\n")
                    .slice(0, 1500),
                  generatedAt: packet.generatedAt,
                },
              }}
            />
          </div>
        </div>
        <Link
          href="/daily-briefs"
          className="inline-flex items-center gap-1 text-sm font-medium text-foreground underline-offset-4 hover:underline"
        >
          Open Daily Briefs
          <FileText className="h-4 w-4" />
        </Link>
      </div>

      {firstAction ? (
        <div className="mt-4 border-l-2 border-destructive/40 pl-3">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Start here
          </div>
          <div className="mt-1 text-sm font-semibold leading-5 text-foreground">
            {firstAction.title}
          </div>
          {firstAction.recommendedAction ? (
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {firstAction.recommendedAction}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="mt-4 grid grid-cols-3 gap-1 rounded-xl bg-background/60 p-1">
        <div className="rounded-lg bg-muted/40 px-3 py-2">
          <div className={cn("text-lg font-semibold", metricTone(packet.sections.needsBrandon.length, "danger"))}>
            {packet.sections.needsBrandon.length}
          </div>
          <div className="text-xs text-muted-foreground">Needs Brandon</div>
        </div>
        <div className="rounded-lg bg-muted/40 px-3 py-2">
          <div className={cn("text-lg font-semibold", metricTone(packet.sections.waitingOnOthers.length, "warning"))}>
            {packet.sections.waitingOnOthers.length}
          </div>
          <div className="text-xs text-muted-foreground">Waiting</div>
        </div>
        <div className="rounded-lg bg-muted/40 px-3 py-2">
          <div className={cn("text-lg font-semibold", metricTone(packet.sections.importantUpdates.length, "info"))}>
            {packet.sections.importantUpdates.length}
          </div>
          <div className="text-xs text-muted-foreground">Updates</div>
        </div>
      </div>

      <div className="mt-5 space-y-6">
        {brief ? <TopFocus brief={brief} /> : null}
        {brief && brief.recommendedMoves.length > 0 ? (
          <section className="space-y-2">
            <SectionRuleHeading label="Recommended moves" className="mb-0 pb-0" />
            <ol className="space-y-2 text-sm leading-6 text-muted-foreground">
              {brief.recommendedMoves.map((move, index) => (
                <li key={`${move}-${index}`}>
                  {index + 1}. {move}
                </li>
              ))}
            </ol>
          </section>
        ) : null}
        <Section title="Others waiting on Brandon" items={packet.sections.needsBrandon} />
        <Section title="Things he is waiting on" items={packet.sections.waitingOnOthers} />
        <Section title="Critical business updates" items={packet.sections.importantUpdates} />
      </div>
    </div>
  );
}
