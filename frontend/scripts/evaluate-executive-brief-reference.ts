#!/usr/bin/env tsx
import { resolve } from "node:path";
import * as dotenv from "dotenv";
import type { BrandonDailyUpdatePacket } from "../src/lib/executive/brandon-daily-update";
import {
  evaluateExecutiveBriefAgainstReference,
  formatExecutiveBriefReferenceEvalReport,
} from "../src/lib/executive/executive-brief-reference-eval";
import { createServiceClient } from "../src/lib/supabase/service";

dotenv.config({ path: resolve(process.cwd(), "../.env") });
dotenv.config({ path: resolve(process.cwd(), ".env") });
dotenv.config({ path: resolve(process.cwd(), ".env.local"), override: true });

const localEnvRoot = resolve(
  process.env.ALLEATO_LOCAL_ENV_ROOT ??
    resolve(process.env.HOME ?? "", "Documents/alleato-pm"),
);
dotenv.config({ path: resolve(localEnvRoot, ".env") });
dotenv.config({ path: resolve(localEnvRoot, "frontend/.env.local") });

function hasFlag(name: string): boolean {
  return process.argv.slice(2).includes(name);
}

function isPacketLike(value: unknown): value is BrandonDailyUpdatePacket {
  if (!value || typeof value !== "object") return false;
  const packet = value as Partial<BrandonDailyUpdatePacket>;
  return Boolean(
    packet.generatedAt &&
      packet.sections?.needsBrandon &&
      packet.sections.waitingOnOthers &&
      packet.sections.importantUpdates &&
      packet.sourceCoverage,
  );
}

async function main() {
  const client = createServiceClient();
  const { data, error } = await client
    .from("daily_recaps")
    .select("id, recap_date, briefing_packet, created_at")
    .eq("recap_kind", "executive_briefing")
    .order("recap_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error) {
    throw new Error(`Failed to load latest Executive Daily Brief: ${error.message}`);
  }

  if (!isPacketLike(data?.briefing_packet)) {
    throw new Error(
      `Latest Executive Daily Brief ${data?.id ?? "(unknown)"} does not contain a valid briefing_packet.`,
    );
  }

  const result = evaluateExecutiveBriefAgainstReference(data.briefing_packet);
  console.log(`Daily recap: ${data.id}`);
  console.log(`Recap date: ${data.recap_date}`);
  console.log(`Created at: ${data.created_at ?? "unknown"}`);
  console.log(formatExecutiveBriefReferenceEvalReport(result));

  if (!result.passed && !hasFlag("--soft")) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
