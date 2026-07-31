import { NextResponse } from "next/server";
import { z } from "zod";

import { apiErrorResponse } from "@/lib/api-error";
import { parseJsonBody, withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";

const PatchBodySchema = z
  .object({
    job_title: z.union([z.string().trim(), z.null()]).optional(),
    business_unit: z.union([z.string().trim(), z.null()]).optional(),
    email: z.union([z.string().trim().email(), z.literal(""), z.null()]).optional(),
    phone: z.union([z.string().trim(), z.null()]).optional(),
    phone_business: z.union([z.string().trim(), z.null()]).optional(),
    phone_mobile: z.union([z.string().trim(), z.null()]).optional(),
    status: z.string().trim().min(1).optional(),
    type: z.string().trim().min(1).optional(),
    person_type: z.string().trim().min(1).optional(),
  })
  .refine(
    (body) =>
      body.job_title !== undefined ||
      body.business_unit !== undefined ||
      body.email !== undefined ||
      body.phone !== undefined ||
      body.phone_business !== undefined ||
      body.phone_mobile !== undefined ||
      body.status !== undefined ||
      body.type !== undefined ||
      body.person_type !== undefined,
    { message: "At least one employee field is required." },
  );

export const PATCH = withApiGuardrails<{ employeeId: string }>(
  "directory/employees/[employeeId]#PATCH",
  async ({ request, params }) => {
    const { employeeId } = await params;
    const where = "directory/employees/[employeeId]#PATCH";
    if (!employeeId) {
      throw new GuardrailError({
        code: "ROUTE_BINDING_MISSING",
        where,
        message: "Employee ID is required.",
      });
    }

    const parsed = await parseJsonBody(request, PatchBodySchema, where);

    const supabase = await createClient();
    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "directory/employees/[employeeId]#PATCH",
        message: "Authentication required.",
      });
    }

    const nextPhone =
      parsed.phone !== undefined ? parsed.phone : undefined;
    const updates = {
      ...(parsed.job_title !== undefined && {
        job_title: parsed.job_title,
      }),
      ...(parsed.business_unit !== undefined && {
        business_unit: parsed.business_unit,
      }),
      ...(parsed.email !== undefined && {
        email: parsed.email === "" ? null : parsed.email,
      }),
      ...(nextPhone !== undefined && {
        phone_business: nextPhone,
        phone_mobile: nextPhone,
      }),
      ...(parsed.phone_business !== undefined && {
        phone_business: parsed.phone_business,
      }),
      ...(parsed.phone_mobile !== undefined && {
        phone_mobile: parsed.phone_mobile,
      }),
      ...(parsed.status !== undefined && { status: parsed.status }),
      ...(parsed.type !== undefined && { person_type: parsed.type }),
      ...(parsed.person_type !== undefined && {
        person_type: parsed.person_type,
      }),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("people")
      .update(updates)
      .eq("id", employeeId)
      .select()
      .single();

    if (error) {
      return apiErrorResponse(error);
    }

    return NextResponse.json({ employee: data });
  },
);
