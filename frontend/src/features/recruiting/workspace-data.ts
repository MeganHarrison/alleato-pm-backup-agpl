import type {
  RecruitingApplication,
  RecruitingDisposition,
  RecruitingEvidenceStatus,
  RecruitingWorkspaceSnapshot,
} from "@/lib/recruiting/contracts";

import {
  INITIAL_RECRUITING_STATE,
  RECRUITING_REQUISITIONS,
} from "./prototype-data";

function mapEvidenceStatus(
  status: "Review ready" | "Needs review",
): RecruitingEvidenceStatus {
  return status === "Review ready" ? "review_ready" : "needs_review";
}

function mapDisposition(
  disposition: "Advance" | "Hold" | "Not qualified" | "Evaluate another role",
): RecruitingDisposition {
  const values: Record<typeof disposition, RecruitingDisposition> = {
    Advance: "advance",
    Hold: "hold",
    "Not qualified": "not_qualified",
    "Evaluate another role": "evaluate_another_role",
  };
  return values[disposition];
}

function mapApplication(
  application: (typeof INITIAL_RECRUITING_STATE.applications)[number],
): RecruitingApplication {
  const disposition = mapDisposition(application.disposition);
  return {
    id: application.id,
    candidateId: application.candidateId,
    requisitionId: application.requisitionId,
    stage: application.stage,
    source: application.source,
    receivedAt: application.receivedAt,
    evidenceStatus: mapEvidenceStatus(application.evidenceStatus),
    disposition,
    dispositionReason:
      disposition === "not_qualified" ? "Synthetic example disposition." : null,
    resumeDocument: {
      id: `resume-${application.id}`,
      filename: `${application.candidateId}-synthetic-resume.pdf`,
      mimeType: "application/pdf",
      sizeBytes: 48000,
      synthetic: true,
      reviewStatus:
        application.evidenceStatus === "Review ready" ? "verified" : "pending",
    },
  };
}

export const INITIAL_RECRUITING_WORKSPACE: RecruitingWorkspaceSnapshot = {
  schemaVersion: 1,
  revision: 0,
  syntheticOnly: true,
  updatedAt: "2026-07-28T03:00:00.000Z",
  requisitions: RECRUITING_REQUISITIONS.map((requisition) => ({
    ...requisition,
    status: "open" as const,
  })),
  candidates: INITIAL_RECRUITING_STATE.candidates,
  applications: INITIAL_RECRUITING_STATE.applications.map(mapApplication),
  auditEvents: INITIAL_RECRUITING_STATE.applications.flatMap((application) =>
    application.timeline.map((event) => ({
      id: event.id,
      occurredAt: event.at,
      actorId: "prototype-seed",
      actorLabel: "Prototype history",
      action: "application.source_history_imported" as const,
      applicationId: application.id,
      candidateId: application.candidateId,
      fromValue: null,
      toValue: null,
      detail: event.label,
    })),
  ),
};
