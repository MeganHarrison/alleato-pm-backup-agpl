import { NextResponse } from "next/server";
import { z } from "zod";
import { parseJsonBody, withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";

const OptionalString = z.string().trim().min(1).nullish();
const OptionalJson = z.unknown().nullish();
// Mirrors the `company_context` table (expanded for the AI Company Knowledge
// Base — see supabase/migrations/20260304000001_expand_company_context_for_ai.sql)
// and the `CompanyContext` type in `@/hooks/use-company-knowledge`.
const CompanyContextUpsertSchema = z.object({
  mission: OptionalString,
  vision: OptionalString,
  company_history: OptionalString,
  core_values: OptionalJson,
  key_differentiators: OptionalJson,
  competitive_landscape: OptionalJson,
  target_markets: OptionalJson,
  goals: OptionalJson,
  okrs: OptionalJson,
  strategic_initiatives: OptionalJson,
  org_structure: OptionalJson,
  policies: OptionalJson,
  resource_constraints: OptionalJson,
  annual_revenue_range: OptionalString,
  employee_count: z.number().int().nullish(),
  founded_year: z.number().int().nullish(),
  headquarters: OptionalString,
  service_areas: OptionalJson,
  certifications: OptionalJson,
  key_clients: OptionalJson,
  notes: OptionalString,
});

async function requireAdmin(where: string) {
  const supabase = await createClient();
  const user = await getApiRouteUser();

  if (!user) {
    throw new GuardrailError({
      code: "AUTH_EXPIRED",
      where,
      message: "Unauthorized request.",
      status: 401,
    });
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) {
    throw new GuardrailError({
      code: "AUTH_FORBIDDEN",
      where,
      message: "Admin access required.",
      status: 403,
    });
  }

  return supabase;
}

/**
 * GET /api/admin/company-context
 * Fetch the company context (singleton row).
 */
export const GET = withApiGuardrails("/api/admin/company-context#GET", async () => {
  const supabase = await requireAdmin("/api/admin/company-context#GET");

  const { data, error } = await supabase
    .from("company_context")
    .select("*")
    .limit(1)
    .single();

  if (error && error.code !== "PGRST116") {
    throw new GuardrailError({
      code: "INTERNAL_ERROR",
      where: "/api/admin/company-context#GET",
      message: "Failed to load company context.",
      details: {
        reason: error.message,
      },
    });
  }

  return NextResponse.json({ data: data ?? null });
});

/**
 * PUT /api/admin/company-context
 * Upsert the company context (singleton row).
 */
export const PUT = withApiGuardrails("/api/admin/company-context#PUT", async ({ request }) => {
  const supabase = await requireAdmin("/api/admin/company-context#PUT");
  const body = await parseJsonBody(
    request,
    CompanyContextUpsertSchema,
    "/api/admin/company-context#PUT",
  );

  // Check if a row exists
  const { data: existing } = await supabase
    .from("company_context")
    .select("id")
    .limit(1)
    .single();

  let result;
  if (existing) {
    // Update existing row
    const { data, error } = await supabase
      .from("company_context")
      .update({
        ...body,
        updated_at: new Date().toISOString(),
      } as Database["public"]["Tables"]["company_context"]["Update"])
      .eq("id", existing.id)
      .select()
      .single();
    result = { data, error };
  } else {
    // Insert new row
    const { data, error } = await supabase
      .from("company_context")
      .insert({
        ...body,
        updated_at: new Date().toISOString(),
      } as Database["public"]["Tables"]["company_context"]["Insert"])
      .select()
      .single();
    result = { data, error };
  }

  if (result.error) {
    throw new GuardrailError({
      code: "INTERNAL_ERROR",
      where: "/api/admin/company-context#PUT",
      message: "Failed to save company context.",
      details: {
        reason: result.error.message,
      },
    });
  }

  return NextResponse.json({ data: result.data });
});
