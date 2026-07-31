import { NextResponse } from "next/server";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";

export const GET = withApiGuardrails(
  "projects/[projectId]/drawings/[drawingId]/change-history#GET",
  async ({ params }) => {
    const { projectId, drawingId } = params as { projectId: string; drawingId: string };
    const projectIdNum = Number(projectId);
    if (isNaN(projectIdNum)) {
      return NextResponse.json({ error: "Invalid project ID" }, { status: 400 });
    }

    const supabase = await createClient();
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/[projectId]/drawings/[drawingId]/change-history#GET",
        message: "Unauthorized",
        status: 401,
      });
    }

    // Fetch change history ordered by most recent first
    const { data: history, error } = await supabase
      .from("drawing_change_history")
      .select("*")
      .eq("drawing_id", drawingId)
      .order("changed_at", { ascending: false })
      .limit(200);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Enrich with user display info from profiles table if available
    const userIds = [...new Set((history ?? []).map((h) => h.changed_by).filter(Boolean) as string[])];
    const profileMap: Record<string, string> = {};

    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from("user_profiles")
        .select("id, email, full_name")
        .in("id", userIds);

      for (const profile of (profiles ?? [])) {
        profileMap[profile.id] = profile.full_name ?? profile.email ?? profile.id;
      }
    }

    const enriched = (history ?? []).map((h) => ({
      ...h,
      changed_by_name: profileMap[h.changed_by ?? ""] ?? h.changed_by,
    }));

    return NextResponse.json({ history: enriched });
  },
);
