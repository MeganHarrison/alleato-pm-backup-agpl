export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";

import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { withApiGuardrails, parseJsonBody } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";

const WHERE_GET = "/api/admin/ai-agents#GET";
const WHERE_PATCH = "/api/admin/ai-agents#PATCH";

async function requireAdmin(where: string) {
  const supabase = await createClient();
  const user = await getApiRouteUser();

  if (!user) {
    throw new GuardrailError({
      code: "AUTH_EXPIRED",
      where,
      message: "Sign in required.",
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
      code: "FORBIDDEN",
      where,
      message: "Admin access required.",
      status: 403,
    });
  }

  return { supabase };
}

// ─── GET /api/admin/ai-agents ─────────────────────────────────────────────────

export const GET = withApiGuardrails(WHERE_GET, async ({ request }) => {
  const { supabase } = await requireAdmin(WHERE_GET);

  const url = request.nextUrl;
  const status = url.searchParams.get("status") ?? undefined;
  const domain = url.searchParams.get("domain") ?? undefined;
  const impact = url.searchParams.get("impact") ?? undefined;

  let query = supabase
    .from("ai_agents")
    .select("*")
    .order("priority_score", { ascending: false });

  if (status) query = query.eq("status", status);
  if (domain) query = query.eq("domain", domain);
  if (impact) query = query.eq("estimated_impact", impact);

  const { data, error } = await query;

  if (error) {
    throw new GuardrailError({
      code: "DB_ERROR",
      where: WHERE_GET,
      message: "Failed to load agent registry.",
      status: 500,
      details: error.message,
    });
  }

  // Compute run stats for each agent
  const agentIds = (data ?? []).map((a) => a.id);
  const runStats: Record<string, { lastRun: string | null; successRate: number; totalRuns: number }> =
    {};
  const recentRuns: Record<string, Array<{
    id: string;
    project_id: number | null;
    started_at: string | null;
    completed_at: string | null;
    status: string | null;
    confidence_score: number | null;
    output_count: number | null;
    tokens_used: number | null;
    error_message: string | null;
    metadata: unknown;
    created_at: string;
  }>> = {};

  if (agentIds.length > 0) {
    const { data: runs } = await supabase
      .from("ai_agent_runs")
      .select(
        "id, agent_id, project_id, started_at, completed_at, status, confidence_score, output_count, tokens_used, error_message, metadata, created_at",
      )
      .in("agent_id", agentIds)
      .order("created_at", { ascending: false });

    if (runs) {
      const byAgent: Record<string, typeof runs> = {};
      for (const run of runs) {
        if (!byAgent[run.agent_id]) byAgent[run.agent_id] = [];
        byAgent[run.agent_id].push(run);
      }
      for (const [agentId, agentRuns] of Object.entries(byAgent)) {
        const successes = agentRuns.filter((r) => r.status === "success").length;
        runStats[agentId] = {
          lastRun: agentRuns[0]?.completed_at ?? null,
          successRate: agentRuns.length > 0 ? Math.round((successes / agentRuns.length) * 100) : 0,
          totalRuns: agentRuns.length,
        };
        recentRuns[agentId] = agentRuns.slice(0, 5).map((run) => ({
          id: run.id,
          project_id: run.project_id,
          started_at: run.started_at,
          completed_at: run.completed_at,
          status: run.status,
          confidence_score: run.confidence_score,
          output_count: run.output_count,
          tokens_used: run.tokens_used,
          error_message: run.error_message,
          metadata: run.metadata,
          created_at: run.created_at,
        }));
      }
    }
  }

  const agents = (data ?? []).map((agent) => ({
    ...agent,
    runStats: runStats[agent.id] ?? { lastRun: null, successRate: 0, totalRuns: 0 },
    recentRuns: recentRuns[agent.id] ?? [],
    gapCount: [
      !agent.success_metric,
      !agent.confidence_threshold,
      !agent.failure_behavior,
      !agent.output_destination,
    ].filter(Boolean).length,
  }));

  return NextResponse.json({ agents });
});

// ─── PATCH /api/admin/ai-agents ───────────────────────────────────────────────

const patchSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["planned", "building", "beta", "production", "deprecated"]).optional(),
  priority_score: z.number().int().min(1).max(100).optional(),
  notes: z.string().max(2000).nullable().optional(),
  success_metric: z.string().max(500).nullable().optional(),
  confidence_threshold: z.number().min(0).max(1).nullable().optional(),
  failure_behavior: z.string().max(500).nullable().optional(),
  approval_required: z.boolean().nullable().optional(),
});

export const PATCH = withApiGuardrails(WHERE_PATCH, async ({ request }) => {
  const { supabase } = await requireAdmin(WHERE_PATCH);
  const body = await parseJsonBody(request, patchSchema, WHERE_PATCH);

  const { id, ...updates } = body;

  const { data, error } = await supabase
    .from("ai_agents")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new GuardrailError({
      code: "DB_ERROR",
      where: WHERE_PATCH,
      message: "Failed to update agent.",
      status: 500,
      details: error.message,
    });
  }

  return NextResponse.json({ agent: data });
});
