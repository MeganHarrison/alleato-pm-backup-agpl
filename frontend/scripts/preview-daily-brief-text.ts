#!/usr/bin/env tsx
/**
 * Preview the Daily Brief as plain formatted text — generates from live data
 * with the current synthesis prompt, renders the Teams text message, and prints
 * it. Does NOT write to the database or send to Teams.
 *
 * Usage: AI_PROVIDER_PATH=openai npx tsx scripts/preview-daily-brief-text.ts [windowDays]
 */
import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(__dirname, "../.env") });
dotenv.config({ path: resolve(__dirname, "../.env.local"), override: true });

async function main() {
  const windowDays = Number.parseInt(process.argv[2] ?? "3", 10);
  const { generateDailyBrief } = await import("../src/lib/executive/daily-brief");
  const { formatExecutiveBriefingTeamsMessage } = await import(
    "../src/lib/executive/executive-briefing-render"
  );

  const start = Date.now();
  const packet = await generateDailyBrief({ windowDays, preset: "brandon" });
  const ms = Date.now() - start;

  const text = formatExecutiveBriefingTeamsMessage(packet, "Brandon");

  console.log("==================== BRIEF TEXT ====================\n");
  console.log(text);
  console.log("\n==================== META ====================");
  console.log(`windowDays: ${windowDays}  generated in ${ms}ms`);
  console.log(
    `needsBrandon: ${packet.sections.needsBrandon.length}  waitingOnOthers: ${packet.sections.waitingOnOthers.length}  importantUpdates: ${packet.sections.importantUpdates.length}`,
  );
  const degraded = packet.retrievalNotes.filter((n) =>
    /source-backed fallback|synthesis failed|embedding generation failed/i.test(n),
  );
  console.log(`synthesis degraded notes: ${degraded.length}`);
  degraded.forEach((n) => console.log(`  ! ${n.slice(0, 160)}`));
}

main().catch((err) => {
  console.error("Preview failed:", err);
  process.exit(1);
});
