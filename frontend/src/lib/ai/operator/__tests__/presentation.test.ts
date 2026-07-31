import {
  parseAndRenderOperatorMessageForTeams,
  renderOperatorMessageForTeams,
  validateOperatorMessage,
  type OperatorMessage,
} from "../presentation";

const baseMessage: OperatorMessage = {
  operatorId: "owner-comms",
  approvalId: "approval-123",
  title: "Approve Teams message",
  body: "Send the owner-facing change order approval message.",
  priority: "high",
  actions: [
    {
      id: "approve",
      label: "Approve",
      kind: "submit",
      value: "approve",
      style: "positive",
      affordance: "button",
      priority: 90,
    },
    {
      id: "revise",
      label: "Revise",
      kind: "openUrl",
      url: "https://projects.alleatogroup.com/ai-assistant",
      style: "secondary",
      affordance: "url",
      priority: 10,
    },
  ],
  channel: {
    preferred: "teams",
    capabilities: {
      affordances: ["button", "url"],
      maxActions: 4,
    },
    metadata: {
      renderer: "teams-adaptive-card",
    },
  },
  metadata: {},
};

describe("operator presentation", () => {
  it("returns field-level validation errors for invalid operator payloads", () => {
    const result = validateOperatorMessage({
      operatorId: "",
      approvalId: "approval-123",
      title: "",
      body: "Missing actions.",
      actions: [],
    });

    expect(result).toMatchObject({
      success: false,
      errorCode: "INVALID_OPERATOR_MESSAGE",
      fieldErrors: {
        operatorId: expect.arrayContaining([expect.any(String)]),
        title: expect.arrayContaining([expect.any(String)]),
        actions: expect.arrayContaining([expect.any(String)]),
      },
    });
  });

  it("renders a deterministic Teams Adaptive Card payload", () => {
    const rendered = renderOperatorMessageForTeams(baseMessage);

    expect(rendered.card).toMatchSnapshot();
    expect(rendered.metadata).toEqual({
      operatorId: "owner-comms",
      approvalId: "approval-123",
      channel: "teams",
      requestedChannel: "teams",
      priority: "high",
      renderedActionIds: ["approve", "revise"],
      droppedActions: [],
      capabilityMetadata: {
        renderer: "teams-adaptive-card",
      },
    });
  });

  it("drops unsupported affordances with inspectable metadata", () => {
    const rendered = renderOperatorMessageForTeams({
      ...baseMessage,
      actions: [
        ...baseMessage.actions,
        {
          id: "copy",
          label: "Copy text",
          kind: "copy",
          value: "Copied",
          style: "secondary",
          affordance: "copy",
          priority: 99,
        },
      ],
      channel: {
        preferred: "teams",
        capabilities: {
          affordances: ["button"],
          maxActions: 1,
        },
        metadata: { renderer: "limited-teams" },
      },
    });

    expect(rendered.metadata.renderedActionIds).toEqual(["approve"]);
    expect(rendered.metadata.droppedActions).toEqual([
      {
        actionId: "copy",
        label: "Copy text",
        reason: "unsupported_affordance",
        affordance: "copy",
        channel: "teams",
      },
      {
        actionId: "revise",
        label: "Revise",
        reason: "unsupported_affordance",
        affordance: "url",
        channel: "teams",
      },
    ]);
  });

  it("exposes parse-and-render for API callers without throwing on validation failure", () => {
    expect(parseAndRenderOperatorMessageForTeams({ title: "Missing fields" })).toMatchObject({
      success: false,
      errorCode: "INVALID_OPERATOR_MESSAGE",
    });
    expect(parseAndRenderOperatorMessageForTeams(baseMessage)).toMatchObject({
      card: { type: "AdaptiveCard" },
      metadata: { renderedActionIds: ["approve", "revise"] },
    });
  });
});
