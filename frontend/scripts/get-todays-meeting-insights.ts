#!/usr/bin/env tsx
import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(__dirname, "../.env") });
dotenv.config({ path: resolve(__dirname, "../.env.local"), override: true });

async function main() {
  const { createServiceClient } = await import("../src/lib/supabase/service");
  const client = createServiceClient();
  
  const today = new Date().toISOString().split('T')[0];
  console.log(`Fetching meeting insights from today (${today})...\n`);
  
  // Get documents that are meetings from today
  const { data: meetingDocs, error } = await client
    .from("document_metadata")
    .select("id, title, document_type, created_at, metadata")
    .eq("document_type", "meeting")
    .gte("created_at", today + "T00:00:00")
    .order("created_at", { ascending: false });
  
  if (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }
  
  if (!meetingDocs || meetingDocs.length === 0) {
    console.log("No meeting documents found for today.\n");
    console.log("The executive brief extracts discussion points from:");
    console.log("  • Email conversations");
    console.log("  • Teams messages and threads");
    console.log("  • Meeting transcripts and recordings");
    console.log("  • Documents and file uploads\n");
    console.log("These are compiled into actionable brief items organized by:");
    console.log("  • What Changed (recent scope/schedule/staffing updates)");
    console.log("  • Open Decisions (unresolved choices)");
    console.log("  • Risks and Exposure (what could go wrong)");
    console.log("  • Recommended Actions (what Brandon should do next)\n");
    return;
  }
  
  console.log("=== TODAY'S MEETING DISCUSSION SUMMARIES ===\n");
  
  meetingDocs.forEach((doc: any, i: number) => {
    console.log(`${i + 1}. ${doc.title}`);
    console.log(`   Type: Meeting`);
    console.log(`   Recorded: ${new Date(doc.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}`);
    
    if (doc.metadata) {
      const meta = typeof doc.metadata === 'string' ? JSON.parse(doc.metadata) : doc.metadata;
      
      if (meta.summary) console.log(`   Summary: ${meta.summary.substring(0, 300)}${meta.summary.length > 300 ? '...' : ''}`);
      if (meta.attendees) console.log(`   Attendees: ${meta.attendees}`);
      if (meta.duration) console.log(`   Duration: ${meta.duration}`);
      if (meta.key_topics) console.log(`   Key Topics: ${meta.key_topics}`);
    }
    console.log();
  });
}

main().catch(console.error);
