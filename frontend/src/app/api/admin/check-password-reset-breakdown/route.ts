import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-error";
import { serviceDb } from "@/lib/supabase/service-db";

export async function GET() {
  try {

    const { data, error } = await serviceDb.from("email_events")
      .select("to_email, created_at")
      .eq("template", "forgot-password")
      .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error }, { status: 500 });
    }

    // Group by email
    const byEmail: { [key: string]: string[] } = {};
    for (const event of data || []) {
      if (!byEmail[event.to_email]) {
        byEmail[event.to_email] = [];
      }
      byEmail[event.to_email].push(event.created_at);
    }

    const breakdown = Object.entries(byEmail).map(([email, times]) => ({
      email,
      count: times.length,
      timestamps: times,
    }));

    return NextResponse.json({
      total_emails_sent: data?.length || 0,
      unique_recipients: breakdown.length,
      breakdown,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
