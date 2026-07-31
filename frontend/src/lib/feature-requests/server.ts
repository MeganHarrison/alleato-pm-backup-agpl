import "server-only";

import type { Json, TablesInsert, TablesUpdate } from "@/types/database.types";
import { createServiceClient } from "@/lib/supabase/service";
import { serviceDb } from "@/lib/supabase/service-db";
import {
  buildFeatureRequestDraft,
  generateImplementationPlanDraft,
} from "./planning";
import { scoreFeatureRequestReadiness } from "./readiness";
import { writeClaudeCodeHandoffFile } from "./handoffs";
import type {
  FeatureRequestDetail,
  FeatureRequestPacketInput,
  FeatureRequestPacketWidgetPayload,
  FeatureRequestRow,
  FeatureRequestStatus,
  FeatureRequestUpdateInput,
  LinearIssueDraft,
  LinearSubIssueDraftInput,
  ImplementationPlanInput,
  ImplementationPlanRow,
} from "./types";

function asJsonArray(values: string[] | undefined): Json {
  return (values ?? []).filter((value) => value.trim().length > 0);
}

function normalizeTitle(input: FeatureRequestPacketInput): string {
  const fallback = input.rawRequest.trim().replace(/\s+/g, " ");
  return (input.title?.trim() || fallback.slice(0, 96) || "Feature request").slice(0, 140);
}

function normalizeSummary(input: FeatureRequestPacketInput): string {
  return input.assistantSummary?.trim() || input.rawRequest.trim();
}

function normalizeSourceMetadata(value: Record<string, Json> | undefined): Json {
  return value ?? {};
}

function asStringArray(value: Json | null): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

function normalizeLinearTitle(value: string): string {
  return value.trim().replace(/\s+/g, " ").slice(0, 140) || "Feature request follow-up";
}

function normalizeUuid(value: string | null | undefined): string | null {
  if (!value) return null;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? value
    : null;
}

async function recordEvent(params: {
  featureRequestId: string;
  eventType: string;
  title: string;
  body?: string | null;
  metadata?: Json;
  createdBy?: string | null;
}) {
  const supabase = createServiceClient();
  const { error } = await serviceDb.from("feature_request_events").insert({
    feature_request_id: params.featureRequestId,
    event_type: params.eventType,
    title: params.title,
    body: params.body ?? null,
    metadata: params.metadata ?? {},
    created_by: params.createdBy ?? null,
  });
  if (error) {
    throw new Error(`Failed to record feature request event: ${error.message}`);
  }
}

async function fetchLatestPlan(featureRequestId: string): Promise<ImplementationPlanRow | null> {
  const supabase = createServiceClient();
  const { data, error } = await serviceDb.from("implementation_plans")
    .select("*")
    .eq("feature_request_id", featureRequestId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    throw new Error(`Failed to fetch latest implementation plan: ${error.message}`);
  }
  return data;
}

async function applyReadiness(featureRequestId: string): Promise<FeatureRequestRow> {
  const supabase = createServiceClient();
  const { data: request, error } = await serviceDb.from("feature_requests")
    .select("*")
    .eq("id", featureRequestId)
    .single();
  if (error || !request) {
    throw new Error(`Failed to load feature request for readiness scoring: ${error?.message ?? "not found"}`);
  }

  const latestPlan = await fetchLatestPlan(featureRequestId);
  const readiness = scoreFeatureRequestReadiness({ request, latestPlan });
  const { data: updated, error: updateError } = await serviceDb.from("feature_requests")
    .update({
      readiness_goal_clarity: readiness.goalClarity,
      readiness_data_clarity: readiness.dataClarity,
      readiness_ux_clarity: readiness.uxClarity,
      readiness_acceptance_status: readiness.acceptanceStatus,
      readiness_implementation_risk: readiness.implementationRisk,
      readiness_missing_requirements: readiness.missingRequirements,
      ready_for_build: readiness.readyForBuild,
      status: request.status === "handoff_generated" && !readiness.readyForBuild
        ? "handoff_generated"
        : readiness.status,
    })
    .eq("id", featureRequestId)
    .select("*")
    .single();
  if (updateError || !updated) {
    throw new Error(`Failed to update feature request readiness: ${updateError?.message ?? "not found"}`);
  }
  return updated;
}

