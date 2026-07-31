"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { RefreshCw, Play, SlidersHorizontal, ArrowRight } from "lucide-react";

import { Button } from "@/components/ds";
import { SectionRuleHeading } from "@/components/layout/spacing";
import type { ClientProjectIntelligencePacket } from "@/lib/ai/intelligence/types";

type TimelineEvent = { id: string; event_at: string; title: string; summary: string | null; current_status: string };
type ProjectTask = { id: string; title: string | null; status: string | null; due_date: string | null; assignee_name: string | null };
type ReportSuggestion = { id: string; report_type: string; title: string; business_date: string | null; week_start_date: string | null; status: string };

function dateLabel(value: string | null) {
  if (!value) return "Not dated";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not dated" : date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** A compact, review-first control surface for the project intelligence workflow. */
export function ProjectIntelligenceWorkflow({
  projectId,
  packet,
  timelineEvents,
  tasks,
  reportSuggestions,
}: {
  projectId: number;
  packet: ClientProjectIntelligencePacket | null;
  timelineEvents: TimelineEvent[];
  tasks: ProjectTask[];
  reportSuggestions: ReportSuggestion[];
}) {
  const router = useRouter();
  const freshness = packet?.freshnessStatus ?? "not generated";
  const recommendations = packet?.recommendedNextMoves?.filter(Boolean).slice(0, 4) ?? [];
  const timeline = timelineEvents.slice(0, 5);
  const openTasks = tasks.filter((task) => task.status !== "completed").slice(0, 5);
  const weeklyReports = reportSuggestions.filter((report) => report.report_type.includes("weekly")).slice(0, 3);

  return (
    <section aria-labelledby="intelligence-workflow" className="space-y-5 border-y border-border/60 py-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div id="intelligence-workflow"><SectionRuleHeading label="Review and move the work forward" /></div>
          <p className="mt-1 text-sm text-muted-foreground">One place to check the run, validate the report, and hand off the next action.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => router.refresh()}><RefreshCw className="mr-1.5 h-3.5 w-3.5" />Retry run</Button>
          <Button asChild size="sm" variant="outline"><Link href="/daily-brief"><Play className="mr-1.5 h-3.5 w-3.5" />Resume review</Link></Button>
          <Button asChild size="sm" variant="outline"><Link href={`/${projectId}/progress-reports`}><SlidersHorizontal className="mr-1.5 h-3.5 w-3.5" />Refine report</Link></Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <div className="space-y-3">
          <div className="flex items-center justify-between"><SectionRuleHeading label="Run status" className="mb-0" /><span className="text-xs capitalize text-foreground">{freshness.replace(/_/g, " ")}</span></div>
          <p className="text-sm leading-6 text-muted-foreground">{packet?.executiveSummary || "No full report is available yet. Retry the run or resume from the daily brief."}</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground"><span>{packet ? `Compiled ${dateLabel(packet.generatedAt)}` : "Awaiting packet"}</span><span>{packet?.recommendedNextMoves?.length ?? 0} recommendations</span><span>{tasks.length} tasks</span></div>
        </div>

        <div className="space-y-3"><SectionRuleHeading label="Concise projection" className="mb-0" /><p className="text-sm leading-6 text-foreground">{packet?.currentStatus || packet?.strategicRead || "The controlled projection will appear when the next packet is generated."}</p><Link className="inline-flex items-center text-sm font-medium text-primary hover:underline" href={`/${projectId}/intelligence#what-changed`}>Open full report <ArrowRight className="ml-1 h-3.5 w-3.5" /></Link></div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-2"><SectionRuleHeading label="Packet timeline" className="mb-0" />{timeline.length ? timeline.map((event) => <div key={event.id} className="border-l border-border pl-3"><p className="text-sm text-foreground">{event.title}</p><p className="text-xs text-muted-foreground">{dateLabel(event.event_at)} · {event.current_status}</p></div>) : <p className="text-sm text-muted-foreground">No packet events recorded.</p>}</div>
        <div className="space-y-2"><SectionRuleHeading label="Tasks and responsibilities" className="mb-0" />{openTasks.length ? openTasks.map((task) => <Link key={task.id} href={`/${projectId}/tasks`} className="block border-b border-border/60 pb-2 text-sm hover:text-primary"><span className="text-foreground">{task.title}</span><span className="ml-2 text-xs text-muted-foreground">{task.assignee_name || "Unassigned"} · {dateLabel(task.due_date)}</span></Link>) : <p className="text-sm text-muted-foreground">No open tasks in the projection.</p>}</div>
        <div className="space-y-2"><SectionRuleHeading label="Reports and recommendations" className="mb-0" />{weeklyReports.map((report) => <Link key={report.id} href={`/${projectId}/progress-reports`} className="block border-b border-border/60 pb-2 text-sm text-foreground hover:text-primary">{report.title}<span className="ml-2 text-xs text-muted-foreground">{report.status}</span></Link>)}{recommendations.map((item) => <p key={item} className="text-sm leading-5 text-muted-foreground">{item}</p>)}{weeklyReports.length === 0 && recommendations.length === 0 ? <p className="text-sm text-muted-foreground">No report suggestions yet.</p> : null}</div>
      </div>
    </section>
  );
}
