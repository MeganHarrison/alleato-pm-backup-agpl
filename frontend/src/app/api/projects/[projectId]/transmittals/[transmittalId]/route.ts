import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

import { apiErrorResponse } from "@/lib/api-error";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";

interface RouteParams {
  params: Promise<{ projectId: string; transmittalId: string }>;
}

const updateTransmittalSchema = z.object({
  number: z.string().min(1).optional(),
  subject: z.string().min(1).optional(),
  status: z.enum(["Draft", "Open", "Closed", "Void"]).optional(),
  to_company: z.string().nullable().optional(),
  to_contact: z.string().nullable().optional(),
  from_company: z.string().nullable().optional(),
  from_contact: z.string().nullable().optional(),
  sent_date: z.string().nullable().optional(),
  due_date: z.string().nullable().optional(),
  received_date: z.string().nullable().optional(),
  remarks: z.string().nullable().optional(),
  delivery_method: z
    .enum(["Email", "Hand Delivery", "Mail", "Courier", "Fax", "Other"])
    .optional(),
  copies_sent: z.number().int().nullable().optional(),
  is_private: z.boolean().optional(),
  ball_in_court: z.string().nullable().optional(),
});

/**
 * GET /api/projects/[projectId]/transmittals/[transmittalId]
 * Returns a single transmittal.
 */
export const GET = withApiGuardrails(
  "projects/[projectId]/transmittals/[transmittalId]#GET",
  async ({ request, params }) => {
  
    const { projectId, transmittalId } = await params;
    const supabase = await createClient();
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/[projectId]/transmittals/[transmittalId]#GET",
        message: "Authentication required.",
      });
    }

    const { data, error } = await supabase
      .from("project_transmittals")
      .select("*")
      .eq("project_id", parseInt(projectId, 10))
      .eq("id", parseInt(transmittalId, 10))
      .single();

    if (error) {
      return apiErrorResponse(error);
    }

    if (!data) {
      return NextResponse.json(
        { error: "Transmittal not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(data);
    },
);

/**
 * PUT /api/projects/[projectId]/transmittals/[transmittalId]
 * Updates a transmittal.
 */
export const PUT = withApiGuardrails(
  "projects/[projectId]/transmittals/[transmittalId]#PUT",
  async ({ request, params }) => {
  
    const { projectId, transmittalId } = await params;
    const supabase = await createClient();
    const body = await request.json();

    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/transmittals/[transmittalId]#PUT", message: "Authentication required." });
    }

    const validatedData = updateTransmittalSchema.parse(body);

    const { data, error } = await supabase
      .from("project_transmittals")
      .update({
        ...validatedData,
        updated_at: new Date().toISOString(),
      })
      .eq("project_id", parseInt(projectId, 10))
      .eq("id", parseInt(transmittalId, 10))
      .select("*")
      .single();

    if (error) {
      return apiErrorResponse(error);
    }

    return NextResponse.json(data);
    },
);

/**
 * DELETE /api/projects/[projectId]/transmittals/[transmittalId]
 * Soft-deletes a transmittal (moves to Recycle Bin).
 */
export const DELETE = withApiGuardrails(
  "projects/[projectId]/transmittals/[transmittalId]#DELETE",
  async ({ request, params }) => {
  
    const { projectId, transmittalId } = await params;
    const supabase = await createClient();

    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/transmittals/[transmittalId]#DELETE", message: "Authentication required." });
    }

    const { error } = await supabase
      .from("project_transmittals")
      .update({
        deleted_at: new Date().toISOString(),
      })
      .eq("project_id", parseInt(projectId, 10))
      .eq("id", parseInt(transmittalId, 10));

    if (error) {
      return apiErrorResponse(error);
    }

    return NextResponse.json({ success: true });
    },
);
