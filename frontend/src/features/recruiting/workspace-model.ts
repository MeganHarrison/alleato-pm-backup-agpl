import type {
  RecruitingAuditEvent,
  RecruitingDisposition,
  RecruitingStage,
  RecruitingWorkspaceSnapshot,
} from "@/lib/recruiting/contracts";

export const RECRUITING_WORKSPACE_STAGES: ReadonlyArray<{
  id: RecruitingStage;
  label: string;
}> = [
  { id: "new", label: "New" },
  { id: "review", label: "Review" },
  { id: "qualified", label: "Qualified" },
  { id: "interview", label: "Interview" },
  { id: "offer", label: "Offer" },
  { id: "hired", label: "Hired" },
  { id: "closed", label: "Closed" },
];

export const RECRUITING_DISPOSITIONS: ReadonlyArray<{
  id: RecruitingDisposition;
  label: string;
}> = [
  { id: "advance", label: "Advance" },
  { id: "hold", label: "Hold" },
  { id: "not_qualified", label: "Not qualified" },
  { id: "evaluate_another_role", label: "Evaluate another role" },
  { id: "withdrawn", label: "Withdrawn" },
  { id: "hired", label: "Hired" },
];

export interface RecruitingMutationContext {
  actorId: string;
  actorLabel: string;
  occurredAt: string;
}

export type RecruitingMutationResult =
  | {
      ok: true;
      snapshot: RecruitingWorkspaceSnapshot;
      applicationId?: string;
    }
  | {
      ok: false;
      error: string;
    };

function auditEvent(
  context: RecruitingMutationContext,
  event: Omit<
    RecruitingAuditEvent,
    "id" | "occurredAt" | "actorId" | "actorLabel"
  >,
): RecruitingAuditEvent {
  const transition = `${event.fromValue ?? "none"}-${event.toValue ?? "none"}`;
  return {
    id: `${event.applicationId}-${event.action}-${transition}-${context.occurredAt}`,
    occurredAt: context.occurredAt,
    actorId: context.actorId,
    actorLabel: context.actorLabel,
    ...event,
  };
}

export function recruitingStageLabel(stage: RecruitingStage): string {
  return (
    RECRUITING_WORKSPACE_STAGES.find((item) => item.id === stage)?.label ??
    stage
  );
}

export function recruitingDispositionLabel(
  disposition: RecruitingDisposition,
): string {
  return (
    RECRUITING_DISPOSITIONS.find((item) => item.id === disposition)?.label ??
    disposition
  );
}

export function moveWorkspaceApplication(
  snapshot: RecruitingWorkspaceSnapshot,
  input: {
    applicationId: string;
    nextStage: RecruitingStage;
  },
  context: RecruitingMutationContext,
): RecruitingMutationResult {
  const application = snapshot.applications.find(
    (item) => item.id === input.applicationId,
  );
  if (!application) {
    return {
      ok: false,
      error:
        "The application could not be found. Reload the local workspace and try again.",
    };
  }
  if (application.stage === input.nextStage) {
    return {
      ok: false,
      error: `${recruitingStageLabel(input.nextStage)} is already the current stage.`,
    };
  }

  const event = auditEvent(context, {
    action: "application.stage_changed",
    applicationId: application.id,
    candidateId: application.candidateId,
    fromValue: application.stage,
    toValue: input.nextStage,
    detail: `Application moved from ${recruitingStageLabel(application.stage)} to ${recruitingStageLabel(input.nextStage)}.`,
  });

  return {
    ok: true,
    snapshot: {
      ...snapshot,
      applications: snapshot.applications.map((item) =>
        item.id === application.id ? { ...item, stage: input.nextStage } : item,
      ),
      auditEvents: [event, ...snapshot.auditEvents],
    },
  };
}

export function setWorkspaceDisposition(
  snapshot: RecruitingWorkspaceSnapshot,
  input: {
    applicationId: string;
    disposition: RecruitingDisposition;
    reason: string | null;
  },
  context: RecruitingMutationContext,
): RecruitingMutationResult {
  const application = snapshot.applications.find(
    (item) => item.id === input.applicationId,
  );
  if (!application) {
    return {
      ok: false,
      error:
        "The application could not be found. Reload the local workspace and try again.",
    };
  }
  const reason = input.reason?.trim() || null;
  if (reason && reason.length > 900) {
    return {
      ok: false,
      error: "Disposition reasons must be 900 characters or fewer.",
    };
  }
  if (input.disposition === "not_qualified" && !reason) {
    return {
      ok: false,
      error:
        "A disposition reason is required when an application is not qualified.",
    };
  }
  if (input.disposition === "withdrawn" && !reason) {
    return {
      ok: false,
      error:
        "A disposition reason is required when an application is withdrawn.",
    };
  }

  const event = auditEvent(context, {
    action: "application.disposition_changed",
    applicationId: application.id,
    candidateId: application.candidateId,
    fromValue: application.disposition,
    toValue: input.disposition,
    detail: reason
      ? `Disposition changed to ${recruitingDispositionLabel(input.disposition)}. Reason: ${reason}`
      : `Disposition changed to ${recruitingDispositionLabel(input.disposition)}.`,
  });

  return {
    ok: true,
    snapshot: {
      ...snapshot,
      applications: snapshot.applications.map((item) =>
        item.id === application.id
          ? {
              ...item,
              disposition: input.disposition,
              dispositionReason: reason,
            }
          : item,
      ),
      auditEvents: [event, ...snapshot.auditEvents],
    },
  };
}

