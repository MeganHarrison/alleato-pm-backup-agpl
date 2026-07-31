import {
  buildAssistantReviewPayload,
  deriveReviewOutcome,
  replyVerdict,
  statusToVerdict,
  verdictToStatus,
  type AssistantReviewPayloadInput,
  type DecisionStatusMap,
} from "./ai-review-payload";

function input(
  overrides: Partial<AssistantReviewPayloadInput> = {},
): AssistantReviewPayloadInput {
  const finalStatus: DecisionStatusMap = {
    action: "confirmed",
    priority: "confirmed",
    project: "confirmed",
    category: "confirmed",
    ...(overrides.finalStatus ?? {}),
  };
  return {
    action: "delegate",
    priority: "normal",
    category: "Meeting Notes",
    projectId: null,
    replyFeedback: null,
    draftBody: "",
    ...overrides,
    finalStatus,
  };
}

describe("statusToVerdict / verdictToStatus", () => {
  it("maps decision status to the fieldFeedback verdict", () => {
    expect(statusToVerdict("confirmed")).toBe("correct");
    expect(statusToVerdict("corrected")).toBe("incorrect");
    expect(statusToVerdict("unreviewed")).toBe("unreviewed");
  });

  it("maps verdicts back to decision status (round-trips)", () => {
    expect(verdictToStatus("correct")).toBe("confirmed");
    expect(verdictToStatus("incorrect")).toBe("corrected");
    expect(verdictToStatus("unreviewed")).toBe("unreviewed");
    expect(verdictToStatus(undefined)).toBe("unreviewed");
  });
});

describe("deriveReviewOutcome", () => {
  it("uses draft outcomes only when a draft exists", () => {
    expect(deriveReviewOutcome("reply", "good", true)).toBe("draft_copied");
    expect(deriveReviewOutcome("reply", "edit", true)).toBe("draft_edited");
    // "good" with no draft falls back to the action-derived outcome.
    expect(deriveReviewOutcome("reply", "good", false)).toBe("skipped");
  });

  it("derives the outcome from the action when the reply is skipped/absent", () => {
    expect(deriveReviewOutcome("delegate", "skip", false)).toBe("delegated");
    expect(deriveReviewOutcome("watch", null, false)).toBe("watched");
    expect(deriveReviewOutcome("ignore", null, false)).toBe("marked_no_action");
    expect(deriveReviewOutcome("reply", null, false)).toBe("skipped");
  });
});

describe("replyVerdict", () => {
  it("maps reply feedback to a verdict", () => {
    expect(replyVerdict("good")).toBe("correct");
    expect(replyVerdict("edit")).toBe("correct");
    expect(replyVerdict("skip")).toBe("incorrect");
    expect(replyVerdict("regen")).toBe("unreviewed");
    expect(replyVerdict(null)).toBe("unreviewed");
  });
});

describe("buildAssistantReviewPayload — projectAssignment omission", () => {
  it("OMITS projectAssignment when the project was confirmed (no-op save must not erase prior feedback)", () => {
    const payload = buildAssistantReviewPayload(
      input({ finalStatus: { project: "confirmed" } as DecisionStatusMap }),
    );
    expect(payload).not.toHaveProperty("projectAssignment");
    // The confirm is still recorded as a verdict.
    expect(payload.fieldFeedback.project).toBe("correct");
  });

  it("OMITS projectAssignment when the project is unreviewed", () => {
    const payload = buildAssistantReviewPayload(
      input({ finalStatus: { project: "unreviewed" } as DecisionStatusMap }),
    );
    expect(payload).not.toHaveProperty("projectAssignment");
    expect(payload.fieldFeedback.project).toBe("unreviewed");
  });

  it("INCLUDES projectAssignment as a correction when the project was changed", () => {
    const payload = buildAssistantReviewPayload(
      input({
        projectId: 42,
        finalStatus: { project: "corrected" } as DecisionStatusMap,
      }),
    );
    expect(payload.projectAssignment).toEqual({
      status: "incorrect",
      correctedProjectId: 42,
      reasonSignals: ["existing_project_context"],
      reasonNote: null,
    });
    expect(payload.fieldFeedback.project).toBe("incorrect");
  });
});

describe("buildAssistantReviewPayload — field mapping", () => {
  it("maps each decision status to its verdict and normalizes category/draft", () => {
    const payload = buildAssistantReviewPayload(
      input({
        action: "reply",
        priority: "urgent",
        category: "  Accounting  ",
        replyFeedback: "good",
        draftBody: "  Hi there  ",
        finalStatus: {
          action: "confirmed",
          priority: "corrected",
          project: "confirmed",
          category: "corrected",
        },
      }),
    );

    expect(payload.assistantAction).toBe("reply");
    expect(payload.assistantPriority).toBe("urgent");
    expect(payload.assistantCategory).toBe("Accounting"); // trimmed
    expect(payload.draftBody).toBe("Hi there"); // trimmed
    expect(payload.reviewOutcome).toBe("draft_copied"); // good + draft present
    expect(payload.reviewerNote).toBeNull();
    expect(payload.fieldFeedback).toEqual({
      action: "correct",
      priority: "incorrect",
      category: "incorrect",
      project: "correct",
      draft: "correct",
    });
  });

  it("nulls an empty category and an empty draft", () => {
    const payload = buildAssistantReviewPayload(
      input({ category: "   ", draftBody: "   " }),
    );
    expect(payload.assistantCategory).toBeNull();
    expect(payload.draftBody).toBeNull();
  });
});
