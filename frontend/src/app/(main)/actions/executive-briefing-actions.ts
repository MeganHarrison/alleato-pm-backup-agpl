"use server";

import * as React from "react";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Json } from "@/types/database.types";
import { requireCurrentUserAppCapability } from "@/lib/app-capabilities";
import { resolveAppBaseUrl } from "@/lib/email/client";
import { sendEmail } from "@/lib/email/send";
import { ExecutiveBriefingEmail } from "@/lib/executive/executive-briefing-email";
import { DEFAULT_EXECUTIVE_WINDOW_DAYS } from "@/lib/executive/brandon-daily-update";
import { loadCurrentDailyExecutiveBriefPacket } from "@/lib/daily-briefs/canonical-packets";
import type {
  BrandonBriefItem,
  BrandonDailyUpdatePacket,
} from "@/lib/executive/brandon-daily-update";
import { createServiceClient } from "@/lib/supabase/service";
import { serviceDb } from "@/lib/supabase/service-db";
import { getApiRouteUser } from "@/lib/supabase/server";
import {
  getExecutiveBriefingDashboard,
  setExecutiveFollowUpState,
} from "@/lib/executive/executive-briefing-workflow";
import {
  completeDailyBriefRun,
  failDailyBriefRun,
  recordDeliveryAttempt,
  recordDraftEvidence,
  recordEmailPayloadArtifact,
  sourceHealthForDraft,
  startDailyBriefRun,
  type DailyBriefRunContext,
} from "@/lib/ai-ops/executive-daily-brief-ledger";

const EXECUTIVE_PATH = "/daily-briefs";
const ADMIN_ACTIONS_PATH = "/actions";
const TASK_STATUS_VALUES = new Set([
  "open",
  "in_progress",
  "blocked",
  "done",
  "cancelled",
]);
const TASK_PRIORITY_VALUES = new Set(["high", "medium", "low"]);

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function redirectWithEmailStatus(status: "sent" | "failed", message: string) {
  const params = new URLSearchParams({
    emailStatus: status,
    emailMessage: message.slice(0, 180),
  });
  redirect(`${ADMIN_ACTIONS_PATH}?${params.toString()}`);
}

function parseRecipients(raw: string) {
  return raw
    .split(/[,\n;]/)
    .map((value) => value.trim())
    .filter(Boolean);
}

function normalizeExecutiveImprovementText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function executiveProjectLabel(project: {
  id: number;
  name: string | null;
  project_number: string | null;
}) {
  const label = project.name?.trim() || project.project_number?.trim();
  return label ? `${project.id} ${label}` : String(project.id);
}

function executiveRecapText(packet: BrandonDailyUpdatePacket) {
  const sections = [
    ["Critical Actions", packet.sections.needsBrandon],
    ["Unblock Your People", packet.sections.waitingOnOthers],
    ["Business Signal", packet.sections.importantUpdates],
  ] as const;

  const lines = [
    "DAILY OPERATING BRIEF",
    `Generated ${packet.generatedAt}`,
    `Source window: last ${packet.windowDays} calendar day${packet.windowDays === 1 ? "" : "s"}`,
    "",
  ];

  for (const [label, items] of sections) {
    lines.push(`${label.toUpperCase()}:`);
    if (items.length === 0) {
      lines.push("- No items.");
      lines.push("");
      continue;
    }

    for (const item of items) {
      lines.push(`- ${item.title} (${item.project})`);
      lines.push(`  ${item.summary}`);
      if (item.recommendedAction) {
        lines.push(`  Action: ${item.recommendedAction}`);
      }
    }
    lines.push("");
  }

  return lines.join("\n").trim();
}

function patchBriefingItemProject(
  item: BrandonBriefItem,
  sourceId: string,
  projectLabel: string,
) {
  const matchesPrimary = item.sourceId === sourceId;
  const matchesCitation = item.citations.some(
    (citation) => citation.sourceId === sourceId,
  );

  return matchesPrimary || matchesCitation
    ? {
        ...item,
        project: projectLabel,
      }
    : item;
}

