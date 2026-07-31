import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { GuardrailError } from "@/lib/guardrails/errors";
import {
  parseJsonBody,
  validateResponseContract,
  withApiGuardrails,
} from "@/lib/guardrails/api";

const CreateContactSchema = z.object({
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().min(1, "Last name is required"),
  email: z.string().optional(),
  job_title: z.string().optional(),
  phone_mobile: z.string().optional(),
  phone_business: z.string().optional(),
  company_id: z.string().optional(),
  address: z.string().optional(),
  address_line1: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
  country: z.string().optional(),
});

const ContactListEnvelopeSchema = z.object({
  data: z.array(z.record(z.string(), z.unknown())),
  meta: z.object({
    total: z.number(),
    page: z.number(),
    perPage: z.number(),
    totalPages: z.number(),
  }),
});

/**
 * Lists all contacts from the global contacts table.
 * This endpoint returns contacts regardless of project membership,
 * useful for assigning people to project teams.
 */
export const GET = withApiGuardrails("/api/contacts#GET", async ({ request }) => {
  // Identify the user from the cookie JWT (no Supabase Auth network call) to
  // avoid racing parallel route handlers on refresh-token rotation, which trips
  // reuse detection and revokes the session. The query below still uses the
  // cookie-scoped client so RLS continues to apply.
  const user = await getApiRouteUser();
  if (!user) {
    throw new GuardrailError({
      code: "AUTH_EXPIRED",
      where: "/api/contacts#GET",
      message: "Unauthorized contacts request.",
      status: 401,
      severity: "medium",
    });
  }
  const supabase = await createClient();

  const searchParams = request.nextUrl.searchParams;
  const search = searchParams.get("search") || undefined;
  const status = searchParams.get("status") as
    | "active"
    | "inactive"
    | "all"
    | undefined;
  const perPage = parseInt(searchParams.get("per_page") || "200", 10);
  const page = parseInt(searchParams.get("page") || "1", 10);

  let query = supabase
    .from("people")
    .select(
      `
        *,
        company:companies!people_company_id_fkey(id, name)
      `,
      { count: "exact" },
    )
    .eq("person_type", "contact");

  if (status && status !== "all") {
    query = query.eq("status", status);
  }

  if (search) {
    query = query.or(
      `first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`,
    );
  }

  query = query.order("last_name").order("first_name");

  const offset = (page - 1) * perPage;
  query = query.range(offset, offset + perPage - 1);

  const { data, error, count } = await query;

  if (error) {
    throw new GuardrailError({
      code: "INTERNAL_ERROR",
      where: "/api/contacts#GET",
      message: "Failed to fetch contacts.",
      details: { reason: error.message },
      cause: error,
    });
  }

  const payload = {
    data: data || [],
    meta: {
      total: count || 0,
      page,
      perPage,
      totalPages: Math.ceil((count || 0) / perPage),
    },
  };

  validateResponseContract(
    ContactListEnvelopeSchema,
    payload,
    "/api/contacts#GET",
  );

  return NextResponse.json(payload);
});

/**
 * Creates a new contact in the contacts table.
 * Required fields: first_name, last_name
 */
export const POST = withApiGuardrails("/api/contacts#POST", async ({ request }) => {
  const user = await getApiRouteUser();
  if (!user) {
    throw new GuardrailError({
      code: "AUTH_EXPIRED",
      where: "/api/contacts#POST",
      message: "Unauthorized contact creation request.",
      status: 401,
      severity: "medium",
    });
  }
  const supabase = await createClient();

  const body = await parseJsonBody(
    request,
    CreateContactSchema,
    "/api/contacts#POST",
  );

  const { data, error } = await supabase
    .from("people")
    .insert({
      first_name: body.first_name,
      last_name: body.last_name,
      email: body.email || undefined,
      job_title: body.job_title || undefined,
      phone_mobile: body.phone_mobile || undefined,
      phone_business: body.phone_business || undefined,
      company_id: body.company_id || undefined,
      address_line1: body.address || body.address_line1 || undefined,
      city: body.city || undefined,
      state: body.state || undefined,
      zip: body.zip || undefined,
      country: body.country || undefined,
      person_type: "contact",
    })
    .select(
      `
        *,
        company:companies!people_company_id_fkey(id, name)
      `,
    )
    .single();

  if (error) {
    throw new GuardrailError({
      code: "INTERNAL_ERROR",
      where: "/api/contacts#POST",
      message: "Failed to create contact.",
      details: { reason: error.message },
      cause: error,
    });
  }

  return NextResponse.json(data, { status: 201 });
});
