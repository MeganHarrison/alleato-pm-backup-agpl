import { z } from "zod";

import SubmittalWorkflowHandoffNotification from "@/emails/submittals/SubmittalWorkflowHandoffNotification";
import { APP_BASE_URL } from "@/lib/email/client";
import { sendEmail } from "@/lib/email/send";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createServiceClient } from "@/lib/supabase/service";
import type { Database } from "@/types/database.types";
import type { SupabaseClient } from "@supabase/supabase-js";

export const SUBMITTAL_WORKFLOW_RESPONSE_STATUSES = [
  "Approved",
  "Approved as Noted",
  "Revise and Resubmit",
  "Rejected",
  "Reviewed - No Exception",
] as const;

export const submittalWorkflowResponseStatusSchema = z.enum(
  SUBMITTAL_WORKFLOW_RESPONSE_STATUSES,
);

export type SubmittalWorkflowResponseStatus = z.infer<
  typeof submittalWorkflowResponseStatusSchema
>;

type WorkflowSupabaseClient = SupabaseClient<Database>;
type JsonValue = Database["public"]["Tables"]["submittal_history"]["Insert"]["metadata"];

interface RecordWorkflowResponseInput {
  supabase: WorkflowSupabaseClient;
  notificationSupabase?: WorkflowSupabaseClient;
  emailSender?: typeof sendEmail;
  projectId: number;
  submittalId: string;
  stepId: string;
  userId: string;
  responseStatus: SubmittalWorkflowResponseStatus;
  comments: string | null;
  where: string;
}

