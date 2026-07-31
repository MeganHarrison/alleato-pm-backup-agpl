import { NextResponse } from "next/server";
import { z } from "zod";

import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { procurementItemIdSchema, procurementRpcErrorStatus } from "@/lib/procurement/api";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";

const linkSchema = z.object({ submittal_id: z.string().uuid() });

async function authAndParams(projectId: string, procurementItemId: string, where: string) {
  const projectIdNumber = Number(projectId);
  if (!Number.isInteger(projectIdNumber) || !procurementItemIdSchema.safeParse(procurementItemId).success) {
    throw new GuardrailError({ code: "INVALID_PAYLOAD", where, message: "Project or procurement item identifier is invalid." });
  }
  if (!await getApiRouteUser()) {
    throw new GuardrailError({ code: "AUTH_EXPIRED", where, message: "Authentication required." });
  }
  return projectIdNumber;
}

export const POST = withApiGuardrails<{ projectId: string; procurementItemId: string }>(
  "projects/[projectId]/procurement/[procurementItemId]/submittals#POST",
  async ({ request, params }) => {
    const { projectId, procurementItemId } = await params;
    const projectIdNumber = await authAndParams(projectId, procurementItemId, "projects/[projectId]/procurement/[procurementItemId]/submittals#POST");
    const parsed = linkSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "submittal_id must be a valid identifier." }, { status: 400 });
    const supabase = await createClient();
    const { data, error } = await (supabase as any).rpc("link_procurement_item_submittal", {
      p_project_id: projectIdNumber,
      p_procurement_item_id: procurementItemId,
      p_submittal_id: parsed.data.submittal_id,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: procurementRpcErrorStatus(error) });
    return NextResponse.json({ data }, { status: 201 });
  },
);

export const DELETE = withApiGuardrails<{ projectId: string; procurementItemId: string }>(
  "projects/[projectId]/procurement/[procurementItemId]/submittals#DELETE",
  async ({ request, params }) => {
    const { projectId, procurementItemId } = await params;
    const projectIdNumber = await authAndParams(projectId, procurementItemId, "projects/[projectId]/procurement/[procurementItemId]/submittals#DELETE");
    const submittalId = request.nextUrl.searchParams.get("submittalId");
    if (!submittalId || !z.string().uuid().safeParse(submittalId).success) {
      throw new GuardrailError({ code: "INVALID_PAYLOAD", where: "projects/[projectId]/procurement/[procurementItemId]/submittals#DELETE", message: "submittalId must be a valid identifier." });
    }
    const supabase = await createClient();
    const { error } = await (supabase as any).rpc("unlink_procurement_item_submittal", {
      p_project_id: projectIdNumber,
      p_procurement_item_id: procurementItemId,
      p_submittal_id: submittalId,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: procurementRpcErrorStatus(error) });
    return new NextResponse(null, { status: 204 });
  },
);
