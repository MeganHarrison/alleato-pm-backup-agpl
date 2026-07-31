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
  
  console.log("ITEMS NEEDING BRANDON'S ATTENTION:\n");
  (packet?.sections?.needsBrandon || []).forEach((item: any, i: number) => {
    console.log(`${i+1}. ${item.title}`);
    console.log(`   ${item.summary}`);
    if (item.recommendedAction) console.log(`   Action: ${item.recommendedAction}`);
    
    // Show sources
    if (item.citations && item.citations.length > 0) {
      console.log(`   Sources:`);
      item.citations.forEach((cite: any) => {
        const sourceDetail = cite.sourceDetail ? ` — ${cite.sourceDetail}` : '';
        console.log(`     • ${cite.source}${sourceDetail}`);
      });
    }
    console.log();
  });
  
  if (packet?.sections?.importantUpdates?.length > 0) {
    console.log("\nIMPORTANT UPDATES:\n");
    packet.sections.importantUpdates.forEach((item: any, i: number) => {
      console.log(`${i+1}. ${item.title}`);
      console.log(`   ${item.summary}`);
      
      if (item.citations && item.citations.length > 0) {
        console.log(`   Sources:`);
        item.citations.forEach((cite: any) => {
          const sourceDetail = cite.sourceDetail ? ` — ${cite.sourceDetail}` : '';
          console.log(`     • ${cite.source}${sourceDetail}`);
        });
      }
      console.log();
    });
  }
  
  // Meeting summaries
  console.log("\n=== TODAY'S MEETING HIGHLIGHTS ===\n");
  const meetings = await client
    .from("meetings")
    .select("*")
    .gte("meeting_date", data.recap_date + "T00:00:00")
    .lte("meeting_date", data.recap_date + "T23:59:59")
    .order("meeting_date", { ascending: false });
  
  if (meetings.data && meetings.data.length > 0) {
    meetings.data.forEach((meeting: any, i: number) => {
      console.log(`${i+1}. ${meeting.title || "Untitled Meeting"}`);
      if (meeting.attendees) console.log(`   Attendees: ${meeting.attendees}`);
      if (meeting.start_time) {
        const time = new Date(meeting.meeting_date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        console.log(`   Time: ${time}`);
      }
      if (meeting.summary) console.log(`   Summary: ${meeting.summary}`);
      if (meeting.action_items) console.log(`   Action Items: ${meeting.action_items}`);
      console.log();
    });
  } else {
    console.log("No meetings recorded for today.\n");
  }
  
  // Financial data
  if (packet?.financialPulse) {
    console.log("\n=== FINANCIAL PULSE ===\n");
    console.log(`Total Outstanding AR: $${(packet.financialPulse.totalOutstandingAR / 1000000).toFixed(2)}M`);
    console.log(`Total Overdue AR: $${(packet.financialPulse.totalOverdueAR / 1000000).toFixed(2)}M`);
    if (packet.financialPulse.pendingCORevenue) {
      console.log(`Pending CO Revenue: $${(packet.financialPulse.pendingCORevenue / 1000000).toFixed(2)}M`);
    }
    if (packet.financialPulse.topOverdueProjects?.length > 0) {
      console.log(`\nTop Overdue Projects:`);
      packet.financialPulse.topOverdueProjects.forEach((proj: any) => {
        console.log(`  • ${proj.project}: $${(proj.overdue / 1000000).toFixed(2)}M overdue`);
      });
    }
    console.log();
  }
}

main().catch(console.error);