export function markWorkspaceResumeReviewed(
  snapshot: RecruitingWorkspaceSnapshot,
  applicationId: string,
  context: RecruitingMutationContext,
): RecruitingMutationResult {
  const application = snapshot.applications.find(
    (item) => item.id === applicationId,
  );
  if (!application) {
    return {
      ok: false,
      error:
        "The application could not be found. Reload the local workspace and try again.",
    };
  }
  if (
    application.evidenceStatus === "review_ready" &&
    application.resumeDocument.reviewStatus === "verified"
  ) {
    return {
      ok: false,
      error: "This synthetic resume has already been marked reviewed.",
    };
  }

  const event = auditEvent(context, {
    action: "application.resume_reviewed",
    applicationId: application.id,
    candidateId: application.candidateId,
    fromValue: application.resumeDocument.reviewStatus,
    toValue: "verified",
    detail: "Synthetic resume evidence marked as reviewed by a human.",
  });

  return {
    ok: true,
    snapshot: {
      ...snapshot,
      applications: snapshot.applications.map((item) =>
        item.id === application.id
          ? {
              ...item,
              evidenceStatus: "review_ready",
              resumeDocument: {
                ...item.resumeDocument,
                reviewStatus: "verified",
              },
            }
          : item,
      ),
      auditEvents: [event, ...snapshot.auditEvents],
    },
  };
}

export function addSyntheticApplicant(
  snapshot: RecruitingWorkspaceSnapshot,
  input: { requisitionId: string },
  context: RecruitingMutationContext,
): RecruitingMutationResult {
  if (
    snapshot.applications.some(
      (application) => application.id === "application-sample",
    )
  ) {
    return {
      ok: false,
      error:
        "The Taylor Morgan sample is already in this local workspace. Reset the workspace to add it again.",
    };
  }
  if (
    !snapshot.requisitions.some(
      (requisition) =>
        requisition.id === input.requisitionId && requisition.status === "open",
    )
  ) {
    return {
      ok: false,
      error:
        "Choose an open requisition before adding the synthetic applicant.",
    };
  }

  const candidate = {
    id: "candidate-sample",
    name: "Taylor Morgan",
    email: "taylor.morgan@example.test",
    phone: "(555) 010-0199",
    location: "Indianapolis, IN",
    currentRole: "Regional Operations Director",
    currentCompany: "Northline Builders",
    resumeFacts: [
      "Led multi-state construction operations",
      "Managed project and field leadership teams",
      "Synthetic PDF sample; four pages",
    ],
  };
  const application = {
    id: "application-sample",
    candidateId: candidate.id,
    requisitionId: input.requisitionId,
    stage: "new" as const,
    source: "Synthetic recruiting mailbox",
    receivedAt: context.occurredAt,
    evidenceStatus: "needs_review" as const,
    disposition: "hold" as const,
    dispositionReason: null,
    resumeDocument: {
      id: "resume-application-sample",
      filename: "taylor-morgan-synthetic-resume.pdf",
      mimeType: "application/pdf" as const,
      sizeBytes: 64000,
      synthetic: true as const,
      reviewStatus: "pending" as const,
    },
  };
  const event = auditEvent(context, {
    action: "application.synthetic_intake_created",
    applicationId: application.id,
    candidateId: candidate.id,
    fromValue: null,
    toValue: "new",
    detail:
      "Synthetic candidate, application, and resume metadata created in the local review workspace.",
  });

  return {
    ok: true,
    applicationId: application.id,
    snapshot: {
      ...snapshot,
      candidates: [...snapshot.candidates, candidate],
      applications: [...snapshot.applications, application],
      auditEvents: [event, ...snapshot.auditEvents],
    },
  };
}

export function matchesWorkspaceCandidateSearch(
  candidate: RecruitingWorkspaceSnapshot["candidates"][number],
  query: string,
): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  return [
    candidate.name,
    candidate.currentRole,
    candidate.currentCompany,
    candidate.location,
  ].some((value) => value.toLowerCase().includes(normalized));
}
