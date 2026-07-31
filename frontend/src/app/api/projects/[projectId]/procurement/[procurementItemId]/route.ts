import { NextResponse } from "next/server";

import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import {
  procurementItemIdSchema,
  procurementItemInputSchema,
  procurementRpcErrorStatus,
} from "@/lib/procurement/api";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";

const detailSelect = `
  id, project_id, title, description, lifecycle_status, responsible_user_id, created_at, updated_at,
  procurement_item_submittal_links(
    submittal_id,
    submittals(id, submittal_number, title, status, lead_time, required_on_site_date)
  ),
  procurement_item_schedule_task_links(
    schedule_task_id,
    schedule_tasks(id, name, start_date, finish_date, status)
  ),
  procurement_item_events(id, event_type, payload, created_at, actor_user_id)
`;

function validParams(projectId: string, procurementItemId: string, where: string) {
  const projectIdNumber = Number(projectId);
  if (!Number.isInteger(projectIdNumber) || !procurementItemIdSchema.safeParse(procurementItemId).success) {
    throw new GuardrailError({ code: "INVALID_PAYLOAD", where, message: "Project or procurement item identifier is invalid." });
  }
  return projectIdNumber;
}

export const GET = withApiGuardrails<{ projectId: string; procurementItemId: string }>(
  "projects/[projectId]/procurement/[procurementItemId]#GET",
  async ({ params }) => {
    const { projectId, procurementItemId } = await params;
    const projectIdNumber = validParams(projectId, procurementItemId, "projects/[projectId]/procurement/[procurementItemId]#GET");
    if (!await getApiRouteUser()) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/procurement/[procurementItemId]#GET", message: "Authentication required." });
    }
    const supabase = await createClient();
    const { data, error } = await (supabase as any)
      .from("procurement_items")
      .select(detailSelect)
      .eq("project_id", projectIdNumber)
      .eq("id", procurementItemId)
      .single();
    if (error || !data) return NextResponse.json({ error: "Procurement item not found in this project." }, { status: 404 });
    return NextResponse.json({ data });
  },
);

export const PATCH = withApiGuardrails<{ projectId: string; procurementItemId: string }>(
  "projects/[projectId]/procurement/[procurementItemId]#PATCH",
  async ({ request, params }) => {
    const { projectId, procurementItemId } = await params;
    const projectIdNumber = validParams(projectId, procurementItemId, "projects/[projectId]/procurement/[procurementItemId]#PATCH");
    if (!await getApiRouteUser()) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/procurement/[procurementItemId]#PATCH", message: "Authentication required." });
    }
    const parsed = procurementItemInputSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Procurement item is invalid." }, { status: 400 });
    }
    const supabase = await createClient();
    const { data, error } = await (supabase as any).rpc("update_procurement_item", {
      p_project_id: projectIdNumber,
      p_procurement_item_id: procurementItemId,
      p_title: parsed.data.title,
      p_description: parsed.data.description ?? null,
      p_lifecycle_status: parsed.data.lifecycle_status,
      p_responsible_user_id: parsed.data.responsible_user_id ?? null,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: procurementRpcErrorStatus(error) });
    return NextResponse.json({ data });
  },
);
