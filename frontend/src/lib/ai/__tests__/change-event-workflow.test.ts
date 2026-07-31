import {
  applyChangeEventWorkflowDraftEdits,
  buildChangeEventRelatedEvidence,
  buildChangeEventWorkflowDraft,
  buildChangeEventWorkflowMetadata,
  isChangeEventFinalPreviewRequest,
} from "../change-event-workflow";

describe("change event workflow draft", () => {
  it("infers a guided draft from a field-style owner change prompt", () => {
    const draft = buildChangeEventWorkflowDraft({
      selectedProjectId: 25125,
      prompt:
        "Create a change event because the owner requested relocated plumbing in the lobby. We have photos and drawings. It is a $12,500 cost impact with no schedule impact.",
    });

    expect(draft.projectId).toBe(25125);
    expect(draft.cause).toBe("Owner Requested");
    expect(draft.scope).toBe("Out of Scope");
    expect(draft.costImpact).toBe("$12,500");
    expect(draft.scheduleImpact).toBe("No schedule impact expected");
    expect(draft.supportingDocs).toEqual(["Photos", "Drawings"]);
    expect(draft.readyForPreview).toBe(true);
    expect(draft.confirmPrompt).toContain("confirmed=false");
  });

  it("keeps missing workflow state explicit for vague change-event requests", () => {
    const draft = buildChangeEventWorkflowDraft({
      prompt: "Can you help me create a new change event?",
    });

    expect(draft.projectId).toBeNull();
    expect(draft.narrative).toBeNull();
    expect(draft.title).toBeNull();
    expect(draft.readyForPreview).toBe(false);
    expect(draft.nextQuestion).toBe("What project is this change event for?");
    expect(draft.checklist.find((item) => item.key === "project")?.status).toBe("active");
    expect(draft.missingRisks).toContain("Cost exposure is not documented.");
  });

  it("merges follow-up answers into the prior live draft", () => {
    const firstDraft = buildChangeEventWorkflowDraft({
      selectedProjectId: 25125,
      prompt:
        "Create a change event because the owner requested relocated plumbing in the lobby.",
    });

    const updated = buildChangeEventWorkflowDraft({
      selectedProjectId: 25125,
      previousDraft: firstDraft,
      prompt: "It is a $12,500 cost impact with no schedule impact. Owner was notified.",
    });

    expect(updated.title).toBe(firstDraft.title);
    expect(updated.cause).toBe("Owner Requested");
    expect(updated.costImpact).toBe("$12,500");
    expect(updated.scheduleImpact).toBe("No schedule impact expected");
    expect(updated.ownerNotified).toBe("yes");
    expect(updated.readyForPreview).toBe(true);
    expect(updated.narrative).toContain("Follow-up:");
  });

  it("uses project context from a project-picker follow-up", () => {
    const draft = buildChangeEventWorkflowDraft({
      previousDraft: buildChangeEventWorkflowDraft({
        prompt: "Help me create a change event.",
      }),
      prompt: [
        "Use project 25125 - Allisonville for this change event.",
        "Project ID: 25125",
        "Project Name: Allisonville",
      ].join("\n"),
    });

    expect(draft.projectId).toBe(25125);
    expect(draft.projectName).toBe("Allisonville");
    expect(draft.narrative).toBeNull();
    expect(draft.title).toBeNull();
    expect(draft.readyForPreview).toBe(false);
    expect(draft.nextQuestion).toContain("Tell me what happened");
  });

  it("builds persisted metadata with readiness and write ownership", () => {
    const metadata = buildChangeEventWorkflowMetadata({
      updatedAt: "2026-07-06T05:00:00.000Z",
      selectedProjectId: 25125,
      prompt: "Can you help me create a new change event?",
    });

    expect(metadata).toMatchObject({
      version: 1,
      workflowKey: "change_event",
      widgetType: "change_event_workflow",
      expectedNativeTool: "createChangeEvent",
      writeOwner: "createChangeEvent",
      updatedAt: "2026-07-06T05:00:00.000Z",
      readiness: {
        readyForPreview: false,
        activeChecklistKey: "event_understood",
        evidenceCount: 0,
        evidenceSourcePath: "none",
      },
    });
    expect(metadata.readiness.missingChecklistKeys).toContain("cost_impact");
  });

  it("asks for the event narrative before extracting workflow fields", () => {
    const draft = buildChangeEventWorkflowDraft({
      selectedProjectId: 25125,
      selectedProjectName: "Allisonville",
      prompt: "Help me create a change event",
    });

    expect(draft.projectId).toBe(25125);
    expect(draft.projectName).toBe("Allisonville");
    expect(draft.narrative).toBeNull();
    expect(draft.cause).toBeNull();
    expect(draft.readyForPreview).toBe(false);
    expect(draft.nextQuestion).toBe(
      "Tell me what happened. Do not worry about organizing it, I will structure it into a clean change event draft.",
    );
  });

  it("attaches retrieval-backed related evidence to workflow metadata", () => {
    const relatedEvidence = buildChangeEventRelatedEvidence({
      semanticVectorResults: {
        results: [
          {
            content:
              "Owner coordination meeting discussed relocating the lobby plumbing and tracking pricing as a change event.",
            sourceTable: "meeting_transcript",
            recordId: "meeting-1",
            finalScore: 0.82,
            createdAt: "2026-07-01T12:00:00.000Z",
            metadata: { meeting_title: "Owner coordination meeting" },
          },
        ],
      },
    });

    const metadata = buildChangeEventWorkflowMetadata({
      updatedAt: "2026-07-06T05:00:00.000Z",
      selectedProjectId: 25125,
      prompt: "Create a change event because the owner requested relocated plumbing.",
      relatedEvidence,
    });

    expect(metadata.readiness.evidenceCount).toBe(1);
    expect(metadata.readiness.evidenceSourcePath).toBe("semantic_vector_search");
    expect(metadata.draft.relatedEvidence[0]).toMatchObject({
      title: "Owner coordination meeting",
      sourceType: "meeting",
      sourceLabel: "Meeting",
      confidence: "high",
      recordId: "meeting-1",
    });
    expect(metadata.draft.checklist.find((item) => item.key === "related_records")?.status).toBe(
      "complete",
    );
    expect(metadata.draft.confirmPrompt).toContain("Meeting: Owner coordination meeting");
  });

  it("lets final preview requests continue to the write tool loop", () => {
    expect(
      isChangeEventFinalPreviewRequest(
        "Prepare the final createChangeEvent preview from this live intake draft.",
      ),
    ).toBe(true);
    expect(
      isChangeEventFinalPreviewRequest(
        "Prepare the final Change Event create preview from this draft.",
      ),
    ).toBe(true);
    expect(
      isChangeEventFinalPreviewRequest(
        "Run createChangeEvent now with confirmed=true using exactly these preview values.",
      ),
    ).toBe(true);
    expect(isChangeEventFinalPreviewRequest("Create a change event for owner work")).toBe(
      false,
    );
  });

  it("applies artifact field edits and recomputes readiness", () => {
    const metadata = buildChangeEventWorkflowMetadata({
      updatedAt: "2026-07-06T05:00:00.000Z",
      selectedProjectId: 25125,
      prompt: "Help me create a change event",
    });

    const updated = applyChangeEventWorkflowDraftEdits({
      workflow: metadata,
      updatedAt: "2026-07-06T06:00:00.000Z",
      edits: {
        title: "Owner requested restroom relocation",
        narrative: "Owner requested relocating the restroom plumbing after framing.",
        cause: "Owner Requested",
        scope: "Out of Scope",
        costImpact: "$18,000",
        scheduleImpact: "No schedule impact expected",
      },
    });

    expect(updated.updatedAt).toBe("2026-07-06T06:00:00.000Z");
    expect(updated.draft.title).toBe("Owner requested restroom relocation");
    expect(updated.draft.cause).toBe("Owner Requested");
    expect(updated.draft.readyForPreview).toBe(true);
    expect(updated.readiness.readyForPreview).toBe(true);
    expect(updated.readiness.missingChecklistKeys).not.toContain("review_create");
    expect(updated.draft.confirmPrompt).toContain("Project ID: 25125");
    expect(updated.draft.confirmPrompt).toContain("confirmed=false");
  });

  it("applies artifact project edits and resolves project readiness", () => {
    const metadata = buildChangeEventWorkflowMetadata({
      updatedAt: "2026-07-06T05:00:00.000Z",
      prompt:
        "Create a change event because the owner requested restroom relocation after framing. Cost is about $18,000 with no schedule impact.",
    });

    expect(metadata.draft.projectId).toBeNull();
    expect(metadata.draft.readyForPreview).toBe(false);
    expect(metadata.readiness.missingChecklistKeys).toContain("project");

    const updated = applyChangeEventWorkflowDraftEdits({
      workflow: metadata,
      updatedAt: "2026-07-06T06:00:00.000Z",
      edits: {
        projectId: 760,
        projectName: "Exol Wilmer",
      },
    });

    expect(updated.draft.projectId).toBe(760);
    expect(updated.draft.projectName).toBe("Exol Wilmer");
    expect(updated.draft.readyForPreview).toBe(true);
    expect(updated.readiness.readyForPreview).toBe(true);
    expect(updated.readiness.missingChecklistKeys).not.toContain("project");
    expect(updated.draft.checklist.find((item) => item.key === "project")?.status).toBe(
      "complete",
    );
    expect(updated.draft.confirmPrompt).toContain("Project ID: 760");
  });
});
