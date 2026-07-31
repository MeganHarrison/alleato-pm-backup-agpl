import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-error";
import { serviceDb } from "@/lib/supabase/service-db";

export async function GET() {
  try {
    const { data } = await serviceDb.from("email_events").select("to_email, created_at").eq("template", "forgot-password").order("created_at", { ascending: false }).limit(1);
    return NextResponse.json(data?.[0] || {});
  } catch (error) {
    return apiErrorResponse(error);
  }
}
