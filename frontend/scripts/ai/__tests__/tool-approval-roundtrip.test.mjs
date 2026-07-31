import assert from "node:assert/strict";
import test from "node:test";
import {
  AbstractChat,
  generateText,
  InvalidToolApprovalSignatureError,
  ToolCallNotFoundForApprovalError,
  tool,
} from "ai";
import { MockLanguageModelV3 } from "ai/test";
import { z } from "zod";
import approvalPolicyModule from "../../../src/lib/ai/tool-approval-policy.ts";

const { createAssistantToolApprovalPolicy, resolveToolApprovalSecret } =
  approvalPolicyModule;

const usage = {
  inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 5, text: 5, reasoning: 0 },
};

function modelWithToolCall() {
  return new MockLanguageModelV3({
    doGenerate: [
      {
        finishReason: "tool-calls",
        usage,
        content: [
          {
            type: "tool-call",
            toolCallId: "call-create-task-1",
            toolName: "createTask",
            input: JSON.stringify({
              projectId: 67,
              name: "Confirm subcontractor mobilization",
              confirmed: true,
            }),
          },
        ],
        warnings: [],
      },
      {
        finishReason: "stop",
        usage,
        content: [{ type: "text", text: "Task created." }],
        warnings: [],
      },
    ],
  });
}

function executionRecorder() {
  const calls = [];
  return {
    calls,
    execute: async (input) => {
      calls.push(input);
      return { success: true, input };
    },
  };
}

function buildTools(execute) {
  const createTask = tool({
    description: "Create a project task",
    inputSchema: z.object({
      projectId: z.number(),
      name: z.string(),
      confirmed: z.boolean(),
    }),
    execute,
  });
  return { createTask, createTaskAlias: createTask };
}

class ApprovalTestChat extends AbstractChat {
  constructor(messages) {
    const state = {
      status: "ready",
      error: undefined,
      messages,
      pushMessage(message) {
        this.messages.push(message);
      },
      popMessage() {
        this.messages.pop();
      },
      replaceMessage(index, message) {
        this.messages[index] = message;
      },
      snapshot(value) {
        return structuredClone(value);
      },
    };
    super({ id: "approval-test-chat", state });
  }
}

async function issueSignedApproval(execute) {
  const messages = [{ role: "user", content: "Create the mobilization task." }];
  const model = modelWithToolCall();
  const secret = "approval-secret-with-at-least-32-bytes";
  const tools = buildTools(execute);
  const registry = [
    {
      name: "createTask",
      description: "Create a project task",
      owningAdapter: "approval-roundtrip-test",
      inputSchemaName: "createTask.input",
      outputSchemaName: "createTask.output",
      failureShape: "structured_error",
      metadata: {},
      owner: "ai_assistant",
      category: "workflow",
      capabilities: ["write"],
      workflows: ["ai_assistant_chat"],
      actorModes: ["user_delegated"],
      requiresProjectScope: false,
      requiresWritePermission: true,
      requiresDeliveryPermission: false,
      evidencePolicy: {
        sourceBearing: false,
        requiresSourceRefs: false,
        ledgerRequired: true,
      },
      factory: null,
    },
  ];
  const toolApproval = createAssistantToolApprovalPolicy(registry);
  const approvalSecret = resolveToolApprovalSecret({
    actionToolsEnabled: true,
    env: { TOOL_APPROVAL_SECRET: secret },
  });
  const result = await generateText({
    model,
    messages,
    tools,
    toolApproval,
    experimental_toolApprovalSecret: approvalSecret,
  });
  const request = result.content.find(
    (part) => part.type === "tool-approval-request",
  );

  assert.ok(request, "expected a signed tool approval request");
  return { messages, model, tools, secret, toolApproval, result, request };
}

test("signed approval executes the exact call once and resumes", async () => {
  const recorder = executionRecorder();
  const issued = await issueSignedApproval(recorder.execute);

  assert.equal(recorder.calls.length, 0);

  const resumed = await generateText({
    model: issued.model,
    messages: [
      ...issued.messages,
      ...issued.result.responseMessages,
      {
        role: "tool",
        content: [
          {
            type: "tool-approval-response",
            approvalId: issued.request.approvalId,
            approved: true,
            reason: "User approved the task creation.",
          },
        ],
      },
    ],
    tools: issued.tools,
    toolApproval: issued.toolApproval,
    experimental_toolApprovalSecret: issued.secret,
  });

  assert.equal(recorder.calls.length, 1);
  assert.deepEqual(recorder.calls[0], {
    projectId: 67,
    name: "Confirm subcontractor mobilization",
    confirmed: true,
  });
  assert.equal(resumed.text, "Task created.");
});

