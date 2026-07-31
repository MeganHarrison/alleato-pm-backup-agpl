import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";

import {
  PlaneIntakeActionRequestSchema,
  asJsonRecord,
  buildPlaneIntakeState,
  isProjectScopedTask,
  mergePlaneIntakeMetadata,
  outlookSourceKey,
  type PlaneIntakeActionRequest,
  type PlaneIntakeActionResponse,
} from "@/features/plane-intake-actions/contracts";
import { parseJsonBody, withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { requirePermission } from "@/lib/permissions-guard";
import { createOutlookIntakeServiceClient } from "@/lib/supabase/service";
import { serviceDb } from "@/lib/supabase/service-db";
import type { Database } from "@/types/database.types";

const WHERE = "plane-intake-actions#POST";
const ACCEPT_CLAIM_TTL_MS = 5 * 60 * 1000;

type TaskRow = Pick<
  Database["public"]["Tables"]["tasks"]["Row"],
  | "id"
  | "project_id"
  | "project_ids"
  | "extraction_metadata"
  | "source_url"
  | "assignee_person_id"
  | "assignee_email"
  | "assignee_name"
  | "updated_at"
>;

interface TaskActorAccess {
  userId: string;
  personId: string | null;
  isAdmin: boolean;
  email: string | null;
  fullName: string | null;
}

const TASK_SELECT =
  "id, project_id, project_ids, extraction_metadata, source_url, assignee_person_id, assignee_email, assignee_name, updated_at";

type OutlookRow = Pick<
  Database["public"]["Tables"]["outlook_email_intake"]["Row"],
  | "id"
  | "project_id"
  | "subject"
  | "body"
  | "body_text"
  | "web_link"
  | "match_status"
  | "source_metadata"
  | "triage_action"
  | "triage_reason"
  | "triage_at"
  | "updated_at"
>;

function persistenceError(
  message: string,
  details: Record<string, unknown>,
  cause?: unknown,
) {
  const causeMessage =
    cause instanceof Error
      ? cause.message
      : typeof cause === "object" && cause !== null && "message" in cause
        ? String(cause.message)
        : String(cause ?? "unknown");
  console.error(
    JSON.stringify({
      event: "plane_intake_persistence_error",
      message,
      details,
      cause: causeMessage,
    }),
  );
  const publicDetails = Object.fromEntries(
    Object.entries(details).filter(
      ([key]) => !/(?:reason|error|message)$/i.test(key),
    ),
  );
  return new GuardrailError({
    code: "INTERNAL_ERROR",
    where: WHERE,
    message,
    status: 500,
    details: publicDetails,
    cause,
  });
}

async function loadTaskActorAccess(
  userId: string,
  personId: string | null,
): Promise<TaskActorAccess> {
  const { data, error } = await serviceDb
    .from("user_profiles")
    .select("is_admin, email, full_name")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw persistenceError(
      "Failed to verify Intake task access.",
      { userId, boundary: "app.user_profiles.task-access.read" },
      error,
    );
  }
  if (!data) {
    throw new GuardrailError({
      code: "FORBIDDEN",
      where: WHERE,
      message: "Intake task access could not be verified.",
      status: 403,
      details: { userId },
    });
  }
  return {
    userId,
    personId,
    isAdmin: data.is_admin === true,
    email: data.email?.trim().toLowerCase() || null,
    fullName: data.full_name?.trim().toLowerCase() || null,
  };
}

function canAccessTask(task: TaskRow, actor: TaskActorAccess): boolean {
  if (actor.isAdmin) return true;
  return (
    (actor.personId !== null && task.assignee_person_id === actor.personId) ||
    (actor.email !== null &&
      task.assignee_email?.trim().toLowerCase() === actor.email) ||
    (actor.fullName !== null &&
      task.assignee_name?.trim().toLowerCase() === actor.fullName)
  );
}

async function assertOutlookAdmin(userId: string) {
  const { data, error } = await serviceDb
    .from("user_profiles")
    .select("is_admin")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw persistenceError(
      "Failed to verify Outlook Intake administrator access.",
      { userId, boundary: "app.user_profiles.read", reason: error.message },
      error,
    );
  }

  if (data?.is_admin !== true) {
    throw new GuardrailError({
      code: "FORBIDDEN",
      where: WHERE,
      message: "Outlook Intake actions require app administrator access.",
      status: 403,
      details: { userId, source: "outlook" },
    });
  }
}

