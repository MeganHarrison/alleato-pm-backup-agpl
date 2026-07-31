jest.mock("server-only", () => ({}));

const { mapRows } = require("../route") as typeof import("../route");

describe("admin ai assistant debug projection", () => {
  it("surfaces persisted change-event workflow readiness", () => {
    const rows = mapRows(
      [
        {
          id: "assistant-1",
          session_id: "session-1",
          user_id: "user-1",
          role: "assistant",
          content: "I updated the change-event draft.",
          sources: [],
          created_at: "2026-07-06T05:00:00.000Z",
          metadata: {
            provider_path: "deterministic-change-event-workflow",
            model: null,
            retrieval_plan: {
              intent: "change_event_write",
              reason: "change_event_workflow_intake",
            },
            tool_trace: [
              {
                tool: "changeEventWorkflowState",
                status: "success",
                output: {
                  readyForPreview: false,
                  expectedNativeTool: "createChangeEvent",
                },
              },
            ],
            response_quality: { score: 80, reasons: [] },
            source_debug: { orchestrator: "change-event-workflow-intake" },
            change_event_workflow: {
              workflowKey: "change_event",
              expectedNativeTool: "createChangeEvent",
              readiness: {
                readyForPreview: false,
                activeChecklistKey: "cost_impact",
                missingChecklistKeys: ["cost_impact", "schedule_impact"],
              },
            },
          },
        },
      ],
      [
        {
          session_id: "session-1",
          title: "Create change event",
          last_message_at: "2026-07-06T05:00:00.000Z",
        },
      ],
      [
        {
          id: "user-1",
          session_id: "session-1",
          user_id: "user-1",
          role: "user",
          content: "Create a change event",
          sources: [],
          metadata: null,
          created_at: "2026-07-06T04:59:59.000Z",
        },
      ],
    );

    expect(rows[0]?.expectedNativeTool).toBe("createChangeEvent");
    expect(rows[0]?.changeEventWorkflow).toMatchObject({
      workflowKey: "change_event",
      expectedNativeTool: "createChangeEvent",
      readiness: {
        readyForPreview: false,
        activeChecklistKey: "cost_impact",
      },
    });
  });
});
