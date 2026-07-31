import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import type { Company } from "@/app/api/types";
import { z } from "zod";
import { GuardrailError } from "@/lib/guardrails/errors";
import {
  validateResponseContract,
  withApiGuardrails,
} from "@/lib/guardrails/api";

const CompanyResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string().nullable().optional(),
  license_number: z.string().nullable().optional(),
});

export const GET = withApiGuardrails("/api/companies#GET", async ({ request }) => {
  const supabase = await createClient();
  const user = await getApiRouteUser();
  if (!user) {
    throw new GuardrailError({
      code: "AUTH_EXPIRED",
      where: "/api/companies#GET",
      message: "Unauthorized companies request.",
      status: 401,
      severity: "medium",
    });
  }
  const { searchParams } = new URL(request.url);

  const type = searchParams.get("type");
  const search = searchParams.get("search");

  let query = supabase.from("companies").select("*").order("name", { ascending: true });

  if (type) {
    // Allow filtering by multiple types using comma separation
    const types = type.split(",");
    query = query.in("type", types);
  }

  if (search) {
    query = query.ilike("name", `%${search}%`);
  }

  const { data, error } = await query;

  if (error) {
    throw new GuardrailError({
      code: "INTERNAL_ERROR",
      where: "/api/companies#GET",
      message: "Failed to fetch companies.",
      details: { reason: error.message },
      cause: error,
    });
  }

  const rows = data ?? [];
  const companies: Company[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    type: (r.type as Company["type"]) ?? "vendor",
    contact_email: r.contact_email ?? undefined,
    contact_phone: r.contact_phone ?? undefined,
    address: r.address ?? undefined,
    tax_id: r.tax_id ?? undefined,
    license_number: r.license_number ?? undefined,
  }));
  validateResponseContract(
    z.array(CompanyResponseSchema),
    companies,
    "/api/companies#GET",
  );
  return NextResponse.json(companies);
});

// Companies are managed exclusively in Acumatica (ERP) by Accounting, so
// insurance, EIN, and legal details stay accurate. Creation from the PM app
// is disabled — records sync in automatically via
// `backend/src/services/acumatica_sync.py`.
export const POST = withApiGuardrails("/api/companies#POST", async () => {
  const user = await getApiRouteUser();
  if (!user) {
    throw new GuardrailError({
      code: "AUTH_EXPIRED",
      where: "/api/companies#POST",
      message: "Unauthorized company creation request.",
      status: 401,
      severity: "medium",
    });
  }

  return NextResponse.json(
    {
      error: "erp_managed",
      message:
        "Companies are managed in Acumatica (ERP) by Accounting and can no longer be created here. Ask Accounting to add the company in Acumatica — it will sync in automatically.",
    },
    { status: 403 },
  );
});
