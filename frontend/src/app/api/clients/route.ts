import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { getApiRouteUser } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { serviceDb } from "@/lib/supabase/service-db";
import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-error";

export const GET = withApiGuardrails(
  "clients#GET",
  async ({ request }) => {
    // Identify the user from the cookie JWT — no Supabase Auth network call.
    // Calling supabase.auth.getUser() here races other parallel route handlers
    // on refresh-token rotation, which trips reuse detection and revokes the
    // user's whole session (symptom: pages render but every API says
    // "Authentication required"). See getApiRouteUser docs.
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "clients#GET", message: "Authentication required." });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");
    const status = searchParams.get("status");

    const supabase = createServiceClient();
    let query = serviceDb.from("companies")
      .select("id, name, type, status, website, address, city, state, created_at")
      .eq("type", "client")
      .order("name", { ascending: true });

    if (search) query = query.ilike("name", `%${search}%`);
    if (status) query = query.eq("status", status);

    const { data, error } = await query;
    if (error) return apiErrorResponse(error);
    return NextResponse.json(data || []);
    },
);

// Companies (including clients) are managed exclusively in Acumatica (ERP) by
// Accounting, so insurance, EIN, and legal details stay accurate. Creation
// from the PM app is disabled — records sync in automatically via
// `backend/src/services/acumatica_sync.py`.
export const POST = withApiGuardrails(
  "clients#POST",
  async () => {
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "clients#POST", message: "Authentication required." });
    }

    return NextResponse.json(
      {
        error: "erp_managed",
        message:
          "Companies are managed in Acumatica (ERP) by Accounting and can no longer be created here. Ask Accounting to add the client in Acumatica — it will sync in automatically.",
      },
      { status: 403 },
    );
    },
);
