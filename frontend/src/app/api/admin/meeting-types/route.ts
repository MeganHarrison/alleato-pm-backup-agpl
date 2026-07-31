import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAppAdmin } from "@/lib/auth/require-app-admin";
import { parseJsonBody, withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createServiceClient } from "@/lib/supabase/service";
import { getApiRouteUser } from "@/lib/supabase/server";

const WHERE = "admin/meeting-types";
const createMeetingTypeSchema = z.object({
  name: z.string().trim().min(1, "Enter a meeting type name.").max(100),
});

export const GET = withApiGuardrails(`${WHERE}#GET`, async () => {
  await requireAppAdmin(`${WHERE}#GET`);
  const service = createServiceClient();
  const { data, error } = await service
    .from("company_meeting_types")
    .select("id, name, sort_order, archived_at")
    .order("sort_order")
    .order("name");
  if (error) throw new GuardrailError({ code: "INTERNAL_ERROR", where: `${WHERE}#GET`, message: `Failed to load meeting types: ${error.message}`, details: error });
  return NextResponse.json({ meetingTypes: data ?? [] });
});

export const POST = withApiGuardrails(`${WHERE}#POST`, async ({ request }) => {
  await requireAppAdmin(`${WHERE}#POST`);
  const user = await getApiRouteUser();
  if (!user) throw new GuardrailError({ code: "AUTH_EXPIRED", where: `${WHERE}#POST`, message: "Sign in before creating a meeting type.", status: 401 });
  const payload = await parseJsonBody(request, createMeetingTypeSchema, `${WHERE}#POST`);
  const service = createServiceClient();
  const { data: last, error: lastError } = await service.from("company_meeting_types").select("sort_order").order("sort_order", { ascending: false }).limit(1).maybeSingle();
  if (lastError) throw new GuardrailError({ code: "INTERNAL_ERROR", where: `${WHERE}#POST`, message: `Failed to determine meeting type order: ${lastError.message}`, details: lastError });
  const { data, error } = await service.from("company_meeting_types").insert({ name: payload.name, sort_order: (last?.sort_order ?? -1) + 1, created_by: user.id }).select("id, name, sort_order, archived_at").single();
  if (error) {
    if (error.code === "23505") throw new GuardrailError({ code: "CONFLICT", where: `${WHERE}#POST`, message: "A meeting type with that name already exists.", status: 409 });
    throw new GuardrailError({ code: "INTERNAL_ERROR", where: `${WHERE}#POST`, message: `Failed to create meeting type: ${error.message}`, details: error });
  }
  return NextResponse.json({ meetingType: data }, { status: 201 });
});