export function shouldCaptureFeatureRequest(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    /\b(brandon|stakeholder|user|we|i)\b/.test(lower) &&
    [
      "wants a way",
      "feature",
      "workflow improvement",
      "dashboard",
      "report",
      "automation",
      "build",
      "functionality",
      "holding up",
      "blocker",
    ].some((term) => lower.includes(term))
  );
}

export async function findRelatedFeatureRequests(params: {
  query: string;
  projectId?: number | null;
  limit?: number;
}): Promise<FeatureRequestRow[]> {
  const supabase = createServiceClient();
  const normalized = params.query.trim();
  if (!normalized) return [];
  let query = serviceDb.from("feature_requests")
    .select("*")
    .or(`title.ilike.%${normalized}%,raw_request.ilike.%${normalized}%`)
    .order("updated_at", { ascending: false })
    .limit(params.limit ?? 5);
  if (params.projectId != null) {
    query = query.eq("project_id", params.projectId);
  }
  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to search related feature requests: ${error.message}`);
  }
  return data ?? [];
}

export async function captureFeatureRequestPacket(input: FeatureRequestPacketInput): Promise<FeatureRequestRow> {
  const supabase = createServiceClient();
  const payload: TablesInsert<"feature_requests"> = {
    title: normalizeTitle(input),
    requester_name: input.requesterName?.trim() || "Brandon",
    requester_user_id: input.requesterUserId ?? null,
    requester_person_id: input.requesterPersonId ?? null,
    source: input.source ?? "ais_chat",
    project_id: input.projectId ?? null,
    company_id: input.companyId ?? null,
    request_type: input.requestType ?? "workflow_improvement",
    raw_request: input.rawRequest.trim(),
    assistant_summary: normalizeSummary(input),
    stakeholder_problem: input.stakeholderProblem ?? null,
    desired_outcome: input.desiredOutcome ?? null,
    affected_users: asJsonArray(input.affectedUsers),
    affected_pages: asJsonArray(input.affectedPages),
    affected_workflows: asJsonArray(input.affectedWorkflows),
    acceptance_criteria: asJsonArray(input.acceptanceCriteria),
    verification_steps: asJsonArray(input.verificationSteps),
    open_questions: asJsonArray(input.openQuestions),
    assumptions: asJsonArray(input.assumptions),
    priority: input.priority ?? "medium",
    linear_issue_id: input.linearIssueId ?? null,
    linear_issue_url: input.linearIssueUrl ?? null,
    linear_draft_body: input.linearDraftBody ?? null,
    linear_sync_status: input.linearSyncStatus ?? undefined,
    linear_last_synced_at: input.linearLastSyncedAt ?? null,
    linear_sync_error: input.linearSyncError ?? null,
    source_session_id: input.sourceSessionId === undefined ? undefined : normalizeUuid(input.sourceSessionId),
    source_message_id: input.sourceMessageId === undefined ? undefined : normalizeUuid(input.sourceMessageId),
    source_metadata: normalizeSourceMetadata(input.sourceMetadata),
    created_by: input.createdBy ?? input.requesterUserId ?? null,
    updated_by: input.createdBy ?? input.requesterUserId ?? null,
  };

  const { data, error } = await serviceDb.from("feature_requests")
    .insert(payload)
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(`Failed to capture feature request packet: ${error?.message ?? "not found"}`);
  }

  await recordEvent({
    featureRequestId: data.id,
    eventType: "captured",
    title: "AIS captured feature request packet",
    body: input.rawRequest,
    metadata: { source: input.source ?? "ais_chat" },
    createdBy: input.createdBy ?? input.requesterUserId ?? null,
  });

  return applyReadiness(data.id);
}

export async function captureFeatureRequestFromChat(params: {
  rawRequest: string;
  requesterName?: string;
  requesterUserId?: string | null;
  selectedProjectId?: number | null;
  sourceSessionId?: string | null;
  sourceMessageId?: string | null;
}): Promise<FeatureRequestRow> {
  const draft = buildFeatureRequestDraft(params);
  const related = await findRelatedFeatureRequests({
    query: draft.title ?? draft.rawRequest,
    projectId: draft.projectId,
    limit: 1,
  });

  if (related[0]) {
    return updateFeatureRequestPacket(related[0].id, {
      rawRequest: draft.rawRequest,
      assistantSummary: draft.assistantSummary,
      desiredOutcome: draft.desiredOutcome,
      affectedUsers: draft.affectedUsers,
      affectedWorkflows: draft.affectedWorkflows,
      acceptanceCriteria: draft.acceptanceCriteria,
      verificationSteps: draft.verificationSteps,
      openQuestions: draft.openQuestions,
      sourceSessionId: draft.sourceSessionId,
      sourceMessageId: draft.sourceMessageId,
      sourceMetadata: draft.sourceMetadata,
      updatedBy: draft.requesterUserId ?? null,
    });
  }

  return captureFeatureRequestPacket(draft);
}

export async function updateFeatureRequestPacket(
  requestId: string,
  input: FeatureRequestUpdateInput,
): Promise<FeatureRequestRow> {
  const supabase = createServiceClient();
  const update: TablesUpdate<"feature_requests"> = {
    title: input.title,
    requester_name: input.requesterName,
    requester_user_id: input.requesterUserId,
    requester_person_id: input.requesterPersonId,
    source: input.source,
    project_id: input.projectId,
    company_id: input.companyId,
    request_type: input.requestType,
    raw_request: input.rawRequest,
    assistant_summary: input.assistantSummary,
    stakeholder_problem: input.stakeholderProblem,
    desired_outcome: input.desiredOutcome,
    affected_users: input.affectedUsers ? asJsonArray(input.affectedUsers) : undefined,
    affected_pages: input.affectedPages ? asJsonArray(input.affectedPages) : undefined,
    affected_workflows: input.affectedWorkflows ? asJsonArray(input.affectedWorkflows) : undefined,
    acceptance_criteria: input.acceptanceCriteria ? asJsonArray(input.acceptanceCriteria) : undefined,
    verification_steps: input.verificationSteps ? asJsonArray(input.verificationSteps) : undefined,
    open_questions: input.openQuestions ? asJsonArray(input.openQuestions) : undefined,
    assumptions: input.assumptions ? asJsonArray(input.assumptions) : undefined,
    priority: input.priority,
    linear_issue_id: input.linearIssueId,
    linear_issue_url: input.linearIssueUrl,
    linear_draft_body: input.linearDraftBody,
    linear_sync_status: input.linearSyncStatus ?? undefined,
    linear_last_synced_at: input.linearLastSyncedAt,
    linear_sync_error: input.linearSyncError,
    source_session_id: normalizeUuid(input.sourceSessionId),
    source_message_id: normalizeUuid(input.sourceMessageId),
    source_metadata: input.sourceMetadata ? normalizeSourceMetadata(input.sourceMetadata) : undefined,
    updated_by: input.updatedBy ?? null,
  };

  Object.keys(update).forEach((key) => {
    if (update[key as keyof typeof update] === undefined) {
      delete update[key as keyof typeof update];
    }
  });

  const { data, error } = await serviceDb.from("feature_requests")
    .update(update)
    .eq("id", requestId)
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(`Failed to update feature request packet: ${error?.message ?? "not found"}`);
  }

  await recordEvent({
    featureRequestId: requestId,
    eventType: "updated",
    title: "AIS updated feature request packet",
    metadata: { fields: Object.keys(update) },
    createdBy: input.updatedBy ?? null,
  });

  return applyReadiness(requestId);
}

export async function generateImplementationPlan(params: {
  requestId: string;
  input?: ImplementationPlanInput;
}): Promise<ImplementationPlanRow> {
  const supabase = createServiceClient();
  const detail = await getFeatureRequestDetail(params.requestId);
  if (!detail) {
    throw new Error(`Feature request ${params.requestId} was not found.`);
  }

  const latestVersion = detail.latestPlan?.version ?? 0;
  const draft = generateImplementationPlanDraft(detail.request, params.input);
  const { data, error } = await serviceDb.from("implementation_plans")
    .insert({
      feature_request_id: params.requestId,
      version: latestVersion + 1,
      summary: draft.summary,
      affected_routes: draft.affectedRoutes,
      affected_components: draft.affectedComponents,
      affected_tables: draft.affectedTables,
      data_requirements: draft.dataRequirements,
      implementation_steps: draft.implementationSteps,
      acceptance_criteria: draft.acceptanceCriteria,
      verification_steps: draft.verificationSteps,
      risks: draft.risks,
      open_questions: draft.openQuestions,
      generated_by: draft.generatedBy ?? null,
    })
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(`Failed to generate implementation plan: ${error?.message ?? "not found"}`);
  }

  await recordEvent({
    featureRequestId: params.requestId,
    eventType: "plan_generated",
    title: "AIS generated implementation plan",
    body: draft.summary,
    createdBy: draft.generatedBy ?? null,
  });

  await applyReadiness(params.requestId);
  return data;
}

export async function generateClaudeCodeHandoff(params: {
  requestId: string;
  generatedBy?: string | null;
  sessionLabel?: string;
}): Promise<{
  request: FeatureRequestRow;
  plan: ImplementationPlanRow | null;
  handoffPath: string;
  storage: "file" | "inline";
  markdown: string;
  blockedMessage: string | null;
}> {
  const supabase = createServiceClient();
  const detail = await getFeatureRequestDetail(params.requestId);
  if (!detail) {
    throw new Error(`Feature request ${params.requestId} was not found.`);
  }

  const handoff = await writeClaudeCodeHandoffFile({
    request: detail.request,
    plan: detail.latestPlan,
    sessionLabel: params.sessionLabel,
  });

  const { error: handoffError } = await serviceDb.from("execution_handoffs").insert({
    feature_request_id: params.requestId,
    implementation_plan_id: detail.latestPlan?.id ?? null,
    handoff_path: handoff.path,
    handoff_title: handoff.title,
    linear_issue_id: detail.request.linear_issue_id,
    validation_status: handoff.validationStatus,
    validation_errors: handoff.validationErrors,
    generated_by: params.generatedBy ?? null,
  });
  if (handoffError) {
    throw new Error(`Failed to record Claude Code handoff metadata: ${handoffError.message}`);
  }

  const { data: updated, error: updateError } = await serviceDb.from("feature_requests")
    .update({
      claude_handoff_path: handoff.path,
      status: "handoff_generated",
      updated_by: params.generatedBy ?? null,
    })
    .eq("id", params.requestId)
    .select("*")
    .single();
  if (updateError || !updated) {
    throw new Error(`Failed to link Claude Code handoff to feature request: ${updateError?.message ?? "not found"}`);
  }

  await recordEvent({
    featureRequestId: params.requestId,
    eventType: "handoff_generated",
    title: "Claude Code handoff generated",
    body: handoff.storage === "inline" ? handoff.markdown : handoff.path,
    metadata: {
      handoff_path: handoff.path,
      handoff_storage: handoff.storage,
      validation_status: handoff.validationStatus,
      validation_errors: handoff.validationErrors,
    },
    createdBy: params.generatedBy ?? null,
  });

  const rescored = await applyReadiness(params.requestId);
  const readiness = scoreFeatureRequestReadiness({ request: rescored, latestPlan: detail.latestPlan });
  return {
    request: rescored,
    plan: detail.latestPlan,
    handoffPath: handoff.path,
    storage: handoff.storage,
    markdown: handoff.markdown,
    blockedMessage: readiness.blockedMessage,
  };
}

function shouldAdvanceToLinearDraft(status: FeatureRequestStatus): boolean {
  return ["captured", "needs_clarification", "ready_for_planning", "plan_generated"].includes(status);
}

function buildLinearIssueBody(params: {
  request: FeatureRequestRow;
  plan: ImplementationPlanRow | null;
}): string {
  const { request, plan } = params;
  const acceptanceCriteria = asStringArray(request.acceptance_criteria);
  const verificationSteps = asStringArray(request.verification_steps);
  const openQuestions = asStringArray(request.open_questions);
  const assumptions = asStringArray(request.assumptions);
  const implementationSteps = plan ? asStringArray(plan.implementation_steps) : [];
  const affectedRoutes = plan ? asStringArray(plan.affected_routes) : [];
  const affectedTables = plan ? asStringArray(plan.affected_tables) : [];

  const section = (title: string, values: string[], empty: string) => [
    `## ${title}`,
    values.length > 0 ? values.map((value) => `- ${value}`).join("\n") : empty,
  ].join("\n");

  return [
    "Generated from AIS feature request packet.",
    "",
    `Packet: /ai/feature-requests/${request.id}`,
    `Requester: ${request.requester_name}`,
    `Packet status: ${request.status}`,
    `Ready for build: ${request.ready_for_build ? "yes" : "no"}`,
    "",
    "## Stakeholder wording",
    request.raw_request,
    "",
    "## AIS summary",
    request.assistant_summary,
    request.desired_outcome ? `\nDesired outcome: ${request.desired_outcome}` : "",
    "",
    section("Acceptance criteria", acceptanceCriteria, "No acceptance criteria captured yet."),
    "",
    section("Implementation steps", implementationSteps, "No implementation plan steps captured yet."),
    "",
    section("Verification steps", verificationSteps, "No verification steps captured yet."),
    "",
    section("Affected routes", affectedRoutes, "No route scope captured yet."),
    "",
    section("Affected tables", affectedTables, "No table scope captured yet."),
    "",
    section("Open questions", openQuestions, "No open implementation-critical questions."),
    "",
    section("Assumptions", assumptions, "No assumptions recorded yet."),
    "",
    request.claude_handoff_path ? `Claude Code handoff: ${request.claude_handoff_path}` : "",
  ].filter(Boolean).join("\n");
}

