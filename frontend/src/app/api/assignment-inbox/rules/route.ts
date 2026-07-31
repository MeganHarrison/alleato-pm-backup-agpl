export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { getIsAdmin } from "@/lib/auth/current-user";
import { getApiRouteUser } from "@/lib/supabase/server";
import {
  createRagServiceClient,
  createServiceClient,
} from "@/lib/supabase/service";
import { serviceDb } from "@/lib/supabase/service-db";

const WHERE = "api.assignment-inbox.rules.GET";

export const GET = withApiGuardrails(WHERE, async () => {
  const user = await getApiRouteUser();
  if (!user) {
    throw new GuardrailError({
      code: "AUTH_EXPIRED",
      where: WHERE,
      message: "Sign in to view project assignment rules.",
      status: 401,
    });
  }

  const isAdmin = await getIsAdmin();
  const serviceSupabase = createServiceClient();

  const { data: rules, error: rulesError } = await serviceDb.from("project_attribution_rules")
    .select(
      "id, project_id, rule_type, pattern, confidence, priority, source, notes, status, updated_at, projects:project_id(name)",
    )
    .order("status", { ascending: true })
    .order("priority", { ascending: true })
    .order("updated_at", { ascending: false })
    .limit(1000);

  if (rulesError) {
    throw new GuardrailError({
      code: "UPSTREAM_FAILURE",
      where: WHERE,
      message: "Failed to load project attribution rules.",
      details: rulesError.message,
    });
  }

  let pendingCandidates: number | null = null;

  if (isAdmin) {
    const ragSupabase = createRagServiceClient();
    const { count, error: candidateError } = await ragSupabase
      .from("document_attribution_candidates")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending_review");

    if (candidateError) {
      throw new GuardrailError({
        code: "UPSTREAM_FAILURE",
        where: WHERE,
        message: "Failed to load pending attribution candidate count.",
        details: candidateError.message,
      });
    }

    pendingCandidates = count ?? 0;
  }

  const mappedRules = (rules ?? []).map((rule) => ({
    id: rule.id,
    projectId: rule.project_id,
    projectName:
      Array.isArray(rule.projects) && rule.projects[0]?.name
        ? rule.projects[0].name
        : `Project ${rule.project_id}`,
    ruleType: rule.rule_type,
    pattern: rule.pattern,
    confidence: rule.confidence,
    priority: rule.priority,
    source: rule.source,
    notes: rule.notes,
    status: rule.status,
    updatedAt: rule.updated_at,
  }));

  return NextResponse.json({
    isAdmin,
    rules: mappedRules,
    counts: {
      active: mappedRules.filter((rule) => rule.status === "active").length,
      inactive: mappedRules.filter((rule) => rule.status === "inactive").length,
      pendingCandidates,
    },
  });
});
