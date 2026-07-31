#!/usr/bin/env tsx
/**
 * One-shot script: regenerates the executive daily brief without sending to Teams.
 * Run from frontend/: npx tsx --tsconfig tsconfig.json ../scripts/generate-daily-brief.mts
 */
import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(import.meta.dirname, "../.env") });

const { regenerateExecutiveBriefingDraft } = await import(
  "@/lib/executive/executive-briefing-workflow"
);

console.log("Generating daily brief (no Teams delivery)...");
const start = Date.now();

try {
  const result = await regenerateExecutiveBriefingDraft({ windowDays: 3 });
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  const { packet } = result.draft;
  const { sections, operatingBrief } = packet;

  console.log(`\n✓ Generated in ${elapsed}s`);
  console.log(`  Recap date:    ${result.draft.recapDate}`);
  console.log(`  Brief version: ${packet.briefVersion ?? 1}`);
  console.log(`  needsBrandon:  ${sections.needsBrandon.length} items`);
  console.log(`  waitingOnOthers: ${sections.waitingOnOthers.length} items`);
  console.log(`  importantUpdates: ${sections.importantUpdates.length} items`);

  if (operatingBrief?.startHere?.length) {
    console.log(`\nStart Here:`);
    for (const line of operatingBrief.startHere) console.log(`  → ${line}`);
  }

  if (operatingBrief?.topExecutiveFocus?.length) {
    console.log(`\nTop Executive Focus (${operatingBrief.topExecutiveFocus.length} items):`);
    for (const focus of operatingBrief.topExecutiveFocus) {
      console.log(`  [${focus.lane}] ${focus.item.project} — ${focus.item.title}`);
      console.log(`    Next: ${focus.recommendedNextMove}`);
    }
  }

  if (packet.financialPulse) {
    const fp = packet.financialPulse;
    const fmt = (n: number) =>
      n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2)}M` : `$${Math.round(n / 1_000)}K`;
    console.log(`\nFinancial Pulse:`);
    console.log(`  Outstanding AR: ${fmt(fp.totalOutstandingAR)} total | ${fmt(fp.totalOverdueAR)} OVERDUE`);
    if (fp.arByProject.length > 0) {
      console.log(`  Top overdue AR:`);
      for (const ar of fp.arByProject.filter((a) => a.overdueBalance > 0).slice(0, 5)) {
        console.log(`    • ${ar.projectName}: ${fmt(ar.overdueBalance)} overdue`);
      }
    }
    if (fp.pendingCOsByProject.length > 0) {
      console.log(`  Pending COs: ${fmt(fp.totalPendingCORevenue)} revenue across ${fp.pendingCOsByProject.length} projects`);
    }
  }

  console.log(`\nSource coverage:`);
  for (const source of packet.sourceCoverage) {
    const status = source.status === "empty" ? "⚠ empty" : `${source.count} docs`;
    console.log(`  ${source.label}: ${status} (latest: ${source.latest})`);
  }

  const warnings = packet.retrievalNotes?.filter((n) => n.includes("Source health warning")) ?? [];
  if (warnings.length) {
    console.log(`\nWarnings:`);
    for (const note of warnings) console.log(`  ⚠ ${note.replace("Source health warning: ", "")}`);
  }

  console.log(`\nSaved to daily_recaps (id: ${result.draft.id})`);
} catch (err: unknown) {
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.error(`\nFailed after ${elapsed}s`);
  if (err instanceof Error) {
    console.error("Message:", err.message);
    const cause = (err as NodeJS.ErrnoException & { cause?: unknown }).cause;
    if (cause) console.error("Cause:", cause);
    console.error("Stack:", err.stack?.split("\n").slice(0, 8).join("\n"));
  } else {
    console.error(err);
  }
  process.exit(1);
}