function buildDefaultSubIssueDrafts(params: {
  request: FeatureRequestRow;
  plan: ImplementationPlanRow;
}): LinearSubIssueDraftInput[] {
  const steps = asStringArray(params.plan.implementation_steps);
  const verificationSteps = asStringArray(params.plan.verification_steps);
  const acceptanceCriteria = asStringArray(params.plan.acceptance_criteria);
  const baseBody = [
    `Parent packet: /ai/feature-requests/${params.request.id}`,
    `Implementation plan: ${params.plan.id} v${params.plan.version}`,
    "",
    "## Acceptance criteria",
    acceptanceCriteria.length > 0
      ? acceptanceCriteria.map((value) => `- ${value}`).join("\n")
      : "Use the parent packet acceptance criteria.",
    "",
    "## Verification",
    verificationSteps.length > 0
      ? verificationSteps.map((value) => `- ${value}`).join("\n")
      : "Add targeted verification evidence for this slice.",
  ].join("\n");

  if (steps.length === 0) {
    return [
      {
        title: `${params.request.title}: implementation slice`,
        body: baseBody,
        sourceStep: null,
        sortOrder: 1,
      },
    ];
  }

  return steps.map((step, index) => ({
    title: normalizeLinearTitle(`${params.request.title}: ${step}`),
    body: [`## Scope`, step, "", baseBody].join("\n"),
    sourceStep: step,
    sortOrder: index + 1,
  }));
}

