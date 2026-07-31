export type RecruitingStage =
  | "new"
  | "review"
  | "qualified"
  | "interview"
  | "offer";

export type EvidenceStatus = "Review ready" | "Needs review";

export interface RecruitingCandidate {
  id: string;
  name: string;
  email: string;
  phone: string;
  location: string;
  currentRole: string;
  currentCompany: string;
  resumeFacts: string[];
}

export interface RecruitingTimelineEvent {
  id: string;
  at: string;
  label: string;
}

export interface RecruitingApplication {
  id: string;
  candidateId: string;
  requisitionId: string;
  stage: RecruitingStage;
  source: string;
  receivedAt: string;
  evidenceStatus: EvidenceStatus;
  disposition: "Advance" | "Hold" | "Not qualified" | "Evaluate another role";
  timeline: RecruitingTimelineEvent[];
}

export interface RecruitingRequisition {
  id: string;
  title: string;
  location: string;
}

export interface RecruitingPrototypeState {
  candidates: RecruitingCandidate[];
  applications: RecruitingApplication[];
}

export interface PrototypeMutationResult {
  state: RecruitingPrototypeState;
  error?: string;
  applicationId?: string;
}

export const RECRUITING_STAGES: ReadonlyArray<{
  id: RecruitingStage;
  label: string;
}> = [
  { id: "new", label: "New" },
  { id: "review", label: "Review" },
  { id: "qualified", label: "Qualified" },
  { id: "interview", label: "Interview" },
  { id: "offer", label: "Offer" },
];

export function stageLabel(stage: RecruitingStage): string {
  return RECRUITING_STAGES.find((item) => item.id === stage)?.label ?? stage;
}

export function moveApplication(
  state: RecruitingPrototypeState,
  applicationId: string,
  nextStage: RecruitingStage,
  occurredAt: string,
): PrototypeMutationResult {
  const application = state.applications.find(
    (item) => item.id === applicationId,
  );

  if (!application) {
    return {
      state,
      error:
        "The application could not be found. Reset the demo and try again.",
    };
  }

  if (application.stage === nextStage) {
    return {
      state,
      error: `${stageLabel(nextStage)} is already the current stage.`,
    };
  }

  return {
    state: {
      ...state,
      applications: state.applications.map((item) =>
        item.id === applicationId
          ? {
              ...item,
              stage: nextStage,
              timeline: [
                {
                  id: `${applicationId}-${occurredAt}`,
                  at: occurredAt,
                  label: `Moved to ${stageLabel(nextStage)}`,
                },
                ...item.timeline,
              ],
            }
          : item,
      ),
    },
  };
}

export function setApplicationDisposition(
  state: RecruitingPrototypeState,
  applicationId: string,
  disposition: RecruitingApplication["disposition"],
  occurredAt: string,
): PrototypeMutationResult {
  const application = state.applications.find(
    (item) => item.id === applicationId,
  );

  if (!application) {
    return {
      state,
      error:
        "The application could not be found. Reset the demo and try again.",
    };
  }

  return {
    state: {
      ...state,
      applications: state.applications.map((item) =>
        item.id === applicationId
          ? {
              ...item,
              disposition,
              timeline: [
                {
                  id: `${applicationId}-disposition-${occurredAt}`,
                  at: occurredAt,
                  label: `Disposition set to ${disposition}`,
                },
                ...item.timeline,
              ],
            }
          : item,
      ),
    },
  };
}

export function addSampleApplicant(
  state: RecruitingPrototypeState,
  requisitionId: string,
  occurredAt: string,
): PrototypeMutationResult {
  if (state.applications.some((item) => item.id === "application-sample")) {
    return {
      state,
      error:
        "The sample resume is already on the board. Reset the demo to add it again.",
    };
  }

  const candidate: RecruitingCandidate = {
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
      "Searchable synthetic PDF; 4 pages",
    ],
  };

  const application: RecruitingApplication = {
    id: "application-sample",
    candidateId: candidate.id,
    requisitionId,
    stage: "new",
    source: "Recruiting mailbox",
    receivedAt: occurredAt,
    evidenceStatus: "Needs review",
    disposition: "Hold",
    timeline: [
      {
        id: `application-sample-${occurredAt}`,
        at: occurredAt,
        label: "Synthetic resume received; verification required",
      },
    ],
  };

  return {
    state: {
      candidates: [...state.candidates, candidate],
      applications: [...state.applications, application],
    },
    applicationId: application.id,
  };
}

export function matchesRecruitingSearch(
  candidate: RecruitingCandidate,
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
