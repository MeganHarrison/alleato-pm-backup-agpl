import { INITIAL_RECRUITING_WORKSPACE } from "../workspace-data";
import { recruitingWorkspaceSnapshotSchema } from "@/lib/recruiting/contracts";
import {
  addSyntheticApplicant,
  moveWorkspaceApplication,
  setWorkspaceDisposition,
} from "../workspace-model";

describe("Applicant Tracker local workspace model", () => {
  it("preserves seeded application history in the initial audit timeline", () => {
    expect(
      INITIAL_RECRUITING_WORKSPACE.auditEvents.filter(
        (event) => event.applicationId === "application-jordan-vp",
      ),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "application.source_history_imported",
          detail: "Resume received from employee referral",
        }),
        expect.objectContaining({
          action: "application.source_history_imported",
          detail: "Contact details verified",
        }),
      ]),
    );
  });

  it("moves one application and records an audit event without changing candidates", () => {
    const result = moveWorkspaceApplication(
      INITIAL_RECRUITING_WORKSPACE,
      {
        applicationId: "application-jordan-vp",
        nextStage: "interview",
      },
      {
        actorId: "local-reviewer",
        actorLabel: "Local reviewer",
        occurredAt: "2026-07-28T12:15:00.000Z",
      },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.snapshot.candidates).toBe(
      INITIAL_RECRUITING_WORKSPACE.candidates,
    );
    expect(
      result.snapshot.applications.find(
        (application) => application.id === "application-jordan-vp",
      )?.stage,
    ).toBe("interview");
    expect(result.snapshot.auditEvents[0]).toMatchObject({
      action: "application.stage_changed",
      applicationId: "application-jordan-vp",
      fromValue: "review",
      toValue: "interview",
    });
  });

  it("requires a reason when a candidate is marked not qualified", () => {
    const result = setWorkspaceDisposition(
      INITIAL_RECRUITING_WORKSPACE,
      {
        applicationId: "application-jordan-vp",
        disposition: "not_qualified",
        reason: " ",
      },
      {
        actorId: "local-reviewer",
        actorLabel: "Local reviewer",
        occurredAt: "2026-07-28T12:15:00.000Z",
      },
    );

    expect(result).toEqual({
      ok: false,
      error:
        "A disposition reason is required when an application is not qualified.",
    });
  });

  it("rejects a disposition reason that would exceed persistence limits", () => {
    const result = setWorkspaceDisposition(
      INITIAL_RECRUITING_WORKSPACE,
      {
        applicationId: "application-jordan-vp",
        disposition: "not_qualified",
        reason: "x".repeat(901),
      },
      {
        actorId: "local-reviewer",
        actorLabel: "Local reviewer",
        occurredAt: "2026-07-28T12:15:00.000Z",
      },
    );

    expect(result).toEqual({
      ok: false,
      error: "Disposition reasons must be 900 characters or fewer.",
    });
  });

  it("adds a synthetic candidate, application, resume record, and audit event once", () => {
    const first = addSyntheticApplicant(
      INITIAL_RECRUITING_WORKSPACE,
      {
        requisitionId: "req-vp-construction",
      },
      {
        actorId: "local-reviewer",
        actorLabel: "Local reviewer",
        occurredAt: "2026-07-28T12:15:00.000Z",
      },
    );

    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.applicationId).toBe("application-sample");
    expect(
      first.snapshot.applications.find(
        (application) => application.id === "application-sample",
      )?.resumeDocument,
    ).toMatchObject({
      filename: "taylor-morgan-synthetic-resume.pdf",
      synthetic: true,
      reviewStatus: "pending",
    });
    expect(first.snapshot.auditEvents[0]?.action).toBe(
      "application.synthetic_intake_created",
    );
    expect(() =>
      recruitingWorkspaceSnapshotSchema.parse(first.snapshot),
    ).not.toThrow();

    const second = addSyntheticApplicant(
      first.snapshot,
      {
        requisitionId: "req-vp-construction",
      },
      {
        actorId: "local-reviewer",
        actorLabel: "Local reviewer",
        occurredAt: "2026-07-28T12:16:00.000Z",
      },
    );

    expect(second).toEqual({
      ok: false,
      error:
        "The Taylor Morgan sample is already in this local workspace. Reset the workspace to add it again.",
    });
  });
});
