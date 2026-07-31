import {
  recordAiNotificationDecision,
  type AiNotificationDecisionLedgerResult,
} from "@/lib/ai/notification-decision-ledger";

export type ProgressReportAiDecisionInput = {
  userId: string;
  projectId: number;
  reportId: string;
  weekStart: string;
  weekEnd: string;
};

export function recordProgressReportAiGeneratedDecision({
  userId,
  projectId,
  reportId,
  weekStart,
  weekEnd,
}: ProgressReportAiDecisionInput): Promise<AiNotificationDecisionLedgerResult> {
  return recordAiNotificationDecision({
    recipientUserId: userId,
    eventType: "client_report_ready_to_send",
    severity: "normal",
    projectId,
    entityType: "progress-reports",
    entityId: reportId,
    eventKey: `progress_report:${reportId}:ai_generated`,
    title: "AI progress report draft ready",
    body: `Review the AI-generated progress report sections for ${weekStart} through ${weekEnd}.`,
    isUserOnRelatedPage: true,
    preferenceHints: { suppressTeams: true },
  });
}
