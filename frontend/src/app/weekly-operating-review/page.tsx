import { AppCapabilityAccessDenied } from "@/components/guards/app-capability-access-denied";
import { GovernedExecutiveArtifactStatus } from "@/components/executive/governed-executive-artifact-status";
import { ExecutivePortfolioStateSection } from "@/components/executive/executive-portfolio-state";
import { PageContainer, PageShell, SectionRuleHeading } from "@/components/layout";
import { loadCurrentUserExecutiveVisibility } from "@/lib/executive/executive-visibility";
import { loadGovernedExecutiveArtifact } from "@/lib/executive/governed-executive-artifact";
import { loadExecutivePortfolioState } from "@/lib/executive/executive-portfolio-state";
import { isExecutiveAttentionActionable } from "@/lib/executive/executive-attention";
import { isExecutiveConflictActionable } from "@/lib/executive/executive-conflicts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function WeeklyOperatingReviewPage() {
  const visibility = await loadCurrentUserExecutiveVisibility();
  if (!visibility) return <AppCapabilityAccessDenied title="Weekly Operating Review" description="Weekly Operating Review is limited to users with executive briefing access." />;
  const artifact = await loadGovernedExecutiveArtifact("weekly");
  if (visibility === "summary") {
    return <PageShell variant="detail" title="Weekly Operating Review">
      <PageContainer className="space-y-3">
        <p className="text-sm text-muted-foreground">This role can confirm that the governed operating review is available, but cannot view project state, named actions, claims, source evidence, or delivery artifacts.</p>
        <p className="text-sm text-muted-foreground">Current packet: {artifact.packet.businessDate} · Integrity: {artifact.integrity}</p>
      </PageContainer>
    </PageShell>;
  }
  const portfolio = await loadExecutivePortfolioState({ state: artifact.state, executive: artifact.executive, governedArtifactVersionId: artifact.id });
  const openAttention = artifact.executive?.attention.filter((item) => isExecutiveAttentionActionable(item.lifecycle)) ?? [];
  const openConflicts = artifact.executive?.conflicts.filter((item) => isExecutiveConflictActionable(item.status)) ?? [];
  return <PageShell variant="detail" title="Weekly Operating Review">
    <PageContainer className="space-y-8">
      <section className="space-y-2">
        <p className="text-sm text-muted-foreground">Current governed review for packet {artifact.packet.businessDate}. This view is pinned to an immutable version and will never substitute healthy-looking content for stale critical inputs.</p>
        <GovernedExecutiveArtifactStatus artifact={artifact} />
      </section>
      <section className="space-y-3">
        <SectionRuleHeading label="Open executive action" />
        {openAttention.length || openConflicts.length ? <ul className="divide-y divide-border">
          {openAttention.map((item) => <li key={item.id} className="py-3"><p className="font-medium">{item.title}</p><p className="text-sm text-muted-foreground">{item.accountableOwnerLabel} · {item.priority} · {item.lifecycle}</p></li>)}
          {openConflicts.map((item) => <li key={item.id} className="py-3"><p className="font-medium">Conflict: {item.subject}</p><p className="text-sm text-muted-foreground">{item.resolver} · due {item.dueAt} · {item.priority}</p></li>)}
        </ul> : <p className="text-sm text-muted-foreground">No open attention or conflicts are recorded for this governed version.</p>}
      </section>
      <ExecutivePortfolioStateSection portfolio={portfolio} />
    </PageContainer>
  </PageShell>;
}