function patchBriefingPacketProject(
  packet: BrandonDailyUpdatePacket,
  sourceId: string,
  projectLabel: string,
) {
  return {
    ...packet,
    sections: {
      needsBrandon: packet.sections.needsBrandon.map((item) =>
        patchBriefingItemProject(item, sourceId, projectLabel),
      ),
      waitingOnOthers: packet.sections.waitingOnOthers.map((item) =>
        patchBriefingItemProject(item, sourceId, projectLabel),
      ),
      importantUpdates: packet.sections.importantUpdates.map((item) =>
        patchBriefingItemProject(item, sourceId, projectLabel),
      ),
    },
  } satisfies BrandonDailyUpdatePacket;
}

function briefingProjectCount(packet: BrandonDailyUpdatePacket) {
  return new Set(
    [
      ...packet.sections.needsBrandon,
      ...packet.sections.waitingOnOthers,
      ...packet.sections.importantUpdates,
    ]
      .map((item) => item.project)
      .filter(Boolean),
  ).size;
}

export async function resolveExecutiveFollowUpAction(formData: FormData) {
  await requireCurrentUserAppCapability(
    "view_executive_briefing",
    "executive-briefing-actions#resolve-follow-up",
    "Executive briefing access required.",
  );
  const followUpId = formString(formData, "followUpId");
  if (!followUpId) {
    throw new Error("Missing executive follow-up id.");
  }

  const user = await getApiRouteUser();
  await setExecutiveFollowUpState({
    followUpId,
    nextState: "resolved",
    userId: user?.id ?? null,
  });
  revalidatePath(EXECUTIVE_PATH);
}

export async function reopenExecutiveFollowUpAction(formData: FormData) {
  await requireCurrentUserAppCapability(
    "view_executive_briefing",
    "executive-briefing-actions#reopen-follow-up",
    "Executive briefing access required.",
  );
  const followUpId = formString(formData, "followUpId");
  if (!followUpId) {
    throw new Error("Missing executive follow-up id.");
  }

  const user = await getApiRouteUser();
  await setExecutiveFollowUpState({
    followUpId,
    nextState: "open",
    userId: user?.id ?? null,
  });
  revalidatePath(EXECUTIVE_PATH);
}

export async function linkExecutiveSourceProjectAction(formData: FormData) {
  await requireCurrentUserAppCapability(
    "view_executive_briefing",
    "executive-briefing-actions#link-source-project",
    "Executive briefing access required.",
  );

  const sourceId = formString(formData, "sourceId");
  const projectId = Number(formString(formData, "projectId"));

  if (!sourceId) {
    throw new Error("Missing executive source id.");
  }

  if (!Number.isInteger(projectId) || projectId <= 0) {
    throw new Error("Select a valid project before linking this source.");
  }

  const supabase = createServiceClient();

  const { data: project, error: projectError } = await serviceDb.from("projects")
    .select("id, name, project_number")
    .eq("id", projectId)
    .single();

  if (projectError) {
    throw new Error(`Failed to load selected project: ${projectError.message}`);
  }

  const projectLabel = executiveProjectLabel(project);

  const { data: source, error: sourceError } = await serviceDb.from("document_metadata")
    .update({
      project_id: project.id,
      project: project.name ?? project.project_number ?? projectLabel,
    })
    .eq("id", sourceId)
    .select("id")
    .single();

  if (sourceError) {
    throw new Error(
      `Failed to link executive source to project: ${sourceError.message}`,
    );
  }

  const { error: taskUpdateError } = await serviceDb.from("tasks")
    .update({
      project_id: project.id,
      project_ids: [project.id],
    })
    .eq("metadata_id", source.id);

  if (taskUpdateError) {
    throw new Error(
      `Source project was linked, but related task project linkage failed: ${taskUpdateError.message}`,
    );
  }

  const { data: draft, error: draftError } = await serviceDb.from("daily_recaps")
    .select("id, briefing_packet")
    .eq("recap_kind", "executive_briefing")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (draftError) {
    throw new Error(
      `Source project was linked, but the executive briefing packet could not be loaded: ${draftError.message}`,
    );
  }

  const packet = draft?.briefing_packet as BrandonDailyUpdatePacket | null;
  if (draft && packet?.sections) {
    const patchedPacket = patchBriefingPacketProject(
      packet,
      source.id,
      projectLabel,
    );
    const { error: draftUpdateError } = await serviceDb.from("daily_recaps")
      .update({
        briefing_packet: patchedPacket as unknown as Json,
        recap_text: executiveRecapText(patchedPacket),
        project_count: briefingProjectCount(patchedPacket),
      })
      .eq("id", draft.id);

    if (draftUpdateError) {
      throw new Error(
        `Source project was linked, but the executive briefing packet could not be updated: ${draftUpdateError.message}`,
      );
    }
  }

  const { data: followUps, error: followUpsError } = await serviceDb.from("executive_briefing_follow_ups")
    .select("id, payload")
    .eq("source_id", source.id);

  if (followUpsError) {
    throw new Error(
      `Source project was linked, but follow-up project labels could not be loaded: ${followUpsError.message}`,
    );
  }

  for (const followUp of followUps ?? []) {
    const payload =
      followUp.payload &&
      typeof followUp.payload === "object" &&
      !Array.isArray(followUp.payload)
        ? ({ ...(followUp.payload as Record<string, unknown>), project: projectLabel } as Json)
        : followUp.payload;

    const { error: followUpUpdateError } = await serviceDb.from("executive_briefing_follow_ups")
      .update({
        project_label: projectLabel,
        payload,
      })
      .eq("id", followUp.id);

    if (followUpUpdateError) {
      throw new Error(
        `Source project was linked, but follow-up project labels could not be updated: ${followUpUpdateError.message}`,
      );
    }
  }

  revalidatePath(EXECUTIVE_PATH);
  return { linked: true, projectLabel };
}

