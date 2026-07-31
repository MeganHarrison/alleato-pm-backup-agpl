import {
  recordAiNotificationDecision,
  type AiNotificationDecisionLedgerResult,
} from "@/lib/ai/notification-decision-ledger";

export type RfiAiNotificationRecipient = {
  name: string;
  email: string;
  userId?: string | null;
  userMappingStatus: "mapped" | "unmapped" | "ambiguous";
};

export type RfiOpenedAiNotificationInput = {
  projectId: number;
  projectName: string;
  rfiId: string;
  rfiNumber: string | number | null;
  rfiSubject: string | null;
  actorUserId: string;
  recipients: RfiAiNotificationRecipient[];
  assigneeEmails: Set<string>;
  failedEmailRecipients?: Set<string>;
};

export type RfiAiNotificationDecisionSummary = {
  attempted: number;
  recorded: number;
  skippedDuplicate: number;
  skippedUnmapped: number;
  skippedAmbiguous: number;
  failed: Array<{ userId: string; code: string; message: string }>;
};

function emptySummary(): RfiAiNotificationDecisionSummary {
  return {
    attempted: 0,
    recorded: 0,
    skippedDuplicate: 0,
    skippedUnmapped: 0,
    skippedAmbiguous: 0,
    failed: [],
  };
}

function applyDecisionResult(
  summary: RfiAiNotificationDecisionSummary,
  userId: string,
  result: AiNotificationDecisionLedgerResult,
) {
  if (result.status === "recorded") {
    summary.recorded += 1;
    return;
  }

  if (result.status === "skipped_duplicate") {
    summary.skippedDuplicate += 1;
    return;
  }

  summary.failed.push({
    userId,
    code: result.error.code,
    message: result.error.message,
  });
}

function warnIfIncomplete(
  input: Pick<RfiOpenedAiNotificationInput, "projectId" | "rfiId">,
  summary: RfiAiNotificationDecisionSummary,
) {
  if (summary.skippedUnmapped > 0 || summary.skippedAmbiguous > 0) {
    console.warn("[rfi-notify] AI notification decision skipped for unmapped recipients", {
      projectId: input.projectId,
      rfiId: input.rfiId,
      skippedUnmapped: summary.skippedUnmapped,
      skippedAmbiguous: summary.skippedAmbiguous,
    });
  }

  if (summary.failed.length > 0) {
    console.warn("[rfi-notify] AI notification decision failed", {
      projectId: input.projectId,
      rfiId: input.rfiId,
      failed: summary.failed.map((failure) => ({
        userId: failure.userId,
        code: failure.code,
        message: failure.message,
      })),
    });
  }
}

export async function recordRfiOpenedAiNotificationDecisions(
  input: RfiOpenedAiNotificationInput,
): Promise<RfiAiNotificationDecisionSummary> {
  const summary = emptySummary();
  const recipientByUserId = new Map<string, RfiAiNotificationRecipient>();

  for (const recipient of input.recipients) {
    if (recipient.userMappingStatus === "ambiguous") {
      summary.skippedAmbiguous += 1;
      continue;
    }

    if (!recipient.userId) {
      summary.skippedUnmapped += 1;
      continue;
    }

    recipientByUserId.set(recipient.userId, recipient);
  }

  const rfiLabel = input.rfiNumber ? `RFI #${input.rfiNumber}` : "RFI";
  const subject = input.rfiSubject?.trim() || "Untitled RFI";

  await Promise.all(
    [...recipientByUserId.entries()].map(async ([userId, recipient]) => {
      summary.attempted += 1;
      const isAssignee = input.assigneeEmails.has(recipient.email);
      const hasDeliveryFailure = input.failedEmailRecipients?.has(recipient.email) ?? false;

      try {
        const result = await recordAiNotificationDecision({
          recipientUserId: userId,
          actorId: input.actorUserId,
          eventType: "rfi_assigned",
          severity: hasDeliveryFailure ? "high" : "normal",
          projectId: input.projectId,
          entityType: "rfi",
          entityId: input.rfiId,
          eventKey: `rfi:${input.rfiId}:opened`,
          title: `${rfiLabel} opened: ${subject}`,
          body: isAssignee
            ? `Review ${rfiLabel} for ${input.projectName}; you are assigned to respond or coordinate ownership.`
            : `Review ${rfiLabel} for ${input.projectName}; you were included in the opened RFI notification.`,
          sourceConfidence: 1,
          hasDeliveryFailure,
          preferenceHints: { suppressTeams: true },
        });
        applyDecisionResult(summary, userId, result);
      } catch (error) {
        summary.failed.push({
          userId,
          code: "unexpected_exception",
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }),
  );

  warnIfIncomplete(input, summary);
  return summary;
}
