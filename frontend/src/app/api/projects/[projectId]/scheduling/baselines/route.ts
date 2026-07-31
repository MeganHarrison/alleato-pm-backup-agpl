import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { throwScheduleDatabaseError, throwScheduleRequestError, throwScheduleRpcError } from "@/lib/scheduling/schedule-route-errors";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { z } from "zod";

const captureSchema = z.object({
  name: z.string().trim().min(1).max(80),
  revision_id: z.string().uuid(),
  activate: z.boolean().optional().default(true),
});

export const GET = withApiGuardrails<{ projectId: string }>(
  "projects/[projectId]/scheduling/baselines#GET",
  async ({ params }) => {
    const { projectId } = await params;
    if (!await getApiRouteUser()) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/scheduling/baselines#GET", message: "Authentication required." });
    }
    const supabase = await createClient();
    const [baselineResult, capabilityResult] = await Promise.all([
      supabase
        .from("schedule_baselines")
        .select("id,project_id,revision_id,name,is_active,created_at,activated_at")
        .eq("project_id", Number(projectId))
        .order("created_at", { ascending: false }),
      supabase.rpc("current_can_manage_schedule", { p_project_id: Number(projectId) }),
    ]);
    if (baselineResult.error) throwScheduleDatabaseError("projects/[projectId]/scheduling/baselines#GET", baselineResult.error);
    if (capabilityResult.error) throwScheduleDatabaseError("projects/[projectId]/scheduling/baselines#GET", capabilityResult.error);
    return NextResponse.json({ data: baselineResult.data ?? [], can_manage: capabilityResult.data === true });
  },
);

export const POST = withApiGuardrails<{ projectId: string }>(
  "projects/[projectId]/scheduling/baselines#POST",
  async ({ request, params }) => {
    const { projectId } = await params;
    if (!await getApiRouteUser()) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/scheduling/baselines#POST", message: "Authentication required." });
    }
    const parsed = captureSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throwScheduleRequestError("projects/[projectId]/scheduling/baselines#POST", "Provide a baseline name, an approved revision, and a valid activation choice.");
    }
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("capture_schedule_baseline", {
      p_project_id: Number(projectId),
      p_revision_id: parsed.data.revision_id,
      p_name: parsed.data.name,
      p_activate: parsed.data.activate,
    });
    if (error) throwScheduleRpcError("projects/[projectId]/scheduling/baselines#POST", error);
    return NextResponse.json({ data }, { status: 201 });
  },
);