async function resolveWorkflowResponderIds({
  supabase,
  userId,
}: {
  supabase: WorkflowSupabaseClient;
  userId: string;
}) {
  const ids = new Set([userId]);

  try {
    const { data, error } = await supabase
      .from("users_auth")
      .select("person_id")
      .eq("auth_user_id", userId)
      .maybeSingle();

    if (!error && data?.person_id) {
      ids.add(data.person_id);
    }
  } catch (error) {
    console.warn("[submittal-workflow] responder identity lookup failed", {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return Array.from(ids);
}

export type SubmittalWorkflowNotificationResult =
  | {
      status: "created";
      userId: string;
      eventKey: string;
      email:
        | { status: "sent"; id: string | null }
        | {
            status: "skipped";
            reason: "missing_recipient_email" | "project_email_disabled";
          }
        | { status: "failed"; error: string };
    }
  | {
      status: "skipped";
      reason: "step_still_pending" | "workflow_complete";
    }
  | {
      status: "failed";
      userId: string;
      eventKey: string;
      error: string;
    };

function assertProjectId(projectId: number, where: string) {
  if (!Number.isInteger(projectId) || projectId <= 0) {
    throw new GuardrailError({
      code: "INVALID_INPUT",
      where,
      message: "Project id must be a positive integer.",
    });
  }
}

function historySource(where: string) {
  return where.includes("ai-review") ? "ai_review" : "workflow";
}

async function insertWorkflowResponseHistory({
  supabase,
  submittalId,
  projectId,
  userId,
  previousStatus,
  newStatus,
  responseId,
  stepId,
  responseStatus,
  comments,
  where,
}: {
  supabase: WorkflowSupabaseClient;
  submittalId: string;
  projectId: number;
  userId: string;
  previousStatus: string | null;
  newStatus: string | null;
  responseId: string;
  stepId: string;
  responseStatus: SubmittalWorkflowResponseStatus;
  comments: string | null;
  where: string;
}) {
  const { error } = await supabase.from("submittal_history").insert({
    submittal_id: submittalId,
    action: "workflow_response_recorded",
    actor_id: userId,
    actor_type: "user",
    previous_status: previousStatus,
    new_status: newStatus,
    description: `Workflow response recorded: ${responseStatus}`,
    changes: {
      response_status: responseStatus,
      comments_present: Boolean(comments?.trim()),
    } as JsonValue,
    metadata: {
      project_id: projectId,
      workflow_step_id: stepId,
      response_id: responseId,
      source: historySource(where),
    } as JsonValue,
    occurred_at: new Date().toISOString(),
  });

  if (error) {
    throw new GuardrailError({
      code: "DB_ERROR",
      where,
      message: `Could not write submittal workflow response history: ${error.message}`,
    });
  }
}

async function insertWorkflowNotificationFailureHistory({
  supabase,
  submittalId,
  projectId,
  userId,
  responseId,
  stepId,
  nextStepId,
  targetUserId,
  eventKey,
  errorMessage,
  where,
}: {
  supabase: WorkflowSupabaseClient;
  submittalId: string;
  projectId: number;
  userId: string;
  responseId: string;
  stepId: string;
  nextStepId: string;
  targetUserId: string;
  eventKey: string;
  errorMessage: string;
  where: string;
}) {
  const { error } = await supabase.from("submittal_history").insert({
    submittal_id: submittalId,
    action: "workflow_notification_failed",
    actor_id: userId,
    actor_type: "system",
    description: "Workflow response recorded, but next responder notification failed.",
    changes: {
      notification_status: "failed",
      target_user_id: targetUserId,
    } as JsonValue,
    metadata: {
      project_id: projectId,
      workflow_step_id: stepId,
      next_workflow_step_id: nextStepId,
      response_id: responseId,
      target_user_id: targetUserId,
      event_key: eventKey,
      error: errorMessage,
      source: historySource(where),
    } as JsonValue,
    occurred_at: new Date().toISOString(),
  });

  if (error) {
    throw new GuardrailError({
      code: "DB_ERROR",
      where,
      message: `Could not write submittal workflow notification failure history: ${error.message}`,
    });
  }
}

async function insertWorkflowEmailFailureHistory({
  supabase,
  submittalId,
  projectId,
  userId,
  responseId,
  stepId,
  nextStepId,
  targetUserId,
  eventKey,
  errorMessage,
  where,
}: {
  supabase: WorkflowSupabaseClient;
  submittalId: string;
  projectId: number;
  userId: string;
  responseId: string;
  stepId: string;
  nextStepId: string;
  targetUserId: string;
  eventKey: string;
  errorMessage: string;
  where: string;
}) {
  const { error } = await supabase.from("submittal_history").insert({
    submittal_id: submittalId,
    action: "workflow_email_failed",
    actor_id: userId,
    actor_type: "system",
    description: "Workflow response recorded, but next responder email failed.",
    changes: {
      email_status: "failed",
      target_user_id: targetUserId,
    } as JsonValue,
    metadata: {
      project_id: projectId,
      workflow_step_id: stepId,
      next_workflow_step_id: nextStepId,
      response_id: responseId,
      target_user_id: targetUserId,
      event_key: eventKey,
      error: errorMessage,
      source: historySource(where),
    } as JsonValue,
    occurred_at: new Date().toISOString(),
  });

  if (error) {
    throw new GuardrailError({
      code: "DB_ERROR",
      where,
      message: `Could not write submittal workflow email failure history: ${error.message}`,
    });
  }
}

function displayName(profile: {
  full_name?: string | null;
  email?: string | null;
}) {
  return (
    profile.full_name?.trim() ||
    profile.email?.split("@")[0]?.trim() ||
    "A team member"
  );
}

async function createWorkflowHandoffNotification({
  supabase,
  fallbackSupabase,
  submittalId,
  projectId,
  submittalNumber,
  submittalTitle,
  userId,
  responseId,
  stepId,
  responseStatus,
  target,
  skipReason,
  emailSender,
  where,
}: {
  supabase: WorkflowSupabaseClient;
  fallbackSupabase?: WorkflowSupabaseClient;
  submittalId: string;
  projectId: number;
  submittalNumber: string | null;
  submittalTitle: string | null;
  userId: string;
  responseId: string;
  stepId: string;
  responseStatus: SubmittalWorkflowResponseStatus;
  target: { userId: string; stepId: string; stepType: string } | null;
  skipReason: "step_still_pending" | "workflow_complete";
  emailSender?: typeof sendEmail;
  where: string;
}): Promise<SubmittalWorkflowNotificationResult> {
  if (!target) {
    return { status: "skipped", reason: skipReason };
  }

  const eventKey = `submittal-workflow/${submittalId}/${responseId}/${target.stepId}/${target.userId}`;
  const notificationClient = fallbackSupabase ?? createServiceClient();
  const submittalLabel = [submittalNumber, submittalTitle]
    .filter(Boolean)
    .join(" - ");
  const { error } = await notificationClient
    .from("collaboration_notifications")
    .insert({
      user_id: target.userId,
      actor_id: userId,
      project_id: projectId,
      entity_type: "submittal",
      entity_id: submittalId,
      kind: "submittal_workflow_action",
      title: "Submittal response needed",
      body: submittalLabel || "A submittal is ready for your response.",
      metadata: {
        eventKey,
        source: historySource(where),
        submittal_id: submittalId,
        response_id: responseId,
        previous_workflow_step_id: stepId,
        workflow_step_id: target.stepId,
        workflow_step_type: target.stepType,
        response_status: responseStatus,
      } as JsonValue,
    });

  if (!error) {
    const { data: settings, error: settingsError } = await notificationClient
      .from("submittal_project_settings")
      .select("email_notify_submittal_updated")
      .eq("project_id", projectId)
      .maybeSingle();

    if (settingsError) {
      await insertWorkflowEmailFailureHistory({
        supabase,
        submittalId,
        projectId,
        userId,
        responseId,
        stepId,
        nextStepId: target.stepId,
        targetUserId: target.userId,
        eventKey,
        errorMessage: settingsError.message,
        where,
      });

      return {
        status: "created",
        userId: target.userId,
        eventKey,
        email: { status: "failed", error: settingsError.message },
      };
    }

    if (settings?.email_notify_submittal_updated === false) {
      return {
        status: "created",
        userId: target.userId,
        eventKey,
        email: { status: "skipped", reason: "project_email_disabled" },
      };
    }

    const [
      { data: targetProfile, error: targetProfileError },
      { data: actorProfile, error: actorProfileError },
      { data: project, error: projectError },
    ] = await Promise.all([
      notificationClient
        .from("user_profiles")
        .select("full_name, email")
        .eq("id", target.userId)
        .maybeSingle(),
      notificationClient
        .from("user_profiles")
        .select("full_name, email")
        .eq("id", userId)
        .maybeSingle(),
      notificationClient
        .from("projects")
        .select("name")
        .eq("id", projectId)
        .maybeSingle(),
    ]);

    const profileError =
      targetProfileError?.message ||
      actorProfileError?.message ||
      projectError?.message;
    if (profileError) {
      await insertWorkflowEmailFailureHistory({
        supabase,
        submittalId,
        projectId,
        userId,
        responseId,
        stepId,
        nextStepId: target.stepId,
        targetUserId: target.userId,
        eventKey,
        errorMessage: profileError,
        where,
      });

      return {
        status: "created",
        userId: target.userId,
        eventKey,
        email: { status: "failed", error: profileError },
      };
    }

    const recipientEmail = targetProfile?.email?.trim();
    if (!recipientEmail) {
      return {
        status: "created",
        userId: target.userId,
        eventKey,
        email: { status: "skipped", reason: "missing_recipient_email" },
      };
    }

    const emailResult = await (emailSender ?? sendEmail)({
      template: "submittal-notification",
      to: recipientEmail,
      subject: `${submittalNumber ?? "Submittal"} response needed - ${
        submittalTitle ?? "Untitled"
      }`,
      react: SubmittalWorkflowHandoffNotification({
        recipientName: displayName(targetProfile ?? {}),
        projectName: project?.name ?? `Project #${projectId}`,
        submittalNumber: submittalNumber ?? "Submittal",
        submittalTitle: submittalTitle ?? "Untitled",
        respondedBy: displayName(actorProfile ?? {}),
        responseStatus,
        stepType: target.stepType,
        viewUrl: `${APP_BASE_URL}/${projectId}/submittals/${submittalId}`,
      }),
      entity: { type: "submittal", id: submittalId },
      userId: target.userId,
      idempotencyKey: eventKey,
      metadata: {
        project_id: projectId,
        submittal_id: submittalId,
        response_id: responseId,
        workflow_step_id: target.stepId,
        previous_workflow_step_id: stepId,
      },
    });

    if (!emailResult.error) {
      return {
        status: "created",
        userId: target.userId,
        eventKey,
        email: { status: "sent", id: emailResult.id },
      };
    }

    await insertWorkflowEmailFailureHistory({
      supabase,
      submittalId,
      projectId,
      userId,
      responseId,
      stepId,
      nextStepId: target.stepId,
      targetUserId: target.userId,
      eventKey,
      errorMessage: emailResult.error.message,
      where,
    });

    return {
      status: "created",
      userId: target.userId,
      eventKey,
      email: { status: "failed", error: emailResult.error.message },
    };
  }

  await insertWorkflowNotificationFailureHistory({
    supabase,
    submittalId,
    projectId,
    userId,
    responseId,
    stepId,
    nextStepId: target.stepId,
    targetUserId: target.userId,
    eventKey,
    errorMessage: error.message,
    where,
  });

  return {
    status: "failed",
    userId: target.userId,
    eventKey,
    error: error.message,
  };
}

export async function recordSubmittalWorkflowResponse({
  supabase,
  notificationSupabase,
  emailSender,
  projectId,
  submittalId,
  stepId,
  userId,
  responseStatus,
  comments,
  where,
}: RecordWorkflowResponseInput) {
  assertProjectId(projectId, where);

  const { data: submittal, error: submittalError } = await supabase
    .from("submittals")
    .select("id, project_id, status, submittal_number, title")
    .eq("id", submittalId)
    .eq("project_id", projectId)
    .maybeSingle();

  if (submittalError) {
    throw new GuardrailError({
      code: "DB_ERROR",
      where,
      message: `Could not load submittal before recording response: ${submittalError.message}`,
    });
  }

  if (!submittal) {
    throw new GuardrailError({
      code: "NOT_FOUND",
      where,
      message: "Submittal not found for this project.",
    });
  }

  const { data: workflowStep, error: workflowStepError } = await supabase
    .from("submittal_workflow_steps")
    .select("id")
    .eq("id", stepId)
    .eq("submittal_id", submittalId)
    .maybeSingle();

  if (workflowStepError) {
    throw new GuardrailError({
      code: "DB_ERROR",
      where,
      message: `Could not load workflow step: ${workflowStepError.message}`,
    });
  }

  if (!workflowStep) {
    throw new GuardrailError({
      code: "NOT_FOUND",
      where,
      message: "Workflow step not found for this submittal.",
    });
  }

  const { data: assignedResponse, error: assignedResponseError } =
    await supabase
      .from("submittal_responses")
      .select("id")
      .eq("submittal_id", submittalId)
      .eq("workflow_step_id", stepId)
      .in(
        "responder_id",
        await resolveWorkflowResponderIds({
          supabase: notificationSupabase ?? supabase,
          userId,
        }),
      )
      .eq("response_status", "Pending")
      .maybeSingle();

  if (assignedResponseError) {
    throw new GuardrailError({
      code: "DB_ERROR",
      where,
      message: `Could not load assigned workflow response: ${assignedResponseError.message}`,
    });
  }

  if (!assignedResponse) {
    throw new GuardrailError({
      code: "SUBMITTAL_WORKFLOW_NOT_ASSIGNED",
      where,
      status: 403,
      message: "You are not assigned to a pending response on this workflow step.",
    });
  }

  const now = new Date().toISOString();
  const { data: response, error: responseError } = await supabase
    .from("submittal_responses")
    .update({
      response_status: responseStatus,
      comments,
      responded_at: now,
      updated_at: now,
    })
    .eq("id", assignedResponse.id)
    .select("id, response_status")
    .single();

  if (responseError) {
    throw new GuardrailError({
      code: "DB_ERROR",
      where,
      message: `Could not record workflow response: ${responseError.message}`,
    });
  }

  const { data: steps, error: stepsError } = await supabase
    .from("submittal_workflow_steps")
    .select(
      "id, step_order, step_type, submittal_responses(responder_id, response_status)",
    )
    .eq("submittal_id", submittalId)
    .order("step_order", { ascending: true });

  if (stepsError) {
    throw new GuardrailError({
      code: "DB_ERROR",
      where,
      message: `Could not advance submittal workflow: ${stepsError.message}`,
    });
  }

  const currentStep = steps?.find((step) => step.id === stepId);
  const currentResponses = currentStep?.submittal_responses ?? [];
  const allCurrentResolved =
    currentResponses.length > 0 &&
    currentResponses.every((item) => item.response_status !== "Pending");

  let nextSubmittalStatus: string | null = submittal.status ?? null;
  let notificationTarget: {
    userId: string;
    stepId: string;
    stepType: string;
  } | null = null;
  let notificationSkipReason:
    | "step_still_pending"
    | "workflow_complete" = "step_still_pending";

  if (currentStep && allCurrentResolved) {
    const nextStep = steps?.find(
      (step) => step.step_order > currentStep.step_order,
    );
    const pendingResponder = nextStep?.submittal_responses?.find(
      (item) => item.response_status === "Pending",
    );
    notificationSkipReason = pendingResponder
      ? "step_still_pending"
      : "workflow_complete";
    notificationTarget =
      pendingResponder && nextStep
        ? {
            userId: pendingResponder.responder_id,
            stepId: nextStep.id,
            stepType: nextStep.step_type,
          }
        : null;

    const submittalPatch = pendingResponder
      ? {
          ball_in_court: pendingResponder.responder_id,
          updated_at: now,
        }
      : {
          status: "Closed",
          ball_in_court: null,
          updated_at: now,
        };
    nextSubmittalStatus = "status" in submittalPatch ? "Closed" : submittal.status;

    const { error: updateSubmittalError } = await supabase
      .from("submittals")
      .update(submittalPatch)
      .eq("id", submittalId)
      .eq("project_id", projectId);

    if (updateSubmittalError) {
      throw new GuardrailError({
        code: "DB_ERROR",
        where,
        message: `Could not update submittal workflow state: ${updateSubmittalError.message}`,
      });
    }
  }

  await insertWorkflowResponseHistory({
    supabase,
    submittalId,
    projectId,
    userId,
    previousStatus: submittal.status ?? null,
    newStatus: nextSubmittalStatus,
    responseId: response.id,
    stepId,
    responseStatus,
    comments,
    where,
  });

  const notification = await createWorkflowHandoffNotification({
    supabase,
    fallbackSupabase: notificationSupabase,
    submittalId,
    projectId,
    submittalNumber: submittal.submittal_number ?? null,
    submittalTitle: submittal.title ?? null,
    userId,
    responseId: response.id,
    stepId,
    responseStatus,
    target: notificationTarget,
    skipReason: notificationSkipReason,
    emailSender,
    where,
  });

  return { ...response, notification };
}