async function recordLinearEvent(params: {
  featureRequestId: string;
  subIssueId?: string | null;
  linearIssueId?: string | null;
  eventType: string;
  title: string;
  body?: string | null;
  metadata?: Json;
  createdBy?: string | null;
}) {
  const supabase = createServiceClient();
  const { error } = await serviceDb.from("feature_request_linear_events").insert({
    feature_request_id: params.featureRequestId,
    sub_issue_id: params.subIssueId ?? null,
    linear_issue_id: params.linearIssueId ?? null,
    event_type: params.eventType,
    title: params.title,
    body: params.body ?? null,
    metadata: params.metadata ?? {},
    created_by: params.createdBy ?? null,
  });
  if (error) {
    throw new Error(`Failed to record Linear sync event: ${error.message}`);
  }
}

export async function draftLinearIssueFromFeatureRequest(params: {
  requestId: string;
  draftedBy?: string | null;
}): Promise<{ request: FeatureRequestRow; draft: LinearIssueDraft }> {
  const supabase = createServiceClient();
  const detail = await getFeatureRequestDetail(params.requestId);
  if (!detail) {
    throw new Error(`Feature request ${params.requestId} was not found.`);
  }

  const draft = {
    title: normalizeLinearTitle(detail.request.title),
    body: buildLinearIssueBody({
      request: detail.request,
      plan: detail.latestPlan,
    }),
  };
  const { data, error } = await serviceDb.from("feature_requests")
    .update({
      linear_draft_body: draft.body,
      linear_sync_status: "drafted",
      linear_sync_error: null,
      status: shouldAdvanceToLinearDraft(detail.request.status as FeatureRequestStatus)
        ? "linear_drafted"
        : detail.request.status,
      updated_by: params.draftedBy ?? null,
    })
    .eq("id", params.requestId)
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(`Failed to save Linear issue draft: ${error?.message ?? "not found"}`);
  }

  await recordLinearEvent({
    featureRequestId: params.requestId,
    eventType: "linear_issue_drafted",
    title: "Linear issue draft generated",
    body: draft.title,
    metadata: { title: draft.title },
    createdBy: params.draftedBy ?? null,
  });

  return { request: data, draft };
}