export async function createExecutiveTaskDraftAction(formData: FormData) {
  await requireCurrentUserAppCapability(
    "view_executive_briefing",
    "executive-briefing-actions#create-task-draft",
    "Executive briefing access required.",
  );
  const sourceId = formString(formData, "sourceId");
  const title = formString(formData, "title");
  const description = formString(formData, "description");
  const assigneePersonId = formString(formData, "assigneePersonId");
  const dueDate = formString(formData, "dueDate") || null;
  const rawPriority = formString(formData, "priority") || "high";
  const rawStatus = formString(formData, "status") || "open";
  const priority = TASK_PRIORITY_VALUES.has(rawPriority) ? rawPriority : "high";
  const status = TASK_STATUS_VALUES.has(rawStatus) ? rawStatus : "open";

  if (!sourceId) {
    throw new Error("Missing executive source id.");
  }

  if (!title || !description) {
    throw new Error("Missing executive task draft content.");
  }

  const supabase = createServiceClient();

  const { data: metadata, error: metadataError } = await serviceDb.from("document_metadata")
    .select("id, project_id")
    .eq("id", sourceId)
    .single();

  if (metadataError) {
    throw new Error(
      `Failed to load executive source metadata: ${metadataError.message}`,
    );
  }

  let assigneeName: string | null = null;
  let assigneeEmail: string | null = null;
  let assigneePersonIdForTask: string | null = null;

  if (assigneePersonId) {
    const { data: person, error: personError } = await serviceDb.from("people")
      .select("id, first_name, last_name, email")
      .eq("id", assigneePersonId)
      .single();

    if (personError) {
      throw new Error(`Failed to load assignee: ${personError.message}`);
    }

    assigneePersonIdForTask = person.id;
    assigneeName =
      [person.first_name, person.last_name].filter(Boolean).join(" ").trim() ||
      null;
    assigneeEmail = person.email ?? null;
  }

  const normalizedTitle = normalizeExecutiveImprovementText(title);
  const normalizedDescription = normalizeExecutiveImprovementText(description);

  const { data: existingTask, error: existingTaskError } = await serviceDb.from("tasks")
    .select("id")
    .eq("metadata_id", metadata.id)
    .eq("title", normalizedTitle)
    .eq("description", normalizedDescription)
    .limit(1)
    .maybeSingle();

  if (existingTaskError) {
    throw new Error(
      `Failed to check for duplicate executive task: ${existingTaskError.message}`,
    );
  }

  if (!existingTask) {
    const projectId = metadata.project_id ?? null;
    const { error: insertError } = await serviceDb.from("tasks").insert({
      metadata_id: metadata.id,
      title: normalizedTitle,
      description: normalizedDescription,
      assignee_person_id: assigneePersonIdForTask,
      assignee_name: assigneeName,
      assignee_email: assigneeEmail,
      due_date: dueDate,
      project_id: projectId,
      project_ids: projectId ? [projectId] : null,
      source_system: "executive_briefing",
      status,
      priority,
    });

    if (insertError) {
      throw new Error(
        `Failed to create executive task draft: ${insertError.message}`,
      );
    }
  }

  revalidatePath(EXECUTIVE_PATH);
  return { created: !existingTask, taskId: existingTask?.id ?? null };
}

