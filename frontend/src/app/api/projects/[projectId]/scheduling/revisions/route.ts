import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { throwScheduleDatabaseError, throwScheduleRequestError, throwScheduleRpcError } from "@/lib/scheduling/schedule-route-errors";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { z } from "zod";

const snapshotSchema = z.object({}).strict();
const GET_WHERE = "projects/[projectId]/scheduling/revisions#GET";

/** Stakeholder-safe read: never falls back to a draft, review, or superseded revision. */
async function getCurrentPublishedRevision(
  supabase: Awaited<ReturnType<typeof createClient>>,
  projectId: string,
) {
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("current_schedule_revision_id")
    .eq("id", Number(projectId))
    .maybeSingle();
  if (projectError) throwScheduleDatabaseError(GET_WHERE, projectError);
  if (!project?.current_schedule_revision_id) {
    throwScheduleRequestError(GET_WHERE, "No published schedule revision is available for this project.", { code: "NOT_FOUND", status: 404 });
  }
  const { data: revision, error: revisionError } = await supabase
    .from("schedule_revisions")
    .select("*")
    .eq("id", project.current_schedule_revision_id)
    .eq("project_id", Number(projectId))
    .eq("status", "published")
    .maybeSingle();
  if (revisionError) throwScheduleDatabaseError(GET_WHERE, revisionError);
  if (!revision) {
    throwScheduleRequestError(GET_WHERE, "The project's current schedule revision pointer is invalid.", { code: "PRECONDITION_FAILED", status: 409 });
  }
  return revision;
}

export const GET = withApiGuardrails<{ projectId: string }>(
  GET_WHERE,
  async ({ request, params }) => {
    const { projectId } = await params;
    if (!await getApiRouteUser()) throw new GuardrailError({ code: "AUTH_EXPIRED", where: GET_WHERE, message: "Authentication required." });
    const supabase = await createClient();
    if (request.nextUrl.searchParams.get("current") === "true") {
      return NextResponse.json({ data: await getCurrentPublishedRevision(supabase, projectId) });
    }
    const { data, error } = await supabase
      .from("schedule_revisions")
      .select("*")
      .eq("project_id", Number(projectId))
      .order("revision_number", { ascending: false });
    if (error) throwScheduleDatabaseError(GET_WHERE, error);
    return NextResponse.json({ data: data ?? [] });
  },
);

export const POST = withApiGuardrails<{ projectId: string }>(
  "projects/[projectId]/scheduling/revisions#POST",
  async ({ request, params }) => {
    const { projectId } = await params;
    if (!await getApiRouteUser()) throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/scheduling/revisions#POST", message: "Authentication required." });
    const parsed = snapshotSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) throwScheduleRequestError("projects/[projectId]/scheduling/revisions#POST", "Revision baselines are resolved from the project active baseline.");
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("create_schedule_revision_snapshot", {
      p_project_id: Number(projectId),
    });
    if (error) throwScheduleRpcError("projects/[projectId]/scheduling/revisions#POST", error);
    return NextResponse.json({ data }, { status: 201 });
  },
);
