import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { projectPublishedLookahead } from "@/lib/scheduling/schedule-lookahead";
import { buildScheduleRiskSummary } from "@/lib/scheduling/schedule-risk-summary";
import { throwScheduleDatabaseError, throwScheduleRequestError } from "@/lib/scheduling/schedule-route-errors";
import { selectTradePublishedActivities } from "@/lib/scheduling/schedule-trade-visibility";
import { evaluateLinkedSubmittalRisk } from "@/lib/scheduling/submittal-risk";
import { isAuthError, verifyProjectAccess } from "@/lib/supabase/auth-guard";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";

const ROUTE_WHERE = "projects/[projectId]/scheduling/reports#GET";
const projectIdSchema = z.coerce.number().int().positive();
const lookaheadQuerySchema = z.object({
  weeks: z.coerce.number().pipe(z.union([z.literal(2), z.literal(3), z.literal(6)])),
  start_date: z.string().date(),
  revision_id: z.string().uuid().optional(),
});

type SnapshotTask = Pick<Database["public"]["Tables"]["schedule_revision_task_snapshots"]["Row"], "source_task_id" | "name" | "start_date" | "finish_date" | "forecast_start_date" | "forecast_finish_date" | "is_milestone" | "constraint_type" | "constraint_date">;
type SnapshotDependency = Pick<Database["public"]["Tables"]["schedule_revision_dependency_snapshots"]["Row"], "task_source_id" | "predecessor_source_id" | "dependency_type" | "lag_days">;
type SubmittalSnapshot = Pick<Database["public"]["Tables"]["schedule_revision_submittal_snapshots"]["Row"], "source_task_id" | "submittal_id" | "submittal_number" | "title" | "submittal_status" | "required_approval_date" | "response_statuses">;

async function requireAuthenticatedProject(projectId: string, view: string): Promise<number> {
  const where = `${ROUTE_WHERE}:${view}`;
  if (!await getApiRouteUser()) {
    throw new GuardrailError({ code: "AUTH_EXPIRED", where, message: "Authentication required." });
  }
  const parsed = projectIdSchema.safeParse(projectId);
  if (!parsed.success) {
    throwScheduleRequestError(where, "Select a valid project before loading schedule reports.");
  }
  return parsed.data;
}

async function loadLookahead(request: NextRequest, projectIdValue: string) {
  const view = "lookahead";
  const where = `${ROUTE_WHERE}:${view}`;
  const projectId = await requireAuthenticatedProject(projectIdValue, view);
  const parsed = lookaheadQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) {
    throwScheduleRequestError(where, "Select a 2-, 3-, or 6-week lookahead and a valid start date.");
  }

  const supabase = await createClient();
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("current_schedule_revision_id")
    .eq("id", projectId)
    .maybeSingle();
  if (projectError) throwScheduleDatabaseError(where, projectError);
  if (!project?.current_schedule_revision_id) {
    throwScheduleRequestError(where, "No published schedule revision is available for this report.", { code: "NOT_FOUND", status: 404 });
  }
  if (parsed.data.revision_id && parsed.data.revision_id !== project.current_schedule_revision_id) {
    throwScheduleRequestError(where, "The requested lookahead revision is no longer the published current revision.", { code: "PRECONDITION_FAILED", status: 409 });
  }
  const { data: revision, error: revisionError } = await supabase
    .from("schedule_revisions")
    .select("id, project_id, revision_number, status, snapshot_context_provenance")
    .eq("id", project.current_schedule_revision_id)
    .eq("project_id", projectId)
    .eq("status", "published")
    .maybeSingle();
  if (revisionError) throwScheduleDatabaseError(where, revisionError);
  if (!revision) {
    throwScheduleRequestError(where, "No published schedule revision is available for this report.", { code: "NOT_FOUND", status: 404 });
  }

  const { data: tasks, error: taskError } = await supabase
    .from("schedule_revision_task_snapshots")
    .select("source_task_id, name, start_date, finish_date, forecast_start_date, forecast_finish_date, is_milestone, constraint_type, constraint_date")
    .eq("revision_id", revision.id)
    .order("sort_order", { ascending: true });
  if (taskError) throwScheduleDatabaseError(where, taskError);
  const { data: dependencies, error: dependencyError } = await supabase
    .from("schedule_revision_dependency_snapshots")
    .select("task_source_id, predecessor_source_id, dependency_type, lag_days")
    .eq("revision_id", revision.id);
  if (dependencyError) throwScheduleDatabaseError(where, dependencyError);
  const { data: submittalData, error: submittalError } = await supabase
    .from("schedule_revision_submittal_snapshots")
    .select("source_task_id,submittal_id,submittal_number,title,submittal_status,required_approval_date,response_statuses")
    .eq("revision_id", revision.id);
  if (submittalError) throwScheduleDatabaseError(where, submittalError);

  const snapshotTasks = (tasks ?? []) as SnapshotTask[];
  const snapshotDependencies = (dependencies ?? []) as SnapshotDependency[];
  const submittalSnapshots = (submittalData ?? []) as SubmittalSnapshot[];
  const taskNames = new Map(snapshotTasks.map((task) => [task.source_task_id, task.name]));
  const submittalRiskByTaskId = Object.fromEntries(snapshotTasks.map((task) => {
    const linkedSubmittals = submittalSnapshots
      .filter((snapshot) => snapshot.source_task_id === task.source_task_id)
      .map((snapshot) => ({
        id: snapshot.submittal_id,
        number: snapshot.submittal_number,
        title: snapshot.title,
        status: snapshot.submittal_status,
        required_approval_date: snapshot.required_approval_date,
        responses: snapshot.response_statuses,
      }));
    const dependentTaskNames = snapshotDependencies
      .filter((dependency) => dependency.predecessor_source_id === task.source_task_id)
      .map((dependency) => taskNames.get(dependency.task_source_id))
      .filter((name): name is string => typeof name === "string");
    return [task.source_task_id, evaluateLinkedSubmittalRisk({
      task: { id: task.source_task_id, name: task.name, start_date: task.forecast_start_date ?? task.start_date },
      linkedSubmittals,
      dependentTaskNames,
    })];
  }));

  const publishedRevision = {
    ...revision,
    status: "published" as const,
    snapshot_context_provenance: revision.snapshot_context_provenance === "reconstructed" ? "reconstructed" as const : "captured" as const,
  };
  return NextResponse.json({ data: projectPublishedLookahead(publishedRevision, snapshotTasks, snapshotDependencies, {
    weeks: parsed.data.weeks,
    startDate: parsed.data.start_date,
    submittalRiskByTaskId,
  }) });
}

