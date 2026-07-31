import { withApiGuardrails, parseJsonBody } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { PunchItemService } from "@/services/PunchItemService";
import { apiErrorResponse } from "@/lib/api-error";
import { updatePunchItemSchema } from "../payload";

/**
 * GET /api/projects/[projectId]/punch-items/[punchItemId]
 * Get a single punch item
 */
export const GET = withApiGuardrails<{ projectId: string; punchItemId: string }>(
  "projects/[projectId]/punch-items/[punchItemId]#GET",
  async ({ request, params }) => {
  const { projectId, punchItemId } = await params;
  const numericProjectId = parseInt(projectId, 10);
  const supabase = await createClient();

  const user = await getApiRouteUser();
  if (!user) {
    throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/punch-items/[punchItemId]#GET", message: "Authentication required." });
  }

  const service = new PunchItemService(supabase);
  const result = await service.getById(numericProjectId, punchItemId);

  if (result.error) {
    return apiErrorResponse(result.error);
  }

  return NextResponse.json(result.data);
  },
);

/**
 * PATCH /api/projects/[projectId]/punch-items/[punchItemId]
 * Update a punch item
 */
export const PATCH = withApiGuardrails<{ projectId: string; punchItemId: string }>(
  "projects/[projectId]/punch-items/[punchItemId]#PATCH",
  async ({ request, params }) => {
  const { projectId, punchItemId } = await params;
  const numericProjectId = parseInt(projectId, 10);
  const supabase = await createClient();

  const user = await getApiRouteUser();
  if (!user) {
    throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/punch-items/[punchItemId]#PATCH", message: "Authentication required." });
  }

  const body = await parseJsonBody(
    request,
    updatePunchItemSchema,
    "projects/[projectId]/punch-items/[punchItemId]#PATCH",
  );

  const service = new PunchItemService(supabase);
  const result = await service.update(
    numericProjectId,
    punchItemId,
    body,
    user.id,
  );

  if (result.error) {
    return apiErrorResponse(result.error);
  }

  return NextResponse.json(result.data);
  },
);

/**
 * DELETE /api/projects/[projectId]/punch-items/[punchItemId]
 * Soft delete a punch item (moves to recycle bin)
 */
export const DELETE = withApiGuardrails<{ projectId: string; punchItemId: string }>(
  "projects/[projectId]/punch-items/[punchItemId]#DELETE",
  async ({ request, params }) => {
  const { projectId, punchItemId } = await params;
  const numericProjectId = parseInt(projectId, 10);
  const supabase = await createClient();

  const user = await getApiRouteUser();
  if (!user) {
    throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/punch-items/[punchItemId]#DELETE", message: "Authentication required." });
  }

  const service = new PunchItemService(supabase);
  const result = await service.softDelete(
    numericProjectId,
    punchItemId,
    user.id,
  );

  if (result.error) {
    return apiErrorResponse(result.error);
  }

  return NextResponse.json({ success: true });
  },
);
