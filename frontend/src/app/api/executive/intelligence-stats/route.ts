export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { requireCurrentUserAppCapability } from "@/lib/app-capabilities";
import { serviceDb } from "@/lib/supabase/service-db";

const WINDOW_DAYS = 7;

function cutoffIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - (days - 1));
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export const GET = withApiGuardrails(
  "/api/executive/intelligence-stats#GET",
  async () => {
    await requireCurrentUserAppCapability(
      "view_executive_briefing",
      "/api/executive/intelligence-stats#GET",
      "Executive briefing access required.",
    );

        const since = cutoffIso(WINDOW_DAYS);

    const [
      { count: meetingCount },
      { count: emailCount },
      { count: teamsCount },
      { count: openAlertCount },
      { data: alerts },
    ] = await Promise.all([
      serviceDb.from("document_metadata")
        .select("id", { count: "exact", head: true })
        .eq("type", "meeting")
        .or(`date.gte.${since},created_at.gte.${since},captured_at.gte.${since}`),
      serviceDb.from("document_metadata")
        .select("id", { count: "exact", head: true })
        .eq("category", "email")
        .or(`date.gte.${since},created_at.gte.${since},captured_at.gte.${since}`),
      serviceDb.from("document_metadata")
        .select("id", { count: "exact", head: true })
        .eq("category", "teams_message")
        .or(`date.gte.${since},created_at.gte.${since},captured_at.gte.${since}`),
      serviceDb.from("executive_briefing_follow_ups")
        .select("id", { count: "exact", head: true })
        .eq("state", "open"),
      serviceDb.from("executive_briefing_follow_ups")
        .select("id,title,summary,section,tone,owner,project_label,source_type,source_date,recommended_action,state,first_seen_at")
        .eq("state", "open")
        .order("last_seen_at", { ascending: false })
        .limit(10),
    ]);

    return NextResponse.json({
      windowDays: WINDOW_DAYS,
      activity: {
        meetings: meetingCount ?? 0,
        emails: emailCount ?? 0,
        teamsMessages: teamsCount ?? 0,
        openAlerts: openAlertCount ?? 0,
      },
      alerts: alerts ?? [],
    });
  },
);
