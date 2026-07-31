import {
  recruitingWorkspaceSnapshotSchema,
  type RecruitingWorkspaceSnapshot,
} from "../contracts";

const validSnapshot: RecruitingWorkspaceSnapshot = {
  schemaVersion: 1,
  revision: 0,
  syntheticOnly: true,
  updatedAt: "2026-07-28T12:00:00.000Z",
  requisitions: [
    {
      id: "req-1",
      title: "Project Manager",
      location: "Indianapolis, IN",
      status: "open",
    },
  ],
  candidates: [
    {
      id: "candidate-1",
      name: "Jordan Lee",
      email: "jordan.lee@example.test",
      phone: "(555) 010-0114",
      location: "Carmel, IN",
      currentRole: "Project Executive",
      currentCompany: "Example Builders",
      resumeFacts: ["Synthetic resume fact"],
    },
  ],
  applications: [
    {
      id: "application-1",
      candidateId: "candidate-1",
      requisitionId: "req-1",
      stage: "review",
      source: "Synthetic referral",
      receivedAt: "2026-07-28T12:00:00.000Z",
      evidenceStatus: "needs_review",
      disposition: "hold",
      dispositionReason: null,
      resumeDocument: {
        id: "resume-1",
        filename: "synthetic-resume.pdf",
        mimeType: "application/pdf",
        sizeBytes: 12000,
        synthetic: true,
        reviewStatus: "pending",
      },
    },
  ],
  auditEvents: [],
};

describe("Applicant Tracker workspace contracts", () => {
  it("accepts a complete synthetic workspace snapshot", () => {
    expect(recruitingWorkspaceSnapshotSchema.parse(validSnapshot)).toEqual(
      validSnapshot,
    );
  });

  it("rejects a real-looking email while the workspace is synthetic-only", () => {
    const unsafeSnapshot: RecruitingWorkspaceSnapshot = {
      ...validSnapshot,
      candidates: [
        {
          ...validSnapshot.candidates[0],
          email: "candidate@real-company.com",
        },
      ],
    };

    const result = recruitingWorkspaceSnapshotSchema.safeParse(unsafeSnapshot);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain(
        "example.test addresses",
      );
    }
  });

  it("rejects application references to missing candidates", () => {
    const invalidSnapshot: RecruitingWorkspaceSnapshot = {
      ...validSnapshot,
      candidates: [],
    };

    const result = recruitingWorkspaceSnapshotSchema.safeParse(invalidSnapshot);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain("missing candidate");
    }
  });

  it("requires at least one requisition so the workspace always has a valid view", () => {
    const result = recruitingWorkspaceSnapshotSchema.safeParse({
      ...validSnapshot,
      requisitions: [],
      candidates: [],
      applications: [],
    });

    expect(result.success).toBe(false);
  });
});
