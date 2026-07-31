import { NextResponse } from "next/server";
import { z } from "zod";

import { withApiGuardrails, parseJsonBody } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { serviceDb } from "@/lib/supabase/service-db";

const ruleTypes = ["title_keyword", "keyword", "phrase", "email", "domain"] as const;
const ruleStatuses = ["active", "inactive"] as const;

const createRuleSchema = z.object({
  projectId: z.number().int().positive(),
  ruleType: z.enum(ruleTypes).default("title_keyword"),
  pattern: z.string().trim().min(2).max(200),
  confidence: z.number().min(0.5).max(1).default(0.97),
  priority: z.number().int().min(1).max(500).default(35),
  notes: z.string().trim().max(1000).optional().nullable(),
});

const updateRuleSchema = z.object({
  ruleId: z.string().uuid(),
  status: z.enum(ruleStatuses).optional(),
  confidence: z.number().min(0.5).max(1).optional(),
  priority: z.number().int().min(1).max(500).optional(),
  notes: z.string().trim().max(1000).optional().nullable(),
});

function normalizePattern(pattern: string) {
  return pattern
    .toLowerCase()
    .replace(/[^a-z0-9@.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function requireAdmin(where: string) {
  const supabase = await createClient();
  const user = await getApiRouteUser();

  if (!user) {
    throw new GuardrailError({
      code: "AUTH_EXPIRED",
      where,
      message: "Sign in before editing project attribution rules.",
      status: 401,
    });
  }

  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (profileError || !profile?.is_admin) {
    throw new GuardrailError({
      code: "FORBIDDEN",
      where,
      message: "Admin access is required to edit project attribution rules.",
      status: 403,
    });
  }

  return user;
}

export const GET = withApiGuardrails("api.admin.project-attribution-rules.GET", async () => {
  await requireAdmin("api.admin.project-attribution-rules.GET");

  const [{ data: rules, error: rulesError }, { data: projects, error: projectsError }] =
    await Promise.all([
      serviceDb.from("project_attribution_rules")
        .select(
          "id, project_id, rule_type, pattern, pattern_normalized, confidence, priority, source, notes, status, created_at, updated_at",
        )
        .order("status", { ascending: true })
        .order("priority", { ascending: true })
        .order("updated_at", { ascending: false })
        .limit(1000),
      serviceDb.from("projects")
        .select("id, name, project_number, archived")
        .eq("archived", false)
        .order("name", { ascending: true }),
    ]);

  if (rulesError) {
    throw new GuardrailError({
      code: "UPSTREAM_FAILURE",
      where: "api.admin.project-attribution-rules.GET",
      message: "Failed to load project attribution rules.",
      details: rulesError.message,
    });
  }

  if (projectsError) {
    throw new GuardrailError({
      code: "UPSTREAM_FAILURE",
      where: "api.admin.project-attribution-rules.GET",
      message: "Failed to load active projects for attribution rules.",
      details: projectsError.message,
    });
  }

  const projectNameById = new Map((projects ?? []).map((project) => [project.id, project.name]));

  return NextResponse.json({
    rules: (rules ?? []).map((rule) => ({
      ...rule,
      project_name: projectNameById.get(rule.project_id) ?? `Project ${rule.project_id}`,
    })),
    projects: projects ?? [],
  });
});

export const POST = withApiGuardrails(
  "api.admin.project-attribution-rules.POST",
  async ({ request }) => {
    await requireAdmin("api.admin.project-attribution-rules.POST");
    const body = await parseJsonBody(
      request,
      createRuleSchema,
      "api.admin.project-attribution-rules.POST",
    );
        const patternNormalized = normalizePattern(body.pattern);

    if (!patternNormalized) {
      throw new GuardrailError({
        code: "INVALID_PAYLOAD",
        where: "api.admin.project-attribution-rules.POST",
        message: "Attribution rule pattern must contain searchable text.",
        status: 422,
      });
    }

    const { data: project, error: projectError } = await serviceDb.from("projects")
      .select("id, name")
      .eq("id", body.projectId)
      .eq("archived", false)
      .single();

    if (projectError || !project) {
      throw new GuardrailError({
        code: "ROUTE_BINDING_MISSING",
        where: "api.admin.project-attribution-rules.POST",
        message: "Active project was not found for the attribution rule.",
        status: 404,
        details: projectError?.message,
      });
    }

    const { data: rule, error } = await serviceDb.from("project_attribution_rules")
      .upsert(
        {
          project_id: body.projectId,
          rule_type: body.ruleType,
          pattern: body.pattern,
          pattern_normalized: patternNormalized,
          confidence: body.confidence,
          priority: body.priority,
          source: "manual_admin",
          notes: body.notes ?? null,
          status: "active",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "project_id,rule_type,pattern_normalized" },
      )
      .select(
        "id, project_id, rule_type, pattern, pattern_normalized, confidence, priority, source, notes, status, created_at, updated_at",
      )
      .single();

    if (error || !rule) {
      throw new GuardrailError({
        code: "UPSTREAM_FAILURE",
        where: "api.admin.project-attribution-rules.POST",
        message: "Failed to save project attribution rule.",
        details: error?.message,
      });
    }

    return NextResponse.json({
      rule: {
        ...rule,
        project_name: project.name,
      },
    });
  },
);

export const PATCH = withApiGuardrails(
  "api.admin.project-attribution-rules.PATCH",
  async ({ request }) => {
    await requireAdmin("api.admin.project-attribution-rules.PATCH");
    const body = await parseJsonBody(
      request,
      updateRuleSchema,
      "api.admin.project-attribution-rules.PATCH",
    );

    const update: {
      status?: (typeof ruleStatuses)[number];
      confidence?: number;
      priority?: number;
      notes?: string | null;
      updated_at: string;
    } = {
      updated_at: new Date().toISOString(),
    };

    if (body.status) update.status = body.status;
    if (typeof body.confidence === "number") update.confidence = body.confidence;
    if (typeof body.priority === "number") update.priority = body.priority;
    if ("notes" in body) update.notes = body.notes ?? null;

    const { data: rule, error } = await serviceDb.from("project_attribution_rules")
      .update(update)
      .eq("id", body.ruleId)
      .select(
        "id, project_id, rule_type, pattern, pattern_normalized, confidence, priority, source, notes, status, created_at, updated_at",
      )
      .single();

    if (error || !rule) {
      throw new GuardrailError({
        code: "UPSTREAM_FAILURE",
        where: "api.admin.project-attribution-rules.PATCH",
        message: "Failed to update project attribution rule.",
        details: error?.message,
      });
    }

    const { data: project } = await serviceDb.from("projects")
      .select("name")
      .eq("id", rule.project_id)
      .single();

    return NextResponse.json({
      rule: {
        ...rule,
        project_name: project?.name ?? `Project ${rule.project_id}`,
      },
    });
  },
);
