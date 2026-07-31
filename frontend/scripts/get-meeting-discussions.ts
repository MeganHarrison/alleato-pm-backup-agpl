#!/usr/bin/env tsx
import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(__dirname, "../.env") });
dotenv.config({ path: resolve(__dirname, "../.env.local"), override: true });

async function main() {
  const { createServiceClient } = await import("../src/lib/supabase/service");
  const client = createServiceClient();
  
  // Get today's date in UTC
  const today = new Date().toISOString().split('T')[0];
  console.log(`Looking for meetings on ${today}...\n`);
  
  // Try to find meetings created/updated today (they might be synced from Graph)
  const { data: meetings, error: meError } = await client
    .from("meetings")
    .select("id, title, meeting_date, summary, key_decisions, action_items, transcript_excerpt")
    .gte("created_at", today + "T00:00:00")
    .order("meeting_date", { ascending: false });
  
  if (meError) {
    console.error("Meetings error:", meError.message);
  } else if (meetings && meetings.length > 0) {
    console.log("=== TODAY'S MEETING DISCUSSIONS ===\n");
    meetings.forEach((meeting: any, i: number) => {
      console.log(`${i+1}. ${meeting.title}`);
      if (meeting.meeting_date) {
        const date = new Date(meeting.meeting_date);
        console.log(`   Time: ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}`);
      }
      if (meeting.summary) console.log(`   Summary: ${meeting.summary}`);
      if (meeting.key_decisions) console.log(`   Decisions: ${meeting.key_decisions}`);
      if (meeting.action_items) console.log(`   Actions: ${meeting.action_items}`);
      if (meeting.transcript_excerpt) console.log(`   Excerpt: ${meeting.transcript_excerpt}`);
      console.log();
    });
  } else {
    console.log("No meetings found with today's creation date.\n");
    console.log("Checking for meetings scheduled for today...\n");
    
    // Try a different approach - meetings scheduled for today
    const { data: scheduled } = await client
      .from("meetings")
      .select("id, title, meeting_date, summary, key_decisions, action_items")
      .gte("meeting_date", today + "T00:00:00")
      .lte("meeting_date", today + "T23:59:59")
      .order("meeting_date", { ascending: false });
    
    if (scheduled && scheduled.length > 0) {
      console.log("=== TODAY'S SCHEDULED MEETINGS ===\n");
      scheduled.forEach((meeting: any, i: number) => {
        console.log(`${i+1}. ${meeting.title}`);
        const date = new Date(meeting.meeting_date);
        console.log(`   Time: ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}`);
        if (meeting.summary) console.log(`   Summary: ${meeting.summary}`);
        if (meeting.key_decisions) console.log(`   Decisions: ${meeting.key_decisions}`);
        if (meeting.action_items) console.log(`   Actions: ${meeting.action_items}`);
        console.log();
      });
    } else {
      console.log("No meetings scheduled for today.\n");
      console.log("Note: The brief gets meeting information from the Teams/Outlook sync pipeline.");
      console.log("Meetings are processed and their insights are extracted into the brief items.\n");
    }
  }
  
  // Show recent Fireflies recordings instead
  console.log("\n=== FIREFLIES MEETING RECORDINGS (Last 7 days) ===\n");
  const { data: fireflies } = await client
    .from("fireflies_meetings")
    .select("id, meeting_name, date, summary, action_items")
    .gte("date", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
    .order("date", { ascending: false })
    .limit(5);
  
  if (fireflies && fireflies.length > 0) {
    fireflies.forEach((ff: any, i: number) => {
      console.log(`${i+1}. ${ff.meeting_name}`);
      console.log(`   Date: ${new Date(ff.date).toLocaleDateString()}`);
      if (ff.summary) {
        const summary = ff.summary.substring(0, 200);
        console.log(`   Summary: ${summary}${ff.summary.length > 200 ? '...' : ''}`);
      }
      if (ff.action_items) console.log(`   Action Items: ${ff.action_items}`);
      console.log();
    });
  }
}

main().catch(console.error);