async function loadTargetTask(
  projectId: number,
  taskId: string,
  actor?: TaskActorAccess,
) {
  const { data, error } = await serviceDb
    .from("tasks")
    .select(TASK_SELECT)
    .eq("id", taskId)
    .maybeSingle();

  if (error) {
    throw persistenceError(
      "Failed to verify the duplicate target task.",
      {
        projectId,
        taskId,
        boundary: "app.tasks.target.read",
        reason: error.message,
      },
      error,
    );
  }

  if (!data || !isProjectScopedTask(projectId, data)) {
    throw new GuardrailError({
      code: "VALIDATION_ERROR",
      where: WHERE,
      message: "Duplicate target must be an existing task in this project.",
      status: 400,
      details: { projectId, taskId },
    });
  }

  if (actor && !canAccessTask(data as TaskRow, actor)) {
    throw new GuardrailError({
      code: "FORBIDDEN",
      where: WHERE,
      message: "You can only resolve Intake tasks assigned to you.",
      status: 403,
      details: { projectId, taskId, boundary: "app.tasks.target.access" },
    });
  }

  return data as TaskRow;
}

async function resolveTaskAction(
  request: PlaneIntakeActionRequest,
  actor: TaskActorAccess,
  now: string,
): Promise<PlaneIntakeActionResponse> {
  const { data, error } = await serviceDb
    .from("tasks")
    .select(TASK_SELECT)
    .eq("id", request.sourceId)
    .maybeSingle();

  if (error) {
    throw persistenceError(
      "Failed to load the Intake task before applying its action.",
      {
        sourceId: request.sourceId,
        projectId: request.projectId,
        boundary: "app.tasks.source.read",
        reason: error.message,
      },
      error,
    );
  }

  if (!data) {
    throw new GuardrailError({
      code: "NOT_FOUND",
      where: WHERE,
      message: "Intake task was not found.",
      status: 404,
      details: { sourceId: request.sourceId },
    });
  }

  const task = data as TaskRow;
  if (!canAccessTask(task, actor)) {
    throw new GuardrailError({
      code: "FORBIDDEN",
      where: WHERE,
      message: "You can only resolve Intake tasks assigned to you.",
      status: 403,
      details: {
        sourceId: request.sourceId,
        projectId: request.projectId,
        boundary: "app.tasks.source.access",
      },
    });
  }

  const scopedToAnyProject =
    data.project_id !== null || (data.project_ids ?? []).length > 0;
  if (
    !isProjectScopedTask(request.projectId, data) &&
    (request.action !== "accept" || scopedToAnyProject)
  ) {
    throw new GuardrailError({
      code: "FORBIDDEN",
      where: WHERE,
      message: "The Intake task does not belong to this project.",
      status: 403,
      details: {
        sourceId: request.sourceId,
        projectId: request.projectId,
        taskProjectId: data.project_id,
      },
    });
  }

  if (request.action === "duplicate") {
    await loadTargetTask(request.projectId, request.duplicateTaskId, actor);
  }

  const alreadyScoped = isProjectScopedTask(request.projectId, task);

  const state = buildPlaneIntakeState(
    request,
    actor.userId,
    now,
    request.action === "accept" ? request.sourceId : null,
  );
  const update: Database["public"]["Tables"]["tasks"]["Update"] = {
    extraction_metadata: mergePlaneIntakeMetadata(
      data.extraction_metadata,
      state,
    ),
    updated_at: now,
  };
  if (request.action === "accept" && !alreadyScoped) {
    update.project_id = request.projectId;
    update.project_ids = Array.from(
      new Set([...(task.project_ids ?? []), request.projectId]),
    );
  }

  let updateQuery = serviceDb
    .from("tasks")
    .update(update)
    .eq("id", request.sourceId);
  updateQuery =
    task.updated_at === null
      ? updateQuery.is("updated_at", null)
      : updateQuery.eq("updated_at", task.updated_at);
  updateQuery =
    task.project_id === null
      ? updateQuery.is("project_id", null)
      : updateQuery.eq("project_id", task.project_id);
  updateQuery =
    task.project_ids === null
      ? updateQuery.is("project_ids", null)
      : updateQuery.eq("project_ids", task.project_ids);
  const { data: updated, error: updateError } = await updateQuery
    .select("id")
    .maybeSingle();

  if (updateError) {
    throw persistenceError(
      `Failed to ${request.action} the Intake task.`,
      {
        action: request.action,
        sourceId: request.sourceId,
        projectId: request.projectId,
        boundary: "app.tasks.source.update",
        reason: updateError.message,
      },
      updateError,
    );
  }

  if (!updated) {
    throw new GuardrailError({
      code: "PRECONDITION_FAILED",
      where: WHERE,
      message:
        "The Intake task changed before this action finished. Refresh and retry.",
      status: 409,
      details: {
        action: request.action,
        sourceId: request.sourceId,
        projectId: request.projectId,
        boundary: "app.tasks.source.optimistic-update",
      },
    });
  }

  return {
    source: "task",
    sourceId: request.sourceId,
    projectId: request.projectId,
    action: request.action,
    state,
    taskId:
      request.action === "duplicate" ? request.duplicateTaskId : updated.id,
    idempotent: request.action === "accept" && alreadyScoped,
  };
}

