import { NextResponse } from "next/server";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { getApiRouteUser } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { serviceDb } from "@/lib/supabase/service-db";
import type { Database, Json } from "@/types/database.types";


/**
 * GET /api/agentation/inbox
 *
 * Returns dev_annotations rows shaped to match the FeedbackItem type used
 * by the annotation-inbox page. This keeps the page's existing UI working
 * while the underlying data comes from the dev pipeline, not client feedback.
 */
export const GET = withApiGuardrails("/api/agentation/inbox#GET", async ({ request }) => {
  const user = await getApiRouteUser();
  if (!user) {
    throw new GuardrailError({ code: "AUTH_EXPIRED", where: "/api/agentation/inbox#GET", message: "Authentication required.", status: 401 });
  }

  const url = new URL(request.url);
  const limitParam = Number.parseInt(url.searchParams.get("limit") || "500", 10);
  const limit = Number.isFinite(limitParam) ? Math.max(1, Math.min(limitParam, 1000)) : 500;

  const supabase = createServiceClient();
  const { data, error } = await serviceDb.from("dev_annotations")
    .select("id, created_at, route, comment, screenshot_url, element_selector, component_hint, status, ai_reply, ai_replied_at, resolved_at, agentation_id, metadata")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new GuardrailError({ code: "INTERNAL_ERROR", where: "/api/agentation/inbox#GET", message: error.message });
  }

  const items = (data ?? []).map((row) => {
    const meta = (row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata))
      ? row.metadata as Record<string, unknown>
      : {};

    const pageUrl = typeof meta.pageUrl === "string" ? meta.pageUrl : "";
    const severity = typeof meta.severity === "string"
      ? (meta.severity === "blocking" ? "high" : meta.severity === "important" ? "medium" : "low")
      : "medium";

    return {
      id: row.id,
      created_at: row.created_at ?? new Date().toISOString(),
      updated_at: row.ai_replied_at ?? row.resolved_at ?? row.created_at ?? new Date().toISOString(),
      title: row.comment.slice(0, 100),
      comment: row.comment,
      page_url: pageUrl,
      page_path: row.route,
      severity,
      status: row.status ?? "open",
      target_selector: row.element_selector ?? row.component_hint ?? "body",
      metadata: {
        ...meta,
        agentationId: row.agentation_id ?? meta.agentationId ?? null,
        componentHint: row.component_hint ?? null,
        screenshotUrl: row.screenshot_url ?? null,
        aiReply: row.ai_reply ?? null,
      },
    };
  });

  return NextResponse.json({ items, total: items.length });
});

/**
 * POST /api/agentation/inbox
 *
 * Creates a new dev_annotations row from the inbox UI (manual task entry).
 * Generates an `agentation_id` automatically so the row shows up in the inbox
 * (the GET handler filters items without one).
 *
 * Body: {
 *   title: string,              // becomes the comment summary
 *   details?: string,           // appended to comment if provided
 *   route?: string,             // page path; defaults to "/annotation-inbox"
 *   pageUrl?: string,
 *   severity?: "blocking" | "important" | "nit",
 *   assignedAgent?: "codex" | "claude_code",
 *   elementSelector?: string,
 *   componentHint?: string
 * }
 */
export const POST = withApiGuardrails("/api/agentation/inbox#POST", async ({ request }) => {
  const user = await getApiRouteUser();
  if (!user) {
    throw new GuardrailError({ code: "AUTH_EXPIRED", where: "/api/agentation/inbox#POST", message: "Authentication required.", status: 401 });
  }

  const body = (await request.json()) as {
    title?: string;
    details?: string;
    route?: string;
    pageUrl?: string;
    severity?: string;
    assignedAgent?: string;
    elementSelector?: string;
    componentHint?: string;
  };

  const title = body.title?.trim();
  if (!title) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  const route = body.route?.trim() || "/annotation-inbox";
  const details = body.details?.trim();
  const comment = details ? `${title}\n\n${details}` : title;

  const allowedSeverities = new Set(["blocking", "important", "nit"]);
  const severity = body.severity && allowedSeverities.has(body.severity) ? body.severity : "important";

  const allowedAgents = new Set(["codex", "claude_code"]);
  const assignedAgent =
    body.assignedAgent && allowedAgents.has(body.assignedAgent) ? body.assignedAgent : null;

  const agentationId = `manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const metadata: Record<string, unknown> = {
    severity,
    source: "manual-inbox",
    createdBy: user.id,
  };
  if (body.pageUrl?.trim()) metadata.pageUrl = body.pageUrl.trim();
  if (assignedAgent) {
    metadata.assignedAgent = assignedAgent;
    metadata.assignedAt = new Date().toISOString();
  }

  const supabase = createServiceClient();
  const { data, error } = await serviceDb.from("dev_annotations")
    .insert({
      route,
      comment,
      element_selector: body.elementSelector?.trim() || null,
      component_hint: body.componentHint?.trim() || null,
      status: "open",
      agentation_id: agentationId,
      created_by: user.id,
      metadata: metadata as Database["public"]["Tables"]["dev_annotations"]["Insert"]["metadata"],
    })
    .select("id, agentation_id")
    .single();

  if (error) {
    throw new GuardrailError({ code: "INTERNAL_ERROR", where: "/api/agentation/inbox#POST", message: error.message });
  }

  return NextResponse.json({ success: true, id: data.id, agentationId: data.agentation_id });
});

/**
 * PATCH /api/agentation/inbox
 *
 * Updates a dev_annotations row — status and/or metadata.
 * Used by the annotation-inbox page for triage actions.
 *
 * Body: { id: string, status?: string, metadata?: Record<string, unknown> }
 */
export const PATCH = withApiGuardrails("/api/agentation/inbox#PATCH", async ({ request }) => {
  const user = await getApiRouteUser();
  if (!user) {
    throw new GuardrailError({ code: "AUTH_EXPIRED", where: "/api/agentation/inbox#PATCH", message: "Authentication required.", status: 401 });
  }

  const body = await request.json() as { id?: string; status?: string; metadata?: Record<string, Json> };
  const { id, status, metadata } = body;

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: existing, error: fetchError } = await serviceDb.from("dev_annotations")
    .select("id, status, metadata")
    .eq("id", id)
    .maybeSingle();

  if (fetchError) {
    throw new GuardrailError({ code: "INTERNAL_ERROR", where: "/api/agentation/inbox#PATCH", message: fetchError.message });
  }
  if (!existing) {
    return NextResponse.json({ error: "Annotation not found" }, { status: 404 });
  }

  const existingMeta =
    existing.metadata && typeof existing.metadata === "object" && !Array.isArray(existing.metadata)
      ? (existing.metadata as Record<string, Json>)
      : {};

  const updates: Database["public"]["Tables"]["dev_annotations"]["Update"] = {};

  if (status) {
    const validStatuses = ["open", "in_progress", "replied", "resolved"];
    updates.status = validStatuses.includes(status) ? status : "in_progress";
    if (updates.status === "resolved") {
      updates.resolved_at = new Date().toISOString();
    }
  }

  if (metadata) {
    updates.metadata = { ...existingMeta, ...metadata };
  }

  const { error: updateError } = await serviceDb.from("dev_annotations")
    .update(updates)
    .eq("id", id);

  if (updateError) {
    throw new GuardrailError({ code: "INTERNAL_ERROR", where: "/api/agentation/inbox#PATCH", message: updateError.message });
  }

  return NextResponse.json({ success: true, id });
});
