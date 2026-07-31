import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

import { apiErrorResponse } from "@/lib/api-error";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";

interface RouteParams {
  params: Promise<{ projectId: string }>;
}

const createTransmittalSchema = z.object({
  number: z.string().min(1),
  subject: z.string().min(1),
  status: z.enum(["Draft", "Open", "Closed", "Void"]).default("Draft"),
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
    .default("Email"),
  copies_sent: z.number().int().nullable().optional(),
  is_private: z.boolean().default(false),
  ball_in_court: z.string().nullable().optional(),
});

/**
 * GET /api/projects/[projectId]/transmittals
 * Returns all transmittals for the project.
 */
export const GET = withApiGuardrails(
  "projects/[projectId]/transmittals#GET",
  async ({ request, params }) => {
  
    const { projectId } = await params;
    const supabase = await createClient();
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/[projectId]/transmittals#GET",
        message: "Authentication required.",
      });
    }
    const { searchParams } = new URL(request.url);

    const status = searchParams.get("status");
    const search = searchParams.get("search");
    const tab = searchParams.get("tab");

    let query = supabase
      .from("project_transmittals")
      .select("*")
      .eq("project_id", parseInt(projectId, 10))
      .order("created_at", { ascending: false });

    if (tab === "recycle-bin") {
      query = query.not("deleted_at", "is", null);
    } else {
      query = query.is("deleted_at", null);
    }

    if (status) {
      query = query.eq("status", status);
    }

    if (search) {
      query = query.or(
        `subject.ilike.%${search}%,number.ilike.%${search}%,to_company.ilike.%${search}%,from_company.ilike.%${search}%`,
      );
    }

    const { data, error } = await query;

    if (error) {
      return apiErrorResponse(error);
    }

    return NextResponse.json(data ?? []);
    },
);

/**
 * POST /api/projects/[projectId]/transmittals
 * Creates a new transmittal.
 */
export const POST = withApiGuardrails(
  "projects/[projectId]/transmittals#POST",
  async ({ request, params }) => {
  
    const { projectId } = await params;
    const supabase = await createClient();
    const body = await request.json();

    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/transmittals#POST", message: "Authentication required." });
    }

    const validatedData = createTransmittalSchema.parse(body);

    // Check unique number within project
    const { data: existing } = await supabase
      .from("project_transmittals")
      .select("id")
      .eq("project_id", parseInt(projectId, 10))
      .eq("number", validatedData.number)
      .is("deleted_at", null)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: "Transmittal number already exists for this project" },
        { status: 409 },
      );
    }

    const { data, error } = await supabase
      .from("project_transmittals")
      .insert({
        ...validatedData,
        project_id: parseInt(projectId, 10),
        created_by: user.id,
      })
      .select("*")
      .single();

    if (error) {
      return apiErrorResponse(error);
    }

    return NextResponse.json(data, { status: 201 });
    },
);
