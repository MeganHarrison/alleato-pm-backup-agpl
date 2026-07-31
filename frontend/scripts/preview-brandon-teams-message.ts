/**
 * Preview the Teams message that would be sent to Brandon's evening brief.
 * With --fresh, regeneration goes through the AI Ops ledger.
 *
 * Usage:
 *   pnpm tsx scripts/preview-brandon-teams-message.ts [--fresh] [--days=2]
 */

import { getExecutiveBriefingDashboard } from "@/lib/executive/executive-briefing-workflow";
import { regenerateDailyBriefDraftWithLedger } from "@/lib/ai-ops/executive-daily-brief-ledger";
import { formatExecutiveBriefingTeamsMessage } from "@/lib/executive/executive-briefing-teams-delivery";

async function main() {
  const fresh = process.argv.includes("--fresh");
  const daysArg = process.argv.find((a) => a.startsWith("--days="));
  const windowDays = daysArg ? Number(daysArg.split("=")[1]) : 2;

  console.error(`[preview] fresh=${fresh} windowDays=${windowDays}`);

  const draft = fresh
    ? (
        await regenerateDailyBriefDraftWithLedger({
          windowDays,
          sourceBackedOnly: false,
          triggerType: "manual_script_preview_refresh",
          surface: "frontend/scripts/preview-brandon-teams-message.ts",
          title: "Executive Daily Brief Teams preview script refresh",
          userGoal: "Regenerate the Executive Daily Brief for a local Teams preview.",
          normalizedGoal:
            "Generate the Executive Daily Brief through the AI Ops ledger before rendering the local Teams preview.",
        })
      ).draft
    : (await getExecutiveBriefingDashboard({ windowDays })).draft;

  if (!draft) {
    console.error("[preview] No draft available. Try --fresh.");
    process.exit(1);
  }

  const message = formatExecutiveBriefingTeamsMessage(
    draft.packet,
    "Brandon",
    { now: new Date() },
  );

  process.stdout.write("\n========== TEAMS CARD (would-be-sent to Brandon) ==========\n\n");
  process.stdout.write(JSON.stringify(message, null, 2));
  process.stdout.write("\n\n========== END ==========\n");
}

main().catch((err) => {
  console.error("[preview] failed:", err);
  process.exit(1);
});
