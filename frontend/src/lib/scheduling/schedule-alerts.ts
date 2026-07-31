export type ScheduleAlertKind = "date_changed" | "dependency_changed" | "submittal_changed";

type AlertInput = {
  revisionId: string;
  revisionStatus: "draft" | "review" | "published" | "superseded";
  sourceTaskId: string;
  recipientUserId: string;
  kind: ScheduleAlertKind;
};

/** Published-only alert event contract. The deterministic key makes replays idempotent. */
export function buildPublishedScheduleAlert(input: AlertInput) {
  if (input.revisionStatus !== "published") return null;
  return {
    eventKey: `schedule-alert:${input.revisionId}:${input.sourceTaskId}:${input.recipientUserId}:${input.kind}`,
    metadata: {
      revisionId: input.revisionId,
      sourceTaskId: input.sourceTaskId,
      kind: input.kind,
    },
  };
}