async function loadRiskSummary(projectIdValue: string) {
  const view = "risk";
  const where = `${ROUTE_WHERE}:${view}`;
  const projectId = await requireAuthenticatedProject(projectIdValue, view);
  const supabase = await createClient();
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("current_schedule_revision_id")
    .eq("id", projectId)
    .maybeSingle();
  if (projectError) throwScheduleDatabaseError(where, projectError);
  if (!project?.current_schedule_revision_id) {
    return NextResponse.json({ data: buildScheduleRiskSummary({ projectId, revision: null, tasks: [], submittalRisks: [] }) });
  }

  const { data: revision, error: revisionError } = await supabase
    .from("schedule_revisions")
    .select("id,revision_number,status")
    .eq("id", project.current_schedule_revision_id)
    .eq("project_id", projectId)
    .eq("status", "published")
    .maybeSingle();
  if (revisionError) throwScheduleDatabaseError(where, revisionError);
  if (!revision) {
    return NextResponse.json({ data: buildScheduleRiskSummary({ projectId, revision: null, tasks: [], submittalRisks: [] }) });
  }

  const [tasksResult, dependenciesResult, submittalsResult] = await Promise.all([
    supabase.from("schedule_revision_task_snapshots").select("source_task_id,name,start_date,forecast_start_date,forecast_finish_date,constraint_type,constraint_date").eq("revision_id", revision.id).order("sort_order", { ascending: true }),
    supabase.from("schedule_revision_dependency_snapshots").select("task_source_id,predecessor_source_id").eq("revision_id", revision.id),
    supabase.from("schedule_revision_submittal_snapshots").select("source_task_id,submittal_id,submittal_number,title,submittal_status,required_approval_date,response_statuses").eq("revision_id", revision.id),
  ]);
  if (tasksResult.error) throwScheduleDatabaseError(where, tasksResult.error);
  if (dependenciesResult.error) throwScheduleDatabaseError(where, dependenciesResult.error);
  if (submittalsResult.error) throwScheduleDatabaseError(where, submittalsResult.error);

  const tasks = tasksResult.data ?? [];
  const taskNames = new Map(tasks.map((task) => [task.source_task_id, task.name]));
  const submittalRisks = tasks.flatMap((task) => {
    const linkedSubmittals = (submittalsResult.data ?? []).filter((item) => item.source_task_id === task.source_task_id);
    const dependentTaskNames = (dependenciesResult.data ?? [])
      .filter((dependency) => dependency.predecessor_source_id === task.source_task_id)
      .map((dependency) => taskNames.get(dependency.task_source_id))
      .filter((name): name is string => typeof name === "string");
    const risk = evaluateLinkedSubmittalRisk({
      task: { id: task.source_task_id, name: task.name, start_date: task.forecast_start_date ?? task.start_date },
      linkedSubmittals: linkedSubmittals.map((item) => ({ id: item.submittal_id, number: item.submittal_number, title: item.title, status: item.submittal_status, required_approval_date: item.required_approval_date, responses: item.response_statuses ?? [] })),
      dependentTaskNames,
    });
    return risk.status === "at_risk" ? [{ sourceTaskId: task.source_task_id, submittalId: risk.blocking_submittal_id, reason: risk.reason }] : [];
  });

  return NextResponse.json({
    data: buildScheduleRiskSummary({
      projectId,
      revision: { id: revision.id, revisionNumber: revision.revision_number },
      tasks: tasks.map((task) => ({ sourceTaskId: task.source_task_id, name: task.name, forecastFinishDate: task.forecast_finish_date, constraint: task.constraint_type && task.constraint_date ? { type: task.constraint_type, date: task.constraint_date } : null })),
      submittalRisks,
    }),
  });
}