export async function draftLinearSubIssuesFromImplementationPlan(params: {
  requestId: string;
  drafts?: LinearSubIssueDraftInput[];
  draftedBy?: string | null;
}) {
  const supabase = createServiceClient();
  const detail = await getFeatureRequestDetail(params.requestId);
  if (!detail) {
    throw new Error(`Feature request ${params.requestId} was not found.`);
  }
  if (!detail.latestPlan) {
    throw new Error(`Feature request ${params.requestId} does not have an implementation plan to split into Linear sub-issues.`);
  }

  const drafts = (params.drafts && params.drafts.length > 0)
    ? params.drafts
    : buildDefaultSubIssueDrafts({ request: detail.request, plan: detail.latestPlan });

  const deleteQuery = serviceDb.from("feature_request_linear_sub_issues")
    .delete()
    .eq("feature_request_id", params.requestId)
    .eq("implementation_plan_id", detail.latestPlan.id)
    .eq("status", "draft")
    .is("linear_issue_id", null);
  const { error: deleteError } = await deleteQuery;
  if (deleteError) {
    throw new Error(`Failed to clear stale Linear sub-issue drafts: ${deleteError.message}`);
  }

  const rows: TablesInsert<"feature_request_linear_sub_issues">[] = drafts.map((draft, index) => ({
    feature_request_id: params.requestId,
    implementation_plan_id: detail.latestPlan?.id ?? null,
    title: normalizeLinearTitle(draft.title),
    body: draft.body.trim(),
    sort_order: draft.sortOrder ?? index + 1,
    source_step: draft.sourceStep ?? null,
    status: "draft",
    created_by: params.draftedBy ?? null,
    updated_by: params.draftedBy ?? null,
  }));

  const { data, error } = await serviceDb.from("feature_request_linear_sub_issues")
    .insert(rows)
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) {
    throw new Error(`Failed to save Linear sub-issue drafts: ${error.message}`);
  }

  await serviceDb.from("feature_requests")
    .update({
      linear_sync_status: "drafted",
      linear_sync_error: null,
      updated_by: params.draftedBy ?? null,
    })
    .eq("id", params.requestId);

  await recordLinearEvent({
    featureRequestId: params.requestId,
    eventType: "linear_sub_issues_drafted",
    title: "Linear sub-issue drafts generated",
    body: `${data?.length ?? 0} sub-issue drafts generated from implementation plan v${detail.latestPlan.version}.`,
    metadata: { count: data?.length ?? 0, implementation_plan_id: detail.latestPlan.id },
    createdBy: params.draftedBy ?? null,
  });

  return data ?? [];
}

