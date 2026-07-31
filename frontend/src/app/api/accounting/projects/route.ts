import { NextResponse } from "next/server";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { requireCurrentUserAppCapability } from "@/lib/app-capabilities";
import { serviceDb } from "@/lib/supabase/service-db";

export const GET = withApiGuardrails("/api/accounting/projects#GET", async () => {
  await requireCurrentUserAppCapability(
    "view_accounting",
    "/api/accounting/projects#GET",
    "Accounting access required.",
  );

    const { data, error } = await serviceDb.from("acumatica_projects")
    .select("id, external_key, project_id, description, status, customer, hold, income, expenses, assets, liabilities, template_id, external_ref_nbr, last_modified_at, acumatica_sync_at")
    .order("project_id", { ascending: true });

  if (error) {
    throw new GuardrailError({
      code: "INTERNAL_ERROR",
      where: "/api/accounting/projects#GET",
      message: "Failed to load accounting projects.",
      details: { reason: error.message },
      cause: error,
    });
  }
  return NextResponse.json(data);
});
