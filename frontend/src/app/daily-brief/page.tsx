import { JetBrains_Mono } from "next/font/google";

import { AppCapabilityAccessDenied } from "@/components/guards/app-capability-access-denied";
import { PageShell } from "@/components/layout";
import { loadCurrentUserExecutiveVisibility } from "@/lib/executive/executive-visibility";
import { buildExecutiveBriefViewModel } from "@/lib/daily-briefs/brief-view-model";
import { loadGovernedExecutiveArtifact } from "@/lib/executive/governed-executive-artifact";

import { ExecutiveBriefView } from "../(main)/executive/intelligence-brief/executive-brief-view";
import "../(main)/executive/intelligence-brief/brief.css";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const monoFont = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500", "700"], variable: "--font-brief-mono", display: "swap" });
const fontClassName = monoFont.variable;

export default async function DailyBriefPage() {
  const visibility = await loadCurrentUserExecutiveVisibility();
  if (!visibility) return <AppCapabilityAccessDenied title="Daily Brief" description="Daily Brief is limited to users with executive briefing access." />;

  const artifact = await loadGovernedExecutiveArtifact("daily");
  if (visibility === "summary") {
    return <PageShell variant="detail" title="Daily Brief">
      <p className="text-sm text-muted-foreground">This role can confirm the current governed briefing is available, but cannot view claims, evidence, named actions, or artifacts.</p>
      <p className="mt-3 text-sm text-muted-foreground">Packet date: {artifact.packet.businessDate} · Integrity: {artifact.integrity}</p>
    </PageShell>;
  }
  const model = buildExecutiveBriefViewModel(artifact.packet);
  return <PageShell variant="table" title="Daily Brief" showHeader={false} containerPaddingClassName="p-0" contentClassName="p-0">
    <ExecutiveBriefView model={model} fontClassName={fontClassName} governedArtifact={artifact} />
  </PageShell>;
}
