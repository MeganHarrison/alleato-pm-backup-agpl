#!/usr/bin/env tsx
import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(__dirname, "../.env") });
dotenv.config({ path: resolve(__dirname, "../.env.local"), override: true });

async function main() {
  const { createServiceClient } = await import("../src/lib/supabase/service");
  const client = createServiceClient();
  
  const { data, error } = await client
    .from("daily_recaps")
    .select("*")
    .eq("recap_kind", "executive_briefing")
    .order("recap_date", { ascending: false })
    .limit(1)
    .single();
  
  if (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }
  
  const packet = data?.briefing_packet as any;
  
  console.log("=== EXECUTIVE DAILY BRIEF ===");
  console.log(`Date: ${data.recap_date}\n`);
  
  console.log("ITEMS NEEDING BRANDON'S ATTENTION:");
  (packet?.sections?.needsBrandon || []).forEach((item: any, i: number) => {
    console.log(`${i+1}. ${item.title}`);
    console.log(`   ${item.summary}`);
    if (item.recommendedAction) console.log(`   Action: ${item.recommendedAction}`);
    console.log();
  });
  
  if (packet?.sections?.importantUpdates?.length > 0) {
    console.log("\nIMPORTANT UPDATES:");
    packet.sections.importantUpdates.forEach((item: any, i: number) => {
      console.log(`${i+1}. ${item.title} - ${item.summary}`);
    });
    console.log();
  }
  
  if (packet?.financialPulse) {
    console.log("FINANCIAL PULSE:");
    console.log(`  Total Outstanding AR: $${(packet.financialPulse.totalOutstandingAR / 1000000).toFixed(2)}M`);
    console.log(`  Total Overdue AR: $${(packet.financialPulse.totalOverdueAR / 1000000).toFixed(2)}M`);
    if (packet.financialPulse.topOverdueProjects?.length > 0) {
      console.log(`  Top Overdue Projects:`);
      packet.financialPulse.topOverdueProjects.forEach((proj: any) => {
        console.log(`    - ${proj.project}: $${(proj.overdue / 1000000).toFixed(2)}M overdue`);
      });
    }
    console.log();
  }
  
  if (packet?.operatingBrief?.topExecutiveFocus?.length > 0) {
    console.log("TOP EXECUTIVE FOCUS:");
    packet.operatingBrief.topExecutiveFocus.slice(0, 5).forEach((focus: any, i: number) => {
      console.log(`${i+1}. [${focus.lane}] ${focus.item.project} - ${focus.item.title}`);
      if (focus.recommendedNextMove) console.log(`   Next: ${focus.recommendedNextMove}`);
    });
  }
}

main().catch(console.error);
