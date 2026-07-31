#!/usr/bin/env tsx
import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(__dirname, "../.env") });
dotenv.config({ path: resolve(__dirname, "../.env.local"), override: true });

async function main() {
  const { regenerateDailyBriefDraftWithLedger } = await import(
    "../src/lib/ai-ops/executive-daily-brief-ledger"
  );

  const start = Date.now();
  const { draft, runId } = await regenerateDailyBriefDraftWithLedger({
    windowDays: 3,
    sourceBackedOnly: false,
    triggerType: "manual_script_regeneration",
    surface: "frontend/scripts/regenerate-executive-briefing.ts",
    title: "Executive Daily Brief script regeneration",
    userGoal: "Regenerate the Executive Daily Brief from the local script.",
    normalizedGoal:
      "Generate the Executive Daily Brief through the AI Ops ledger from the local script.",
  });
  const ms = Date.now() - start;

  const allItems = [
    ...draft.packet.sections.needsBrandon,
    ...draft.packet.sections.waitingOnOthers,
    ...draft.packet.sections.importantUpdates,
  ];
  const multiCitation = allItems.filter((item) => item.citations.length > 1);

  console.log(`✓ Regenerated draft ${draft.id} for ${draft.recapDate} in ${ms}ms`);
  console.log(`  aiWorkRunId: ${runId}`);
  console.log(`  needsBrandon: ${draft.packet.sections.needsBrandon.length}`);
  console.log(`  waitingOnOthers: ${draft.packet.sections.waitingOnOthers.length}`);
  console.log(`  importantUpdates: ${draft.packet.sections.importantUpdates.length}`);
  console.log(`  total items: ${allItems.length}`);
  console.log(`  multi-citation items: ${multiCitation.length}`);
  for (const item of multiCitation) {
    console.log(`    - ${item.title} [${item.citations.length} sources]`);
    for (const citation of item.citations) {
      console.log(`        ${citation.source} :: ${citation.sourceDetail} :: ${citation.sourceUrl ?? "(no url)"}`);
    }
  }
}

main().catch((err) => {
  console.error("Regeneration failed:", err);
  process.exit(1);
});