export async function updateExecutiveRelatedTaskAction(formData: FormData) {
  await requireCurrentUserAppCapability(
    "view_executive_briefing",
    "executive-briefing-actions#update-related-task",
    "Executive briefing access required.",
  );

  const taskId = formString(formData, "taskId");
  const rawTitle = formString(formData, "title");
  const assigneePersonId = formString(formData, "assigneePersonId");
  const rawStatus = formString(formData, "status") || "open";
  const rawPriority = formString(formData, "priority") || "medium";
  const dueDate = formString(formData, "dueDate") || null;
  const title = normalizeExecutiveImprovementText(rawTitle);
  const status = TASK_STATUS_VALUES.has(rawStatus) ? rawStatus : "open";
  const priority = TASK_PRIORITY_VALUES.has(rawPriority) ? rawPriority : "medium";

  if (!taskId) {
    throw new Error("Missing executive task id.");
  }

  if (!title) {
    throw new Error("Task name is required.");
  }

  if (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
    throw new Error("Use a valid task due date.");
  }

  const supabase = createServiceClient();
  let assigneeName: string | null = null;
  let assigneeEmail: string | null = null;
  let assigneePersonIdForTask: string | null = null;

  if (assigneePersonId) {
    const { data: person, error: personError } = await serviceDb.from("people")
      .select("id, first_name, last_name, email")
      .eq("id", assigneePersonId)
      .single();

    if (personError) {
      throw new Error(`Failed to load assignee: ${personError.message}`);
    }

    assigneePersonIdForTask = person.id;
    assigneeName =
      [person.first_name, person.last_name].filter(Boolean).join(" ").trim() ||
      person.email ||
      null;
    assigneeEmail = person.email ?? null;
  }

  const { error } = await serviceDb.from("tasks")
    .update({
      title,
      assignee_person_id: assigneePersonIdForTask,
      assignee_name: assigneeName,
      assignee_email: assigneeEmail,
      status,
      priority,
      due_date: dueDate,
      updated_at: new Date().toISOString(),
    })
    .eq("id", taskId);

  if (error) {
    throw new Error(`Failed to update executive task: ${error.message}`);
  }

  revalidatePath(EXECUTIVE_PATH);
  return { updated: true };
}

