import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { GuardrailError } from "@/lib/guardrails/errors";
import { withApiGuardrails } from "@/lib/guardrails/api";

// GET: Fetch meeting title by ID (used for global breadcrumb resolution)
export const GET = withApiGuardrails<Promise<{ meetingId: string }>>(
  "/api/meetings/[meetingId]#GET",
  async ({ params }) => {
    const { meetingId } = await params;
    const supabase = await createClient();

    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "/api/meetings/[meetingId]#GET",
        message: "Unauthorized meeting title request.",
        status: 401,
        severity: "medium",
      });
    }

    const { data, error } = await supabase
      .from("document_metadata")
      .select("id, title")
      .eq("id", meetingId)
      .is("deleted_at", null)
      .single();

    if (error || !data) {
      throw new GuardrailError({
        code: "ROUTE_BINDING_MISSING",
        where: "/api/meetings/[meetingId]#GET",
        message: "Meeting not found.",
        status: 404,
        severity: "low",
      });
    }

    return NextResponse.json({ title: data.title });
  },
);
