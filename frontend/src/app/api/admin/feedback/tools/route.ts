import { NextResponse } from "next/server";
import { z } from "zod";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { getApiRouteUser } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { serviceDb } from "@/lib/supabase/service-db";
import { matchFeedbackToTool, getToolById, listTools } from "@/lib/admin-feedback/tool-matcher";
import { resolveToolContext, contextToAgentPayload } from "@/lib/admin-feedback/context-resolver";

// ---------------------------------------------------------------------------
// GET — List all tools (for assignment dropdown) or match a feedback item
// ---------------------------------------------------------------------------

const querySchema = z.object({
  action: z.enum(["list", "match", "resolve"]),
  feedbackId: z.string().uuid().optional(),
  toolId: z.coerce.number().int().positive().optional(),
});

// Throws AUTH_EXPIRED (401) for missing session and AUTH_FORBIDDEN (403) for
// non-admin authenticated user. Distinguishing these matters: clients use 401
// to redirect to login and 403 to show a permission error.
async function requireAdmin(where: string) {
  const user = await getApiRouteUser();
  if (!user) {
    throw new GuardrailError({
      code: "UNAUTHORIZED",
      where,
      message: "Authentication required.",
      status: 401,
    });
  }

  const supabase = createServiceClient();
  const { data: profile } = await serviceDb.from("user_profiles")
    .select("id, is_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.is_admin) {
    throw new GuardrailError({
      code: "AUTH_FORBIDDEN",
      where,
      message: "Admin access required.",
      status: 403,
    });
  }

  return user;
}

export const GET = withApiGuardrails("/api/admin/feedback/tools#GET", async ({ request }) => {
  await requireAdmin("/api/admin/feedback/tools#GET");

  const url = new URL(request.url);
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { action, feedbackId, toolId } = parsed.data;

  if (action === "list") {
    const tools = await listTools();
    return NextResponse.json({ tools });
  }

  if (action === "match" && feedbackId) {
    const supabase = createServiceClient();
    const { data: item } = await serviceDb.from("admin_feedback_items")
      .select("title, comment, page_path, page_url")
      .eq("id", feedbackId)
      .maybeSingle();

    if (!item) {
      return NextResponse.json({ error: "Feedback item not found" }, { status: 404 });
    }

    const match = await matchFeedbackToTool(item.title, item.comment, item.page_path, item.page_url);
    if (!match) {
      return NextResponse.json({ match: null, message: "No tool matched above threshold" });
    }

    const context = resolveToolContext(match);
    return NextResponse.json({ match, context });
  }

  if (action === "resolve" && toolId) {
    const tool = await getToolById(toolId);
    if (!tool) {
      return NextResponse.json({ error: "Tool not found" }, { status: 404 });
    }
    const context = resolveToolContext(tool);
    return NextResponse.json({ tool, context });
  }

  return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
});

// ---------------------------------------------------------------------------
// POST — Assign a tool to a feedback item (manual or auto)
// ---------------------------------------------------------------------------

const assignSchema = z.object({
  feedbackId: z.string().uuid(),
  toolId: z.number().int().positive().nullable(),
  auto: z.boolean().optional(),
});

export const POST = withApiGuardrails("/api/admin/feedback/tools#POST", async ({ request }) => {
  await requireAdmin("/api/admin/feedback/tools#POST");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new GuardrailError({ code: "INVALID_PAYLOAD", where: "/api/admin/feedback/tools#POST", message: "Request body is not valid JSON." });
  }
  const parsed = assignSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { feedbackId, auto } = parsed.data;
  let { toolId } = parsed.data;
  const supabase = createServiceClient();

  if (auto) {
    const { data: item } = await serviceDb.from("admin_feedback_items")
      .select("title, comment, page_path, page_url")
      .eq("id", feedbackId)
      .maybeSingle();

    if (!item) {
      return NextResponse.json({ error: "Feedback item not found" }, { status: 404 });
    }

    const match = await matchFeedbackToTool(item.title, item.comment, item.page_path, item.page_url);
    toolId = match?.id ?? null;
  }

  let agentContext: Record<string, unknown> | null = null;
  if (toolId) {
    const tool = await getToolById(toolId);
    if (tool) {
      const context = resolveToolContext(tool);
      agentContext = contextToAgentPayload(context);
    }
  }

  const { data: updated, error } = await serviceDb.from("admin_feedback_items")
    .update({
      tool_id: toolId,
      agent_context: agentContext as import("@/types/database.types").Json | null,
    })
    .eq("id", feedbackId)
    .select("id, tool_id, agent_context")
    .maybeSingle();

  if (error) {
    throw new GuardrailError({ code: "INTERNAL_ERROR", where: "/api/admin/feedback/tools#POST", message: error.message });
  }

  return NextResponse.json({ item: updated });
});