export async function attachLinearIssueToFeatureRequest(params: {
  requestId: string;
  linearIssueId: string;
  linearIssueUrl: string;
  attachedBy?: string | null;
}): Promise<FeatureRequestRow> {
  const supabase = createServiceClient();
  const { data, error } = await serviceDb.from("feature_requests")
    .update({
      linear_issue_id: params.linearIssueId,
      linear_issue_url: params.linearIssueUrl,
      linear_sync_status: "created",
      linear_sync_error: null,
      linear_last_synced_at: new Date().toISOString(),
      status: "linear_drafted",
      updated_by: params.attachedBy ?? null,
    })
    .eq("id", params.requestId)
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(`Failed to attach Linear issue to feature request: ${error?.message ?? "not found"}`);
  }

  await recordLinearEvent({
    featureRequestId: params.requestId,
    linearIssueId: params.linearIssueId,
    eventType: "linear_issue_attached",
    title: "Linear issue attached to packet",
    body: params.linearIssueUrl,
    metadata: { linear_issue_url: params.linearIssueUrl },
    createdBy: params.attachedBy ?? null,
  });

  return data;
}

export async function attachLinearSubIssueToFeatureRequest(params: {
  subIssueId: string;
  linearIssueId: string;
  linearIssueUrl: string;
  linearState?: string | null;
  attachedBy?: string | null;
}) {
  const supabase = createServiceClient();
  const { data, error } = await serviceDb.from("feature_request_linear_sub_issues")
    .update({
      linear_issue_id: params.linearIssueId,
      linear_issue_url: params.linearIssueUrl,
      linear_state: params.linearState ?? null,
      status: "created",
      sync_notes: null,
      updated_by: params.attachedBy ?? null,
    })
    .eq("id", params.subIssueId)
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(`Failed to attach Linear sub-issue: ${error?.message ?? "not found"}`);
  }

  await recordLinearEvent({
    featureRequestId: data.feature_request_id,
    subIssueId: data.id,
    linearIssueId: params.linearIssueId,
    eventType: "linear_sub_issue_attached",
    title: "Linear sub-issue attached to packet",
    body: params.linearIssueUrl,
    metadata: { linear_issue_url: params.linearIssueUrl, linear_state: params.linearState ?? null },
    createdBy: params.attachedBy ?? null,
  });

  return data;
}

