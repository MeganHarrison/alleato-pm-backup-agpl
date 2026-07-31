import { notFound } from "next/navigation";

import { AppCapabilityAccessDenied } from "@/components/guards/app-capability-access-denied";
import { PageShell } from "@/components/layout";
import { BriefMarkdown } from "@/features/daily-briefs/brief-markdown";
import { loadCurrentUserExecutiveVisibility } from "@/lib/executive/executive-visibility";
import {
  hasCompleteDailyBriefMarkdown,
  loadDailyExecutiveBriefPacketById,
} from "@/lib/daily-briefs/canonical-packets";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type PageProps = { params: Promise<{ briefId: string }> };

export default async function DailyBriefDetailPage({ params }: PageProps) {
  const visibility = await loadCurrentUserExecutiveVisibility();
  if (visibility !== "detail") {
    return <AppCapabilityAccessDenied title="Daily Brief history" description="Daily Brief history requires executive detail access because historic packets contain claims, evidence, and artifacts." />;
  }

  const { briefId } = await params;
  const packet = await loadDailyExecutiveBriefPacketById(briefId);
  if (!packet) notFound();

  if (!hasCompleteDailyBriefMarkdown(packet.briefMarkdown)) {
    throw new Error(`Daily Brief ${briefId} is missing its complete executive report.`);
  }

  // The landing route owns the designed executive summary. An individual
  // packet route is the durable artifact reader and must render the complete
  // persisted report. The stored H1 duplicates PageShell's title, so remove
  // only that heading while preserving every report section and citation.
  const reportContent = packet.briefMarkdown.replace(/^#\s+[^\n]+\n+/, "");

  return (
    <PageShell variant="content" title={packet.title} contentClassName="pb-16">
      <article className="max-w-3xl">
        <BriefMarkdown content={reportContent} sources={packet.sources} />
      </article>
    </PageShell>
  );
}