test("denied approval never executes the tool", async () => {
  const recorder = executionRecorder();
  const issued = await issueSignedApproval(recorder.execute);

  await generateText({
    model: issued.model,
    messages: [
      ...issued.messages,
      ...issued.result.responseMessages,
      {
        role: "tool",
        content: [
          {
            type: "tool-approval-response",
            approvalId: issued.request.approvalId,
            approved: false,
            reason: "User denied the task creation.",
          },
        ],
      },
    ],
    tools: issued.tools,
    toolApproval: issued.toolApproval,
    experimental_toolApprovalSecret: issued.secret,
  });

  assert.equal(recorder.calls.length, 0);
});

test("tampered signed input fails closed", async () => {
  const recorder = executionRecorder();
  const issued = await issueSignedApproval(recorder.execute);
  const tamperedMessages = structuredClone(issued.result.responseMessages);
  const assistantMessage = tamperedMessages.find(
    (message) => message.role === "assistant",
  );
  assert.ok(assistantMessage && Array.isArray(assistantMessage.content));
  const toolCall = assistantMessage.content.find(
    (part) => part.type === "tool-call",
  );
  assert.ok(toolCall);
  toolCall.input = { ...toolCall.input, name: "Tampered task title" };

  await assert.rejects(
    generateText({
      model: issued.model,
      messages: [
        ...issued.messages,
        ...tamperedMessages,
        {
          role: "tool",
          content: [
            {
              type: "tool-approval-response",
              approvalId: issued.request.approvalId,
              approved: true,
            },
          ],
        },
      ],
      tools: issued.tools,
      toolApproval: issued.toolApproval,
      experimental_toolApprovalSecret: issued.secret,
    }),
    (error) => error instanceof InvalidToolApprovalSignatureError,
  );
  assert.equal(recorder.calls.length, 0);
});

test("tampered signed tool-call ID fails closed", async () => {
  const recorder = executionRecorder();
  const issued = await issueSignedApproval(recorder.execute);
  const tamperedMessages = structuredClone(issued.result.responseMessages);
  const assistantMessage = tamperedMessages.find(
    (message) => message.role === "assistant",
  );
  assert.ok(assistantMessage && Array.isArray(assistantMessage.content));
  const toolCall = assistantMessage.content.find(
    (part) => part.type === "tool-call",
  );
  assert.ok(toolCall);
  toolCall.toolCallId = "call-create-task-tampered";

  await assert.rejects(
    generateText({
      model: issued.model,
      messages: [
        ...issued.messages,
        ...tamperedMessages,
        {
          role: "tool",
          content: [
            {
              type: "tool-approval-response",
              approvalId: issued.request.approvalId,
              approved: true,
            },
          ],
        },
      ],
      tools: issued.tools,
      toolApproval: issued.toolApproval,
      experimental_toolApprovalSecret: issued.secret,
    }),
    (error) =>
      error instanceof InvalidToolApprovalSignatureError ||
      error instanceof ToolCallNotFoundForApprovalError,
  );
  assert.equal(recorder.calls.length, 0);
});

test("tampered signed tool name fails closed", async () => {
  const recorder = executionRecorder();
  const issued = await issueSignedApproval(recorder.execute);
  const tamperedMessages = structuredClone(issued.result.responseMessages);
  const assistantMessage = tamperedMessages.find(
    (message) => message.role === "assistant",
  );
  assert.ok(assistantMessage && Array.isArray(assistantMessage.content));
  const toolCall = assistantMessage.content.find(
    (part) => part.type === "tool-call",
  );
  assert.ok(toolCall);
  toolCall.toolName = "createTaskAlias";

  await assert.rejects(
    generateText({
      model: issued.model,
      messages: [
        ...issued.messages,
        ...tamperedMessages,
        {
          role: "tool",
          content: [
            {
              type: "tool-approval-response",
              approvalId: issued.request.approvalId,
              approved: true,
            },
          ],
        },
      ],
      tools: issued.tools,
      toolApproval: issued.toolApproval,
      experimental_toolApprovalSecret: issued.secret,
    }),
    (error) => error instanceof InvalidToolApprovalSignatureError,
  );
  assert.equal(recorder.calls.length, 0);
});

test("UI approval response preserves the server-issued signature", async () => {
  const chat = new ApprovalTestChat([
    {
      id: "assistant-1",
      role: "assistant",
      parts: [
        {
          type: "tool-createTask",
          toolCallId: "call-create-task-1",
          state: "approval-requested",
          input: { projectId: 67, name: "Signed task", confirmed: true },
          approval: {
            id: "approval-create-task-1",
            signature: "server-issued-signature",
          },
        },
      ],
    },
  ]);

  await chat.addToolApprovalResponse({
    id: "approval-create-task-1",
    approved: true,
  });

  const [part] = chat.messages[0].parts;
  assert.equal(part.state, "approval-responded");
  assert.equal(part.approval.approved, true);
  assert.equal(part.approval.signature, "server-issued-signature");
});
