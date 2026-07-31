import Link from "next/link";
import { notFound } from "next/navigation";

import { requireAdmin } from "@/app/api/admin/_shared";
import { PageShell } from "@/components/layout";
import { loadDailyBriefFanoutReadback } from "@/lib/daily-briefs/fanout-readback";

import { DailyBriefFanoutReview } from "./fanout-client";

export const dynamic = "force-dynamic";

export default async function DailyBriefFanoutPage({ params }: { params: Promise<{ briefId: string }> }) {
  await requireAdmin("daily-brief-fanout-page");
  const { briefId } = await params;
  const run = await loadDailyBriefFanoutReadback(briefId).catch((error) => {
    if (String(error).includes("not found")) notFound();
    throw error;
  });
  if (!run) notFound();

  return <PageShell variant="table" title={`Daily Brief · ${run.packet.businessDate}`}>
    <div className="space-y-8">
      <section className="flex flex-wrap items-center justify-between gap-4 border-b border-border/50 pb-6">
        <div>
          <p className="text-sm text-muted-foreground">Canonical packet review for this day.</p>
          <p className="mt-1 text-sm text-muted-foreground">{run.sources.length} sources · {run.insightCardCount} insight cards · {run.tasks.length} tasks</p>
        </div>
        <div className="flex flex-wrap gap-4 text-sm">
          <Link className="text-primary underline-offset-4 hover:underline" href={`/api/executive/daily-brief/${run.packet.id}/markdown`} target="_blank">Open written brief</Link>
          <Link className="text-primary underline-offset-4 hover:underline" href={`/daily-briefs/${run.packet.id}`} target="_blank">Open full report</Link>
        </div>
      </section>
      <DailyBriefFanoutReview run={run} />
    </div>
  </PageShell>;
}
