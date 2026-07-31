/**
 * /api/dev/violations
 * Design violation tracker API.
 * POST  — flag a new violation (from right-click overlay)
 * GET   — list violations (for inbox page + Claude Code reading)
 * PATCH — update status (Claude Code marks fixed, Megan marks wont_fix)
 */
import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { serviceDb } from "@/lib/supabase/service-db";
import { apiErrorResponse } from "@/lib/api-error";

export const POST = withApiGuardrails(
  "dev/violations#POST",
  async ({ request }) => {
  const supabase = await createClient();
  const user = await getApiRouteUser();
  if (!user) throw new GuardrailError({ code: "AUTH_EXPIRED", where: "dev/violations#POST", message: "Authentication required." });

  const body = await request.json();
  const { route, elementDescription, elementSelector, violationType, notes, screenshotDataUrl, priority } = body;

  if (!route || !violationType) {
    return NextResponse.json({ error: "route and violationType required" }, { status: 400 });
  }

  let screenshotUrl: string | null = null;
  if (screenshotDataUrl) {
    try {
      const base64 = screenshotDataUrl.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(base64, "base64");
      const fileName = `violations/${Date.now()}.png`;
      const service = createServiceClient();
      const { error: uploadError } = await service.storage
        .from("dev-assets")
        .upload(fileName, buffer, { contentType: "image/png" });
      if (!uploadError) {
        const { data: urlData } = service.storage.from("dev-assets").getPublicUrl(fileName);
        screenshotUrl = urlData?.publicUrl ?? null;
      }
    } catch { /* non-fatal */ }
  }

  const { data, error } = await supabase
    .from("design_violations")
    .insert({
      route,
      element_description: elementDescription ?? null,
      element_selector: elementSelector ?? null,
      violation_type: violationType,
      notes: notes ?? null,
      screenshot_url: screenshotUrl,
      priority: priority ?? "normal",
      status: "open",
      submitted_by: user.id,
    })
    .select("id, violation_type, route, status")
    .single();

  if (error) return apiErrorResponse(error);
  return NextResponse.json({ success: true, violation: data });
  },
);

export const GET = withApiGuardrails(
  "dev/violations#GET",
  async ({ request }) => {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") ?? "open";
  const service = createServiceClient();

  const query = serviceDb.from("design_violations")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  if (status !== "all") {
    query.in("status", status.split(","));
  }

  const { data, error } = await query;
  if (error) return apiErrorResponse(error);
  return NextResponse.json({ violations: data ?? [], total: data?.length ?? 0 });
  },
);

export const PATCH = withApiGuardrails(
  "dev/violations#PATCH",
  async ({ request }) => {
  const body = await request.json();
  const { id, status, fixedInFile } = body;
  if (!id || !status) return NextResponse.json({ error: "id and status required" }, { status: 400 });

  const service = createServiceClient();
  const updates: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };
  if (status === "fixed") {
    updates.fixed_at = new Date().toISOString();
    updates.fixed_in_file = fixedInFile ?? null;
  }

  const { data, error } = await serviceDb.from("design_violations")
    .update(updates)
    .eq("id", id)
    .select("id, status, violation_type, route")
    .single();

  if (error) return apiErrorResponse(error);
  return NextResponse.json({ success: true, violation: data });
  },
);
