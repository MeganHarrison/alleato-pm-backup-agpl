import { NextResponse } from "next/server";

import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import {
  procurementItemInputSchema,
  procurementRpcErrorStatus,
} from "@/lib/procurement/api";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";

const itemSelect = `
  id, project_id, title, description, lifecycle_status, responsible_user_id, created_at, updated_at,
  procurement_item_submittal_links(
    submittal_id,
    submittals(id, submittal_number, title, status, lead_time, required_on_site_date)
  ),
  procurement_item_schedule_task_links(
    schedule_task_id,
    schedule_tasks(id, name, start_date, finish_date, status)
  )
`;

export const GET = withApiGuardrails<{ projectId: string }>(
  "projects/[projectId]/procurement#GET",
  async ({ params }) => {
    const { projectId } = await params;
    const projectIdNumber = Number(projectId);
    if (!Number.isInteger(projectIdNumber)) {
      throw new GuardrailError({ code: "INVALID_PAYLOAD", where: "projects/[projectId]/procurement#GET", message: "Project identifier must be valid." });
    }
    if (!await getApiRouteUser()) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/procurement#GET", message: "Authentication required." });
    }

    const supabase = await createClient();
    const { data, error } = await (supabase as any)
      .from("procurement_items")
      .select(itemSelect)
      .eq("project_id", projectIdNumber)
      .order("updated_at", { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ data: data ?? [] });
  },
);

export const POST = withApiGuardrails<{ projectId: string }>(
  "projects/[projectId]/procurement#POST",
  async ({ request, params }) => {
    const { projectId } = await params;
    const projectIdNumber = Number(projectId);
    if (!Number.isInteger(projectIdNumber)) {
      throw new GuardrailError({ code: "INVALID_PAYLOAD", where: "projects/[projectId]/procurement#POST", message: "Project identifier must be valid." });
    }
    if (!await getApiRouteUser()) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/procurement#POST", message: "Authentication required." });
    }
    const parsed = procurementItemInputSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Procurement item is invalid." }, { status: 400 });
    }

    const supabase = await createClient();
    const { data, error } = await (supabase as any).rpc("create_procurement_item", {
      p_project_id: projectIdNumber,
      p_title: parsed.data.title,
      p_description: parsed.data.description ?? null,
      p_lifecycle_status: parsed.data.lifecycle_status,
      p_responsible_user_id: parsed.data.responsible_user_id ?? null,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: procurementRpcErrorStatus(error) });
    return NextResponse.json({ data }, { status: 201 });
  },
);