async function findExistingOutlookTask(
  projectId: number,
  sourceKey: string,
): Promise<TaskRow | null> {
  const { data, error } = await serviceDb
    .from("tasks")
    .select(TASK_SELECT)
    .eq("source_system", "outlook_intake")
    .eq("source_url", sourceKey)
    .maybeSingle();

  if (error) {
    throw persistenceError(
      "Failed to check whether this Outlook item was already added.",
      {
        projectId,
        sourceKey,
        boundary: "app.tasks.idempotency.read",
        reason: error.message,
      },
      error,
    );
  }

  if (data && !isProjectScopedTask(projectId, data)) {
    throw new GuardrailError({
      code: "PRECONDITION_FAILED",
      where: WHERE,
      message: "This Outlook item is already linked to another project.",
      status: 409,
      details: {
        projectId,
        existingTaskId: data.id,
        existingProjectId: data.project_id,
      },
    });
  }

  return (data as TaskRow | null) ?? null;
}

async function resolveOutlookAction(
  request: PlaneIntakeActionRequest,
  actorId: string,
  now: string,
): Promise<PlaneIntakeActionResponse> {
  const intakeId = Number.parseInt(request.sourceId, 10);
  if (!Number.isInteger(intakeId) || intakeId <= 0) {
    throw new GuardrailError({
      code: "VALIDATION_ERROR",
      where: WHERE,
      message: "Outlook Intake source ID must be a positive integer.",
      status: 400,
      details: { sourceId: request.sourceId },
    });
  }

  const intakeService = createOutlookIntakeServiceClient();
  const { data, error } = await intakeService
    .from("outlook_email_intake")
    .select(
      "id, project_id, subject, body, body_text, web_link, match_status, source_metadata, triage_action, triage_reason, triage_at, updated_at",
    )
    .eq("id", intakeId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    throw persistenceError(
      "Failed to load the Outlook Intake item before applying its action.",
      {
        sourceId: request.sourceId,
        projectId: request.projectId,
        boundary: "outlook.outlook_email_intake.read",
        reason: error.message,
      },
      error,
    );
  }

  if (!data) {
    throw new GuardrailError({
      code: "NOT_FOUND",
      where: WHERE,
      message: "Outlook Intake item was not found.",
      status: 404,
      details: { sourceId: request.sourceId },
    });
  }

  const outlook = data as OutlookRow;
  if (outlook.project_id !== null && outlook.project_id !== request.projectId) {
    throw new GuardrailError({
      code: "FORBIDDEN",
      where: WHERE,
      message: "The Outlook Intake item belongs to another project.",
      status: 403,
      details: {
        sourceId: request.sourceId,
        projectId: request.projectId,
        outlookProjectId: outlook.project_id,
      },
    });
  }

  const sourceKey = outlookSourceKey(intakeId);
  const currentMetadata = asJsonRecord(outlook.source_metadata);
  const currentClaim = asJsonRecord(currentMetadata.plane_intake_accept_claim);
  const currentClaimTime =
    typeof currentClaim.claimed_at === "string"
      ? new Date(currentClaim.claimed_at).getTime()
      : Number.NaN;
  const hasActiveAcceptClaim =
    Number.isFinite(currentClaimTime) &&
    Date.now() - currentClaimTime < ACCEPT_CLAIM_TTL_MS;
  if (hasActiveAcceptClaim) {
    throw new GuardrailError({
      code: "PRECONDITION_FAILED",
      where: WHERE,
      message:
        "This Outlook Intake item is already being accepted. Retry after the current action finishes.",
      status: 409,
      details: {
        sourceId: request.sourceId,
        projectId: request.projectId,
        boundary: "outlook.outlook_email_intake.accept-claim",
        attemptedAction: request.action,
      },
    });
  }

  if (request.action === "duplicate") {
    await loadTargetTask(request.projectId, request.duplicateTaskId);
  }

  let acceptedTaskId: string | null = null;
  let createdTaskId: string | null = null;
  let idempotent = false;
  let acceptClaimAcquired = false;
  let acceptClaimId: string | null = null;

  async function releaseAcceptClaim(): Promise<string | null> {
    if (!acceptClaimAcquired) return null;
    const activeClaimId = acceptClaimId;
    if (!activeClaimId) {
      return "claim_id_missing";
    }
    const { data: latest, error: latestError } = await intakeService
      .from("outlook_email_intake")
      .select(
        "id, project_id, subject, body, body_text, web_link, match_status, source_metadata, triage_action, triage_reason, triage_at, updated_at",
      )
      .eq("id", intakeId)
      .is("deleted_at", null)
      .maybeSingle();
    if (latestError) {
      console.error(
        JSON.stringify({
          event: "plane_intake_claim_cleanup_read_failed",
          sourceId: request.sourceId,
          cause: latestError.message,
        }),
      );
      return "claim_read_failed";
    }
    if (!latest) return "claim_row_missing";
    const latestMetadata = asJsonRecord(latest.source_metadata);
    const latestClaim = asJsonRecord(
      latestMetadata.plane_intake_accept_claim,
    );
    if (latestClaim.claim_id !== activeClaimId) return "ownership_changed";
    delete latestMetadata.plane_intake_accept_claim;
    let releaseQuery = intakeService
      .from("outlook_email_intake")
      .update({
        source_metadata: latestMetadata,
        triage_action: outlook.triage_action,
        triage_reason: outlook.triage_reason,
        triage_at: outlook.triage_at,
        updated_at: new Date().toISOString(),
      })
      .eq("id", intakeId)
      .is("deleted_at", null)
      .eq(
        "source_metadata->plane_intake_accept_claim->>claim_id",
        activeClaimId,
      );
    releaseQuery =
      latest.updated_at === null
        ? releaseQuery.is("updated_at", null)
        : releaseQuery.eq("updated_at", latest.updated_at);
    const { data: released, error: releaseError } = await releaseQuery
      .select("id")
      .maybeSingle();

    if (releaseError) {
      console.error(
        JSON.stringify({
          event: "plane_intake_claim_cleanup_failed",
          sourceId: request.sourceId,
          cause: releaseError.message,
        }),
      );
      return "claim_cleanup_failed";
    }
    if (!released) return "ownership_changed";
    acceptClaimAcquired = false;
    return null;
  }

  async function compensateFinalization(): Promise<{
    compensation: "created task removed" | "not required";
    claimCleanup: string;
  }> {
    if (createdTaskId) {
      const { error: rollbackError } = await serviceDb
        .from("tasks")
        .delete()
        .eq("id", createdTaskId);
      if (rollbackError) {
        const claimCleanupReason = await releaseAcceptClaim();
        throw persistenceError(
          "Outlook Intake finalization failed and the newly created task could not be rolled back.",
          {
            sourceId: request.sourceId,
            projectId: request.projectId,
            createdTaskId,
            boundary: "cross-database.finalization-compensation",
            compensation: "rollback failed",
            claimCleanup: claimCleanupReason ?? "released",
          },
          rollbackError,
        );
      }
    }

    const claimCleanupReason = await releaseAcceptClaim();
    return {
      compensation: createdTaskId ? "created task removed" : "not required",
      claimCleanup: claimCleanupReason ?? "released",
    };
  }

  if (request.action === "accept") {
    const existingTask = await findExistingOutlookTask(
      request.projectId,
      sourceKey,
    );
    if (existingTask) {
      acceptedTaskId = existingTask.id;
      idempotent = true;
    } else {
      acceptClaimId = randomUUID();
      const claimMetadata = {
        ...mergePlaneIntakeMetadata(
          outlook.source_metadata,
          buildPlaneIntakeState(
            {
              source: "outlook",
              sourceId: request.sourceId,
              projectId: request.projectId,
              action: "unsnooze",
            },
            actorId,
            now,
          ),
        ),
        plane_intake_accept_claim: {
          claim_id: acceptClaimId,
          claimed_at: now,
          claimed_by: actorId,
        },
      };
      let claimQuery = intakeService
        .from("outlook_email_intake")
        .update({
          source_metadata: claimMetadata,
          updated_at: now,
          triage_action: "accepting",
          triage_reason:
            "Acceptance is creating the corresponding project task.",
          triage_at: now,
        })
        .eq("id", intakeId)
        .is("deleted_at", null);
      claimQuery =
        outlook.updated_at === null
          ? claimQuery.is("updated_at", null)
          : claimQuery.eq("updated_at", outlook.updated_at);
      const { data: claim, error: claimError } = await claimQuery
        .select("id")
        .maybeSingle();

      if (claimError) {
        throw persistenceError(
          "Failed to claim the Outlook Intake item for acceptance.",
          {
            sourceId: request.sourceId,
            projectId: request.projectId,
            boundary: "outlook.outlook_email_intake.accept-claim",
            reason: claimError.message,
          },
          claimError,
        );
      }

      if (!claim) {
        const concurrentlyCreatedTask = await findExistingOutlookTask(
          request.projectId,
          sourceKey,
        );
        if (concurrentlyCreatedTask) {
          acceptedTaskId = concurrentlyCreatedTask.id;
          idempotent = true;
        } else {
          throw new GuardrailError({
            code: "PRECONDITION_FAILED",
            where: WHERE,
            message:
              "This Outlook Intake item is already being accepted. Retry after the current action finishes.",
            status: 409,
            details: {
              sourceId: request.sourceId,
              projectId: request.projectId,
              boundary: "outlook.outlook_email_intake.accept-claim",
            },
          });
        }
      } else {
        acceptClaimAcquired = true;
      }
    }

    if (!acceptedTaskId) {
      const { data: created, error: createError } = await serviceDb
        .from("tasks")
        .insert({
          metadata_id: null,
          source_system: "outlook_intake",
          source_type: "email",
          source_url: sourceKey,
          status: "open",
          title: outlook.subject.trim() || "Untitled Outlook intake item",
          description:
            outlook.body_text?.trim() ||
            outlook.body?.trim() ||
            outlook.subject.trim() ||
            "Outlook intake item",
          project_id: request.projectId,
          project_ids: [request.projectId],
          assigned_by: actorId,
          extraction_metadata: {
            outlook_intake_id: intakeId,
            outlook_web_link: outlook.web_link,
          },
        })
        .select("id")
        .single();

      if (createError) {
        const claimCleanupReason = await releaseAcceptClaim();
        throw persistenceError(
          "Failed to create a project task from the Outlook Intake item.",
          {
            sourceId: request.sourceId,
            projectId: request.projectId,
            boundary: "app.tasks.accept.insert",
            reason: createError.message,
            claimCleanup: claimCleanupReason ?? "released",
          },
          createError,
        );
      }
      acceptedTaskId = created.id;
      createdTaskId = created.id;
    }
  } else {
    const acceptedTask = await findExistingOutlookTask(
      request.projectId,
      sourceKey,
    );
    if (acceptedTask) {
      throw new GuardrailError({
        code: "PRECONDITION_FAILED",
        where: WHERE,
        message:
          "This Outlook Intake item has already been accepted into the project.",
        status: 409,
        details: {
          sourceId: request.sourceId,
          projectId: request.projectId,
          acceptedTaskId: acceptedTask.id,
          attemptedAction: request.action,
        },
      });
    }
  }

  let outlookForUpdate = outlook;
  if (acceptClaimAcquired) {
    const { data: latestOutlook, error: latestOutlookError } = await intakeService
      .from("outlook_email_intake")
      .select(
        "id, project_id, subject, body, body_text, web_link, match_status, source_metadata, triage_action, triage_reason, triage_at, updated_at",
      )
      .eq("id", intakeId)
      .is("deleted_at", null)
      .maybeSingle();
    if (latestOutlookError) {
      const compensation = await compensateFinalization();
      throw persistenceError(
        "Failed to refresh the Outlook Intake item before finalization.",
        {
          sourceId: request.sourceId,
          projectId: request.projectId,
          boundary: "outlook.outlook_email_intake.final-read",
          ...compensation,
        },
        latestOutlookError,
      );
    }
    if (!latestOutlook) {
      const compensation = await compensateFinalization();
      throw new GuardrailError({
        code: "PRECONDITION_FAILED",
        where: WHERE,
        message:
          "The Outlook Intake item changed before this action finished. Refresh and retry.",
        status: 409,
        details: {
          sourceId: request.sourceId,
          projectId: request.projectId,
          boundary: "outlook.outlook_email_intake.final-read",
          ...compensation,
        },
      });
    }
    outlookForUpdate = latestOutlook as OutlookRow;
  }

  const state = buildPlaneIntakeState(request, actorId, now, acceptedTaskId);
  const finalMetadata = asJsonRecord(outlookForUpdate.source_metadata);
  delete finalMetadata.plane_intake_accept_claim;
  const update: Database["public"]["Tables"]["outlook_email_intake"]["Update"] =
    {
      source_metadata: mergePlaneIntakeMetadata(finalMetadata, state),
      updated_at: now,
      triage_at: request.action === "unsnooze" ? null : now,
      triage_action:
        request.action === "accept"
          ? "accepted"
          : request.action === "decline"
            ? "delete"
            : request.action,
      triage_reason:
        request.action === "accept"
          ? "Added to project from Plane-derived Intake."
          : request.action === "decline"
            ? "Declined during Plane-derived Intake review."
            : request.action === "duplicate"
              ? "Resolved as a duplicate during Plane-derived Intake review."
              : request.action === "snooze"
                ? "Snoozed during Plane-derived Intake review."
                : null,
    };

  if (request.action === "accept") {
    update.project_id = request.projectId;
    update.match_status = "matched";
    update.assignment_method = "manual";
    update.assignment_confidence = 1;
  } else if (request.action === "decline" || request.action === "duplicate") {
    update.match_status = "ignored";
    update.assignment_method = "manual";
  }

  let updateQuery = intakeService
    .from("outlook_email_intake")
    .update(update)
    .eq("id", intakeId)
    .is("deleted_at", null);
  if (acceptClaimAcquired) {
    if (!acceptClaimId) {
      const compensation = await compensateFinalization();
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where: WHERE,
        message: "The Outlook Intake acceptance claim lost its identifier.",
        status: 500,
        details: {
          action: request.action,
          sourceId: request.sourceId,
          projectId: request.projectId,
          boundary: "outlook.outlook_email_intake.accept-claim",
          ...compensation,
        },
      });
    }
    updateQuery = updateQuery.eq(
        "source_metadata->plane_intake_accept_claim->>claim_id",
        acceptClaimId,
      );
    updateQuery =
      outlookForUpdate.updated_at === null
        ? updateQuery.is("updated_at", null)
        : updateQuery.eq("updated_at", outlookForUpdate.updated_at);
  } else {
    updateQuery =
      outlook.updated_at === null
        ? updateQuery.is("updated_at", null)
        : updateQuery.eq("updated_at", outlook.updated_at);
  }
  const { data: updatedOutlook, error: updateError } = await updateQuery
    .select("id")
    .maybeSingle();

  if (!updateError && !updatedOutlook) {
    const compensation = await compensateFinalization();
    throw new GuardrailError({
      code: "PRECONDITION_FAILED",
      where: WHERE,
      message:
        "The Outlook Intake item changed before this action finished. Refresh and retry.",
      status: 409,
      details: {
        action: request.action,
        sourceId: request.sourceId,
        projectId: request.projectId,
        createdTaskId,
        boundary: "outlook.outlook_email_intake.optimistic-update",
        ...compensation,
      },
    });
  }

  if (updateError) {
    const compensation = await compensateFinalization();
    throw persistenceError(
      `Failed to ${request.action} the Outlook Intake item.`,
      {
        action: request.action,
        sourceId: request.sourceId,
        projectId: request.projectId,
        boundary: "outlook.outlook_email_intake.update",
        ...compensation,
      },
      updateError,
    );
  }
  acceptClaimAcquired = false;

  return {
    source: "outlook",
    sourceId: request.sourceId,
    projectId: request.projectId,
    action: request.action,
    state,
    taskId:
      request.action === "duplicate" ? request.duplicateTaskId : acceptedTaskId,
    idempotent,
  };
}

export const POST = withApiGuardrails(WHERE, async ({ request }) => {
  const payload = await parseJsonBody(
    request,
    PlaneIntakeActionRequestSchema,
    WHERE,
  );
  const permission = await requirePermission(
    payload.projectId,
    "schedule",
    "write",
  );
  if (permission.denied) return permission.response;

  if (payload.source === "outlook") {
    await assertOutlookAdmin(permission.userId);
  }

  const now = new Date().toISOString();
  const response =
    payload.source === "task"
      ? await resolveTaskAction(
          payload,
          await loadTaskActorAccess(permission.userId, permission.personId),
          now,
        )
      : await resolveOutlookAction(payload, permission.userId, now);

  return NextResponse.json(response);
});
