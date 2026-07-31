import { NextResponse } from "next/server";
import { z } from "zod";

import { apiErrorResponse } from "@/lib/api-error";
import { parseJsonBody, withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";

const PatchBodySchema = z
  .object({
    email: z
      .union([z.string().trim().email(), z.literal(""), z.null()])
      .optional(),
    type: z.string().trim().min(1).optional(),
    person_type: z.string().trim().min(1).optional(),
    company_id: z
      .union([z.string().trim().uuid(), z.literal(""), z.null()])
      .optional(),
    phone: z.union([z.string().trim(), z.null()]).optional(),
    phone_business: z.union([z.string().trim(), z.null()]).optional(),
    phone_mobile: z.union([z.string().trim(), z.null()]).optional(),
  })
  .refine(
    (body) =>
      body.email !== undefined ||
      body.type !== undefined ||
      body.person_type !== undefined ||
      body.company_id !== undefined ||
      body.phone !== undefined ||
      body.phone_business !== undefined ||
      body.phone_mobile !== undefined,
    { message: "At least one contact field is required." },
  );

export const PATCH = withApiGuardrails<{ contactId: string }>(
  "directory/contacts/[contactId]#PATCH",
  async ({ request, params }) => {
    const { contactId } = await params;
    const where = "directory/contacts/[contactId]#PATCH";
    if (!contactId) {
      throw new GuardrailError({
        code: "ROUTE_BINDING_MISSING",
        where,
        message: "Contact ID is required.",
      });
    }

    const parsed = await parseJsonBody(request, PatchBodySchema, where);

    const supabase = await createClient();
    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "directory/contacts/[contactId]#PATCH",
        message: "Authentication required.",
      });
    }

    const nextPhone = parsed.phone !== undefined ? parsed.phone : undefined;
    const updates = {
      ...(parsed.email !== undefined && {
        email: parsed.email === "" ? null : parsed.email,
      }),
      ...(parsed.type !== undefined && { person_type: parsed.type }),
      ...(parsed.person_type !== undefined && {
        person_type: parsed.person_type,
      }),
      ...(parsed.company_id !== undefined && {
        company_id: parsed.company_id === "" ? null : parsed.company_id,
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
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("people")
      .update(updates)
      .eq("id", contactId)
      .select()
      .single();

    if (error) {
      return apiErrorResponse(error);
    }

    return NextResponse.json({ contact: data });
  },
);
