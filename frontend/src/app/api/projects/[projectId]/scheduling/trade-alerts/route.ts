import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { z } from "zod";

const alertSchema = z.object({
  revisionId: z.string().uuid(),
  sourceTaskId: z.string().uuid(),
  changeKind: z.enum(["date_changed", "dependency_changed", "submittal_changed"]),
  title: z.string().trim().min(1).max(240),
  body: z.string().trim().max(4000).nullable().optional(),
});

export const POST = withApiGuardrails<{ projectId: string }>(
  "projects/[projectId]/scheduling/trade-alerts#POST",
  async ({ request, params }) => {
    const { projectId } = await params;
    if (!await getApiRouteUser()) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/[projectId]/scheduling/trade-alerts#POST",
        message: "Authentication required.",
      });
    }

    const parsed = alertSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "A published revision, activity, supported change kind, and title are required." }, { status: 400 });
    }

    const supabase = await createClient();
    const { data, error } = await supabase.rpc("emit_schedule_trade_alert", {
      p_project_id: Number(projectId),
      p_revision_id: parsed.data.revisionId,
      p_source_task_id: parsed.data.sourceTaskId,
      p_change_kind: parsed.data.changeKind,
      p_title: parsed.data.title,
      p_body: parsed.data.body ?? null,
    });
    if (error) {
      const status = error.code === "42501" ? 403 : error.code === "P0002" ? 404 : 400;
      return NextResponse.json({ error: error.message }, { status });
    }
    if (!data) return NextResponse.json({ delivered: false, duplicate: true });
    return NextResponse.json({ delivered: true, notification: data }, { status: 201 });
  },
);
