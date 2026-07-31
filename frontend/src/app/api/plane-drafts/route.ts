import { NextResponse } from "next/server";
import {
  DeletePlaneDraftSchema,
  PlaneDraftArtifactSchema,
  PlaneDraftListResponseSchema,
  PlaneDraftPatchSchema,
  PlaneDraftPostSchema,
  PlaneDraftProjectIdSchema,
} from "@/features/plane-drafts/plane-drafts-contract";
import {
  deletePlaneDraft,
  getPlaneDraft,
  insertPlaneDraft,
  listPlaneDrafts,
  PlaneDraftsRepositoryError,
  updatePlaneDraft,
} from "@/features/plane-drafts/plane-drafts-repository";
import { updatePlaneDraftText } from "@/features/plane-drafts/plane-drafts-model";
import { parseJsonBody, validateResponseContract, withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { isAuthError, verifyProjectAccess } from "@/lib/supabase/auth-guard";

const where = "/api/plane-drafts";

function guardRepository(error: unknown, action: string): never {
  if (error instanceof PlaneDraftsRepositoryError) {
    if (error.kind === "conflict") {
      throw new GuardrailError({
        code: "PRECONDITION_FAILED",
        where,
        message: error.message,
        status: 409,
        details: { action },
        cause: error,
      });
    }
    throw new GuardrailError({
      code: error.kind === "not_found" ? "NOT_FOUND" : "DB_ERROR",
      where,
      message: error.message,
      details: { action, databaseCode: error.code },
      cause: error,
    });
  }
  throw error;
}

async function authorize(projectId: number) {
  return verifyProjectAccess(projectId);
}

export const GET = withApiGuardrails(where, async ({ request }) => {
  const parsed = PlaneDraftProjectIdSchema.safeParse(request.nextUrl.searchParams.get("project_id"));
  if (!parsed.success) {
    throw new GuardrailError({ code: "INVALID_PAYLOAD", where, message: "A valid project_id is required." });
  }
  const access = await authorize(parsed.data);
  if (isAuthError(access)) return access;
  try {
    const artifacts = await listPlaneDrafts(parsed.data, access.membership.authUserId);
    return NextResponse.json(validateResponseContract(PlaneDraftListResponseSchema, { artifacts }, `${where}#GET`));
  } catch (error) {
    guardRepository(error, "load drafts");
  }
});

export const POST = withApiGuardrails(where, async ({ request }) => {
  const input = await parseJsonBody(request, PlaneDraftPostSchema, `${where}#POST`);
  const access = await authorize(input.project_id);
  if (isAuthError(access)) return access;
  try {
    const artifact = input.action === "create"
      ? await insertPlaneDraft({ projectId: input.project_id, userId: access.membership.authUserId, title: input.title, content: { text: input.text } })
      : await (async () => {
          const current = await getPlaneDraft(input.project_id, access.membership.authUserId, input.id);
          return insertPlaneDraft({
            projectId: input.project_id,
            userId: access.membership.authUserId,
            title: `${current.title} (copy)`,
            content: current.content,
            artifactType: current.artifact_type,
            contextSnapshot: current.context_snapshot,
            tags: current.tags,
          });
        })();
    return NextResponse.json({ artifact: validateResponseContract(PlaneDraftArtifactSchema, artifact, `${where}#POST`) }, { status: 201 });
  } catch (error) {
    guardRepository(error, input.action === "copy" ? "copy draft" : "create draft");
  }
});

export const PATCH = withApiGuardrails(where, async ({ request }) => {
  const input = await parseJsonBody(request, PlaneDraftPatchSchema, `${where}#PATCH`);
  const access = await authorize(input.project_id);
  if (isAuthError(access)) return access;
  try {
    const current = await getPlaneDraft(input.project_id, access.membership.authUserId, input.id);
    const updates = input.action === "update"
      ? { title: input.title, content: updatePlaneDraftText(current.content, input.text) }
      : { status: input.action === "archive" ? "archived" : "final" };
    const artifact = await updatePlaneDraft({
      projectId: input.project_id,
      userId: access.membership.authUserId,
      id: input.id,
      expectedVersion: input.version,
      updates,
    });
    return NextResponse.json({ artifact: input.action === "update" ? validateResponseContract(PlaneDraftArtifactSchema, artifact, `${where}#PATCH`) : artifact });
  } catch (error) {
    guardRepository(error, `${input.action} draft`);
  }
});

export const DELETE = withApiGuardrails(where, async ({ request }) => {
  const input = await parseJsonBody(request, DeletePlaneDraftSchema, `${where}#DELETE`);
  const access = await authorize(input.project_id);
  if (isAuthError(access)) return access;
  try {
    await deletePlaneDraft(input.project_id, access.membership.authUserId, input.id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    guardRepository(error, "delete draft");
  }
});
