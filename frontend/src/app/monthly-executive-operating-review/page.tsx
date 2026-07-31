import { AppCapabilityAccessDenied } from "@/components/guards/app-capability-access-denied";
import { GovernedExecutiveArtifactStatus } from "@/components/executive/governed-executive-artifact-status";
import { MonthlyExecutiveReviewSection } from "@/components/executive/monthly-executive-review";
import { ExecutivePortfolioStateSection } from "@/components/executive/executive-portfolio-state";
import { PageContainer, PageShell, SectionRuleHeading } from "@/components/layout";
import { loadCurrentUserExecutiveVisibility } from "@/lib/executive/executive-visibility";
import { loadAppCapabilityAccessForUser } from "@/lib/app-capabilities";
import { loadMonthlyExecutiveReview } from "@/lib/executive/monthly-executive-review";
import { loadGovernedExecutiveArtifact } from "@/lib/executive/governed-executive-artifact";
import { getCurrentUser } from "@/lib/auth/current-user";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function MonthlyExecutiveOperatingReviewPage() {
  const visibility = await loadCurrentUserExecutiveVisibility();
  if (visibility !== "detail") return <AppCapabilityAccessDenied title="Monthly Executive Operating Review" description="Monthly Executive Operating Review contains governed portfolio, financial, approval, and delivery detail and requires executive detail access." />;
  const artifact = await loadGovernedExecutiveArtifact("monthly");
  const review = await loadMonthlyExecutiveReview(artifact);
  const user = await getCurrentUser();
  const access = user ? await loadAppCapabilityAccessForUser(user.id) : null;
  return <PageShell variant="detail" title="Monthly Executive Operating Review">
    <PageContainer className="space-y-8">
      <section className="space-y-2"><p className="text-sm text-muted-foreground">A governed consumer of the shared portfolio state. This route never generates a separate report or delivery ledger.</p><GovernedExecutiveArtifactStatus artifact={artifact} /></section>
      <MonthlyExecutiveReviewSection initialReview={review} canGovern={access?.isAdmin === true} />
      <section className="space-y-3"><SectionRuleHeading label="Portfolio state" /><ExecutivePortfolioStateSection portfolio={review.portfolio} /></section>
    </PageContainer>
  </PageShell>;
}