export async function recordLinearStatusUpdateForFeatureRequest(params: {
  requestId: string;
  linearIssueId?: string | null;
  linearState?: string | null;
  commentBody?: string | null;
  syncStatus?: "synced" | "blocked";
  syncError?: string | null;
  recordedBy?: string | null;
}): Promise<FeatureRequestRow> {
  const supabase = createServiceClient();
  const syncStatus = params.syncStatus ?? (params.syncError ? "blocked" : "synced");
  const { data, error } = await serviceDb.from("feature_requests")
    .update({
      linear_sync_status: syncStatus,
      linear_sync_error: params.syncError ?? null,
      linear_last_synced_at: new Date().toISOString(),
      updated_by: params.recordedBy ?? null,
    })
    .eq("id", params.requestId)
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(`Failed to record Linear status on feature request: ${error?.message ?? "not found"}`);
  }

  await recordLinearEvent({
    featureRequestId: params.requestId,
    linearIssueId: params.linearIssueId ?? data.linear_issue_id,
    eventType: params.commentBody ? "linear_comment_synced" : "linear_status_synced",
    title: params.linearState ? `Linear status synced: ${params.linearState}` : "Linear status synced",
    body: params.commentBody ?? null,
    metadata: {
      linear_state: params.linearState ?? null,
      sync_status: syncStatus,
      sync_error: params.syncError ?? null,
    },
    createdBy: params.recordedBy ?? null,
  });

  return data;
}