async function loadTradeActivities(projectIdValue: string) {
  const where = `${ROUTE_WHERE}:trade-activities`;
  const parsedProjectId = projectIdSchema.safeParse(projectIdValue);
  if (!parsedProjectId.success) {
    throwScheduleRequestError(where, "Select a valid project before loading assigned activities.");
  }
  const access = await verifyProjectAccess(parsedProjectId.data);
  if (isAuthError(access)) return access;

  const { serviceClient, membership } = access;
  const { data: revision, error: revisionError } = await serviceClient
    .from("schedule_revisions")
    .select("id, status")
    .eq("project_id", parsedProjectId.data)
    .eq("status", "published")
    .order("revision_number", { ascending: false })
    .maybeSingle();
  if (revisionError) throwScheduleDatabaseError(where, revisionError);
  if (!revision) {
    throwScheduleRequestError(
      where,
      "No published schedule revision is available for trade visibility.",
      { code: "NOT_FOUND", status: 404 },
    );
  }

  const { data: actorPerson, error: actorError } = await serviceClient
    .from("people")
    .select("company_id, company:companies!people_company_id_fkey(name)")
    .eq("id", membership.personId)
    .maybeSingle();
  if (actorError) throwScheduleDatabaseError(where, actorError);

  const actorCompany = actorPerson?.company;
  const companyName = Array.isArray(actorCompany)
    ? actorCompany[0]?.name ?? null
    : actorCompany?.name ?? null;
  let authorizedPersonIds = [membership.personId];

  if (actorPerson?.company_id) {
    const { data: companyPeople, error: companyPeopleError } = await serviceClient
      .from("people")
      .select("id")
      .eq("company_id", actorPerson.company_id)
      .eq("status", "active");
    if (companyPeopleError) throwScheduleDatabaseError(where, companyPeopleError);

    const companyPersonIds = (companyPeople ?? []).map((person) => person.id);
    if (companyPersonIds.length > 0) {
      const { data: activeMemberships, error: membershipError } =
        await serviceClient
          .from("project_directory_memberships")
          .select("person_id")
          .eq("project_id", parsedProjectId.data)
          .eq("status", "active")
          .in("person_id", companyPersonIds);
      if (membershipError) throwScheduleDatabaseError(where, membershipError);
      authorizedPersonIds = Array.from(new Set([
        membership.personId,
        ...(activeMemberships ?? []).map((item) => item.person_id),
      ]));
    }
  }

  const { data: snapshots, error: snapshotError } = await serviceClient
    .from("schedule_revision_task_snapshots")
    .select("source_task_id, name, assignee_person_id")
    .eq("revision_id", revision.id)
    .in("assignee_person_id", authorizedPersonIds)
    .order("sort_order", { ascending: true });
  if (snapshotError) throwScheduleDatabaseError(where, snapshotError);
  const activities = (snapshots ?? []).map((snapshot) => ({
    sourceTaskId: snapshot.source_task_id,
    name: snapshot.name,
    assigneePersonId: snapshot.assignee_person_id,
  }));
  return NextResponse.json({
    revisionId: revision.id,
    visibility: actorPerson?.company_id
      ? {
          type: "company",
          companyId: actorPerson.company_id,
          label: companyName ?? "Your company",
        }
      : {
          type: "person",
          companyId: null,
          label: "Your assignments",
        },
    data: selectTradePublishedActivities(activities, authorizedPersonIds),
  });
}

export const GET = withApiGuardrails<{ projectId: string }>(
  ROUTE_WHERE,
  async ({ request, params }) => {
    const { projectId } = await params;
    const view = request.nextUrl.searchParams.get("view");
    if (view === "lookahead") return loadLookahead(request, projectId);
    if (view === "risk") return loadRiskSummary(projectId);
    if (view === "trade-activities") return loadTradeActivities(projectId);
    throwScheduleRequestError(ROUTE_WHERE, "Choose a supported schedule report: lookahead, risk, or trade-activities.");
  },
);