export async function deleteExecutiveRelatedTaskAction(formData: FormData) {
  await requireCurrentUserAppCapability(
    "view_executive_briefing",
    "executive-briefing-actions#delete-related-task",
    "Executive briefing access required.",
  );

  const taskId = formString(formData, "taskId");
  if (!taskId) {
    throw new Error("Missing executive task id.");
  }

  const supabase = createServiceClient();
  const { data, error } = await serviceDb.from("tasks")
    .delete()
    .eq("id", taskId)
    .select("id")
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to delete executive task: ${error.message}`);
  }

  if (!data) {
    throw new Error("Executive task was not found or was already deleted.");
  }

  revalidatePath(EXECUTIVE_PATH);
  return { deleted: true };
}

export async function createOperationalImprovementAction(formData: FormData) {
  await requireCurrentUserAppCapability(
    "view_executive_briefing",
    "executive-briefing-actions#create-operational-improvement",
    "Executive briefing access required.",
  );

  const linkId = formString(formData, "linkId");
  const linkType = formString(formData, "linkType");
  const title = formString(formData, "title");
  const problemSummary = formString(formData, "problemSummary");
  const recommendedFix = formString(formData, "recommendedFix");
  const preventionStep = formString(formData, "preventionStep");
  const priority = formString(formData, "priority") || "medium";
  const dueDate = formString(formData, "dueDate") || null;
  const assigneePersonId = formString(formData, "assigneePersonId");

  if (!linkId || !linkType) {
    throw new Error("Missing operational improvement link context.");
  }

  if (!title || !problemSummary) {
    throw new Error("Missing operational improvement content.");
  }

  if (linkType !== "executive_source" && linkType !== "executive_follow_up") {
    throw new Error("Invalid operational improvement link type.");
  }

  const supabase = createServiceClient();

  let assignee: string | null = null;
  let assigneeId: string | null = null;

  if (assigneePersonId) {
    const { data: person, error: personError } = await serviceDb.from("people")
      .select("id, first_name, last_name, email")
      .eq("id", assigneePersonId)
      .single();

    if (personError) {
      throw new Error(`Failed to load assignee: ${personError.message}`);
    }

    assigneeId = person.id;
    assignee =
      [person.first_name, person.last_name].filter(Boolean).join(" ").trim() ||
      person.email ||
      null;
  }

  const normalizedTitle = normalizeExecutiveImprovementText(title);
  const normalizedDescription = [
    `Problem: ${normalizeExecutiveImprovementText(problemSummary)}`,
    recommendedFix
      ? `Recommended fix: ${normalizeExecutiveImprovementText(recommendedFix)}`
      : null,
    preventionStep
      ? `Prevention step: ${normalizeExecutiveImprovementText(preventionStep)}`
      : null,
  ]
    .filter(Boolean)
    .join("\n\n");

  const { data: existingCard, error: existingCardError } = await serviceDb.from("initiative_cards")
    .select("id")
    .eq("linked_record_type", linkType)
    .eq("linked_record_id", linkId)
    .neq("status", "done")
    .limit(1)
    .maybeSingle();

  if (existingCardError) {
    throw new Error(
      `Failed to check for existing operational improvement: ${existingCardError.message}`,
    );
  }

  if (!existingCard) {
    const { data: maxRow, error: maxRowError } = await serviceDb.from("initiative_cards")
      .select("sort_order")
      .eq("status", "idea")
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (maxRowError) {
      throw new Error(
        `Failed to calculate operational improvement sort order: ${maxRowError.message}`,
      );
    }

    const { error: insertError } = await serviceDb.from("initiative_cards")
      .insert({
        title: normalizedTitle,
        description: normalizedDescription,
        status: "idea",
        priority:
          priority === "urgent" ||
          priority === "high" ||
          priority === "medium" ||
          priority === "low"
            ? priority
            : "medium",
        labels: ["Executive", "Operational Improvement"],
        sort_order: (maxRow?.sort_order ?? -1) + 1,
        linked_record_type: linkType,
        linked_record_id: linkId,
        source: "manual",
        assignee,
        assignee_id: assigneeId,
        due_date: dueDate,
      });

    if (insertError) {
      throw new Error(
        `Failed to create operational improvement card: ${insertError.message}`,
      );
    }
  }

  revalidatePath(EXECUTIVE_PATH);
}

export async function sendExecutiveBriefingEmailAction(formData: FormData) {
  await requireCurrentUserAppCapability(
    "view_executive_briefing",
    "executive-briefing-actions#send-email",
    "Executive briefing access required.",
  );

  const draftId = formString(formData, "draftId");
  const recipients = parseRecipients(formString(formData, "recipients"));
  const subject =
    formString(formData, "subject").trim() || "Daily operating brief";
  const introNote = formString(formData, "introNote").trim();

  if (!draftId) {
    redirectWithEmailStatus("failed", "Missing executive briefing draft id.");
  }

  if (recipients.length === 0) {
    redirectWithEmailStatus(
      "failed",
      "Add at least one recipient email address.",
    );
  }

  const dashboard = await getExecutiveBriefingDashboard({
    windowDays: DEFAULT_EXECUTIVE_WINDOW_DAYS,
  });

  if (dashboard.draft.id !== draftId) {
    redirectWithEmailStatus(
      "failed",
      "The visible executive draft is stale. Refresh the page and send the latest draft.",
    );
  }

  const user = await getApiRouteUser();
  const senderLabel = user?.email?.trim() || "Alleato";
  const canonicalPacket = await loadCurrentDailyExecutiveBriefPacket();
  const briefUrl = `${resolveAppBaseUrl()}/daily-briefs/${canonicalPacket.id}`;
  let runContext: DailyBriefRunContext | null = null;
  const runRecipientMetadata = recipients.map((recipient) => ({
    address: recipient,
  }));
  let emailStatus: "sent" | "failed" = "sent";
  let emailMessage = `Sent to ${recipients.join(", ")}`;

  try {
    runContext = await startDailyBriefRun({
      eventType: "email_event",
      triggerType: "manual_email_send",
      surface: "executive-briefing-actions#send-email",
      title: "Executive Daily Brief email delivery",
      userGoal: "Deliver the Executive Daily Brief by email.",
      normalizedGoal:
        "Send the selected Executive Daily Brief email and record provider, recipient, payload, packet, and evidence ledger rows.",
      actorDisplayName: senderLabel,
      deliveryTarget: {
        channel: "email",
        recipientCount: recipients.length,
      },
      payload: {
        draftId,
        recapDate: dashboard.draft.recapDate,
        subject,
        recipientCount: recipients.length,
      },
      metadata: {
        workflowStatus: dashboard.draft.workflowStatus,
        recipients: runRecipientMetadata,
      },
    });

    await recordDraftEvidence(runContext, dashboard.draft);
    const payloadArtifact = await recordEmailPayloadArtifact(runContext, {
      title: "Executive Daily Brief email payload",
      contentType: "text/html",
      metadata: {
        draftId,
        recapDate: dashboard.draft.recapDate,
        workflowStatus: dashboard.draft.workflowStatus,
        subject,
        recipientCount: recipients.length,
        recipients: runRecipientMetadata,
        introNote: introNote || null,
      },
    });

    const result = await sendEmail({
      template: "status-report",
      to: recipients,
      subject,
      react: React.createElement(ExecutiveBriefingEmail, {
        packet: dashboard.draft.packet,
        briefUrl,
        senderLabel,
        introNote: introNote || null,
      }),
      entity: { type: "executive_briefing", id: draftId },
      userId: user?.id ?? undefined,
      idempotencyKey: `executive-briefing/${draftId}/${runContext.runId}`,
      metadata: {
        source: "executive-manual-send",
        aiWorkRunId: runContext.runId,
        recapDate: dashboard.draft.recapDate,
        workflowStatus: dashboard.draft.workflowStatus,
        recipientCount: recipients.length,
        recipients,
        introNote: introNote || null,
      },
    });

    if (result.error) {
      for (const recipient of recipients) {
        await recordDeliveryAttempt(runContext, {
          artifactId: payloadArtifact.id,
          channel: "email",
          recipientAddress: recipient,
          status: "failed",
          failureCode: "EMAIL_PROVIDER_FAILED",
          failureMessage: result.error.message,
          retryable: true,
          metadata: {
            provider: "resend",
            providerErrorName: result.error.name ?? null,
          },
        });
      }
      await completeDailyBriefRun(runContext, {
        status: "failed_retryable",
        dailyRecapId: dashboard.draft.id,
        deliveryStatus: "failed",
        resultSummary: `Executive Daily Brief email failed: ${result.error.message}`,
        deliveryTarget: {
          channel: "email",
          recipientCount: recipients.length,
          failedRecipientCount: recipients.length,
        },
        sourceCounts: {
          recipientCount: recipients.length,
          failedRecipientCount: recipients.length,
        },
        sourceHealth: sourceHealthForDraft(dashboard.draft),
        metadata: {
          provider: "resend",
          providerErrorName: result.error.name ?? null,
        },
      });
      emailStatus = "failed";
      emailMessage = result.error.message;
    } else {
      for (const recipient of recipients) {
        await recordDeliveryAttempt(runContext, {
          artifactId: payloadArtifact.id,
          channel: "email",
          recipientAddress: recipient,
          status: "sent",
          providerMessageId: result.id,
          retryable: false,
          metadata: { provider: "resend" },
        });
      }

      await completeDailyBriefRun(runContext, {
        status: "succeeded",
        dailyRecapId: dashboard.draft.id,
        deliveryStatus: "sent",
        resultSummary: `Sent Executive Daily Brief email to ${recipients.length} recipient(s).`,
        deliveryTarget: {
          channel: "email",
          recipientCount: recipients.length,
          sentCount: recipients.length,
        },
        sourceCounts: {
          recipientCount: recipients.length,
          sentCount: recipients.length,
        },
        sourceHealth: sourceHealthForDraft(dashboard.draft),
        metadata: {
          provider: "resend",
          providerMessageId: result.id,
        },
      });
    }
  } catch (error) {
    await failDailyBriefRun(
      runContext,
      error,
      "EXECUTIVE_DAILY_BRIEF_EMAIL_SEND_FAILED",
    );
    redirectWithEmailStatus(
      "failed",
      error instanceof Error
        ? error.message
        : "Executive Daily Brief email failed.",
    );
  }

  revalidatePath(EXECUTIVE_PATH);
  redirectWithEmailStatus(emailStatus, emailMessage);
}