export async function listFeatureRequests(): Promise<FeatureRequestRow[]> {
  const supabase = createServiceClient();
  const { data, error } = await serviceDb.from("feature_requests")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(100);
  if (error) {
    throw new Error(`Failed to list feature requests: ${error.message}`);
  }
  return data ?? [];
}

export async function getFeatureRequestDetail(requestId: string): Promise<FeatureRequestDetail | null> {
  const supabase = createServiceClient();
  const { data: request, error: requestError } = await serviceDb.from("feature_requests")
    .select("*")
    .eq("id", requestId)
    .maybeSingle();
  if (requestError) {
    throw new Error(`Failed to load feature request: ${requestError.message}`);
  }
  if (!request) return null;

  const [
    { data: events, error: eventsError },
    { data: linearEvents, error: linearEventsError },
    { data: linearSubIssues, error: linearSubIssuesError },
    { data: plans, error: plansError },
    { data: handoffs, error: handoffsError },
  ] = await Promise.all([
      serviceDb.from("feature_request_events")
        .select("*")
        .eq("feature_request_id", requestId)
        .order("created_at", { ascending: false }),
      serviceDb.from("feature_request_linear_events")
        .select("*")
        .eq("feature_request_id", requestId)
        .order("created_at", { ascending: false }),
      serviceDb.from("feature_request_linear_sub_issues")
        .select("*")
        .eq("feature_request_id", requestId)
        .order("sort_order", { ascending: true }),
      serviceDb.from("implementation_plans")
        .select("*")
        .eq("feature_request_id", requestId)
        .order("version", { ascending: false })
        .limit(1),
      serviceDb.from("execution_handoffs")
        .select("*")
        .eq("feature_request_id", requestId)
        .order("created_at", { ascending: false }),
    ]);
  if (eventsError) throw new Error(`Failed to load feature request events: ${eventsError.message}`);
  if (linearEventsError) throw new Error(`Failed to load Linear sync events: ${linearEventsError.message}`);
  if (linearSubIssuesError) throw new Error(`Failed to load Linear sub-issues: ${linearSubIssuesError.message}`);
  if (plansError) throw new Error(`Failed to load implementation plans: ${plansError.message}`);
  if (handoffsError) throw new Error(`Failed to load execution handoffs: ${handoffsError.message}`);

  return {
    request,
    events: events ?? [],
    linearEvents: linearEvents ?? [],
    linearSubIssues: linearSubIssues ?? [],
    latestPlan: plans?.[0] ?? null,
    handoffs: handoffs ?? [],
  };
}

export function buildFeatureRequestPacketWidget(params: {
  request: FeatureRequestRow;
  latestPlan?: ImplementationPlanRow | null;
}): FeatureRequestPacketWidgetPayload {
  const readiness = scoreFeatureRequestReadiness({
    request: params.request,
    latestPlan: params.latestPlan ?? null,
  });
  const openQuestions = Array.isArray(params.request.open_questions)
    ? params.request.open_questions.filter((item): item is string => typeof item === "string")
    : [];
  const acceptanceCriteria = Array.isArray(params.request.acceptance_criteria)
    ? params.request.acceptance_criteria.filter((item): item is string => typeof item === "string")
    : [];

  return {
    type: "feature_request_packet",
    id: `feature-request-${params.request.id}`,
    title: params.request.title,
    requestId: params.request.id,
    status: params.request.status as FeatureRequestStatus,
    readinessLabel: readiness.label,
    readyForBuild: readiness.readyForBuild,
    openQuestions,
    acceptanceCriteriaCount: acceptanceCriteria.length,
    linearIssueUrl: params.request.linear_issue_url,
    linearSyncStatus: params.request.linear_sync_status,
    handoffPath: params.request.claude_handoff_path,
    detailHref: `/ai/feature-requests/${params.request.id}`,
  };
}
