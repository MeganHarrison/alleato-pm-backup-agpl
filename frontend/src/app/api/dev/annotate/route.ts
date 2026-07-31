/**
 * /api/dev/annotate
 *
 * Dev-only endpoint for the in-app AI coding bridge.
 * Megan annotates pages; Claude Code polls and replies.
 *
 * POST  — create a new annotation (from the overlay UI)
 * GET   — list open annotations (polled by Claude Code watcher)
 * PATCH — post Claude Code's reply back (called by watcher script)
 *
 * This route is intentionally not guarded by NODE_ENV check at the
 * network level — the overlay component handles that. The RLS policy
 * on dev_annotations handles data security.
 */

import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { serviceDb } from "@/lib/supabase/service-db";
import { apiErrorResponse } from "@/lib/api-error";

// POST — create annotation from overlay
export const POST = withApiGuardrails(
  "dev/annotate#POST",
  async ({ request }) => {
  const supabase = await createClient();
  const user = await getApiRouteUser();
  if (!user) {
    throw new GuardrailError({ code: "AUTH_EXPIRED", where: "dev/annotate#POST", message: "Authentication required." });
  }

  const body = await request.json();
  const { route, comment, screenshotDataUrl, elementSelector, componentHint } = body;

  if (!route || !comment) {
    return NextResponse.json({ error: "route and comment are required" }, { status: 400 });
  }

  // Upload screenshot to Supabase storage if provided
  let screenshotUrl: string | null = null;
  if (screenshotDataUrl) {
    try {
      const base64Data = screenshotDataUrl.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");
      const fileName = `annotations/${Date.now()}-${user.id.slice(0, 8)}.png`;
      const service = createServiceClient();
      const { error: uploadError } = await service.storage
        .from("dev-assets")
        .upload(fileName, buffer, { contentType: "image/png", upsert: false });
      if (!uploadError) {
        const { data: urlData } = service.storage.from("dev-assets").getPublicUrl(fileName);
        screenshotUrl = urlData?.publicUrl ?? null;
      }
	    } catch (error) {
	      console.warn("[dev/annotate] Screenshot upload failed; saving annotation without screenshot.", { error });
	    }
	  }

  const { data, error } = await supabase
    .from("dev_annotations")
    .insert({
      route,
      comment,
      screenshot_url: screenshotUrl,
      element_selector: elementSelector ?? null,
      component_hint: componentHint ?? null,
      status: "open",
      created_by: user.id,
    })
    .select("id, route, comment, status, created_at")
    .single();

  if (error) return apiErrorResponse(error);
  return NextResponse.json({ success: true, annotation: data });
  },
);

// GET — list open/in-progress annotations (for Claude Code watcher)
export const GET = withApiGuardrails(
  "dev/annotate#GET",
  async ({ request }) => {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") ?? "open";

  // Watcher uses service client (has full access)
  const service = createServiceClient();
  const { data, error } = await serviceDb.from("dev_annotations")
    .select("*")
    .in("status", status === "all" ? ["open", "in_progress", "replied", "resolved"] : [status])
    .order("created_at", { ascending: true })
    .limit(50);

  if (error) return apiErrorResponse(error);
  return NextResponse.json({ annotations: data ?? [] });
  },
);

// PATCH — Claude Code posts its reply
export const PATCH = withApiGuardrails(
  "dev/annotate#PATCH",
  async ({ request }) => {
  const body = await request.json();
  const { id, reply, status } = body;

  if (!id || !reply) {
    return NextResponse.json({ error: "id and reply are required" }, { status: 400 });
  }

  const service = createServiceClient();
  const { data, error } = await serviceDb.from("dev_annotations")
    .update({
      ai_reply: reply,
      ai_replied_at: new Date().toISOString(),
      status: status ?? "replied",
    })
    .eq("id", id)
    .select("id, status, ai_replied_at")
    .single();

  if (error) return apiErrorResponse(error);
  return NextResponse.json({ success: true, annotation: data });
  },
);
