import fs from "node:fs";
import path from "node:path";
import type { UIMessage } from "ai";

import {
  getDurableReconnectDisposition,
  getDurableSubmissionId,
  isDurableStartLeaseExpired,
} from "@/lib/ai/durable-chat";

const frontendRoot = path.resolve(__dirname, "../../../../..");
const repoRoot = path.resolve(frontendRoot, "..");

function readFrontend(relativePath: string) {
  return fs.readFileSync(path.join(frontendRoot, relativePath), "utf8");
}

describe("durable AI canary contracts", () => {
  test("the database ledger enforces one turn per client message", () => {
    const migration = fs.readFileSync(
      path.join(
        repoRoot,
        "supabase/migrations/20260722175451_create_durable_ai_turns.sql",
      ),
      "utf8",
    );

    expect(migration).toContain(
      "unique (user_id, session_id, client_message_id)",
    );
    expect(migration).toContain("unique (workflow_run_id)");
    expect(migration).toContain("enable row level security");
  });

  test("a turn is accepted before a workflow starts and duplicates reuse the run", () => {
    const route = readFrontend("src/app/api/durable-ai/chat/route.ts");
    const ledgerInsert = route.indexOf('.from("durable_ai_turns")');
    const workflowStart = route.indexOf("await start(durableAiChatWorkflow");
    const duplicateRun = route.indexOf(
      "const existingRun = getRun(existingTurn.workflow_run_id)",
    );

    expect(ledgerInsert).toBeGreaterThan(-1);
    expect(workflowStart).toBeGreaterThan(ledgerInsert);
    expect(duplicateRun).toBeGreaterThan(ledgerInsert);
    expect(route).toContain('acceptError?.code !== "23505"');
    expect(route).toContain("stream: existingRun.readable");
  });

  test("an accepted turn can safely reclaim an expired start lease", () => {
    const route = readFrontend("src/app/api/durable-ai/chat/route.ts");
    const workflow = readFrontend("src/workflows/durable-ai-chat/workflow.ts");
    const now = Date.parse("2026-07-22T19:00:31.000Z");

    expect(isDurableStartLeaseExpired("2026-07-22T19:00:00.000Z", now)).toBe(
      true,
    );
    expect(isDurableStartLeaseExpired("2026-07-22T19:00:02.000Z", now)).toBe(
      false,
    );
    expect(route).toContain('stage: "workflow-start-reclaimed"');
    expect(route).toContain("const userHistoryId = turnId");
    expect(route).toContain('.is("workflow_run_id", null)');
    expect(workflow).toContain("refusing duplicate run ${workflowRunId}");
  });

  test("the workflow reuses canonical tools and disables action-step retries", () => {
    const workflow = readFrontend("src/workflows/durable-ai-chat/workflow.ts");

    expect(workflow).toContain(
      'import { createStrategistTools } from "@/lib/ai/orchestrator"',
    );
    expect(workflow).toContain(
      'import { createAiAssistantMcpTools } from "@/lib/ai/tools/mcp-tools"',
    );
    expect(workflow).toContain("includeActionTools: true");
    expect(workflow).toContain("generateDurableResponse.maxRetries = 0");
    expect(workflow).toContain("await closeDurableStream()");
    expect(workflow).toContain("await writer.close()");
    expect(workflow).not.toContain("tool({");
  });

  test("a newly started run does not trigger a second reconnect reader", () => {
    const client = readFrontend(
      "src/components/ai-assistant/durable-ai-chat-page.tsx",
    );

    expect(client).toContain(
      "const [shouldResume] = useState(Boolean(initialRunId))",
    );
    expect(client).toContain("resume: shouldResume");
    expect(client).not.toContain("resume: Boolean(activeRunId)");
  });

  test("conversation bootstrap is idempotent under React Strict Mode", () => {
    const client = readFrontend(
      "src/components/ai-assistant/durable-ai-chat-page.tsx",
    );
    const route = readFrontend("src/app/api/durable-ai/conversations/route.ts");

    expect(client).toContain("sessionId: pendingSessionId");
    expect(route).toContain('error.code === "23505"');
    expect(route).toContain('.eq("session_id", sessionId)');
    expect(route).toContain('.eq("user_id", user.id)');
  });

  test("each approval continuation has a stable but distinct idempotency key", () => {
    const firstApproval = {
      id: "assistant-message",
      role: "assistant",
      parts: [
        {
          type: "dynamic-tool",
          toolName: "governedAction",
          toolCallId: "call-1",
          state: "approval-responded",
          input: {},
          approval: { id: "approval-1", approved: true },
        },
      ],
    } as UIMessage;
    const secondApproval = {
      ...firstApproval,
      parts: [
        ...firstApproval.parts,
        {
          type: "dynamic-tool",
          toolName: "governedAction",
          toolCallId: "call-2",
          state: "approval-responded",
          input: {},
          approval: { id: "approval-2", approved: false },
        },
      ],
    } as UIMessage;

    expect(getDurableSubmissionId(firstApproval)).toBe(
      getDurableSubmissionId(firstApproval),
    );
    expect(getDurableSubmissionId(secondApproval)).not.toBe(
      getDurableSubmissionId(firstApproval),
    );
  });

  test("reconnection is user-authorized and exposes the Workflow stream tail", () => {
    const reconnect = readFrontend(
      "src/app/api/durable-ai/chat/[runId]/stream/route.ts",
    );
    const userLookup = reconnect.indexOf('.eq("user_id", user.id)');
    const getWorkflowRun = reconnect.indexOf("const run = getRun(runId)");

    expect(userLookup).toBeGreaterThan(-1);
    expect(getWorkflowRun).toBeGreaterThan(userLookup);
    expect(reconnect).toContain("await readable.getTailIndex()");
    expect(reconnect).toContain('"x-workflow-stream-tail-index"');
  });

  test("a completed run returns no reconnect stream", () => {
    const reconnect = readFrontend(
      "src/app/api/durable-ai/chat/[runId]/stream/route.ts",
    );

    expect(getDurableReconnectDisposition("completed")).toBe("complete");
    expect(getDurableReconnectDisposition("running")).toBe("stream");
    expect(getDurableReconnectDisposition("failed")).toBe("failed");
    expect(reconnect).toContain("status: 204");
    expect(
      readFrontend("src/components/ai-assistant/durable-ai-chat-page.tsx"),
    ).toContain("if (response.status === 204)");
  });

  test("ownership failures and partial persistence recover explicitly", () => {
    const chatRoute = readFrontend("src/app/api/durable-ai/chat/route.ts");
    const messageRoute = readFrontend(
      "src/app/api/durable-ai/messages/[sessionId]/route.ts",
    );
    const workflow = readFrontend("src/workflows/durable-ai-chat/workflow.ts");

    expect(chatRoute).toContain(
      'code: "DURABLE_CONVERSATION_AUTHORIZATION_FAILED"',
    );
    expect(messageRoute).toContain(
      'code: "DURABLE_CONVERSATION_AUTHORIZATION_FAILED"',
    );
    expect(workflow).toContain("await reconcilePersistedResponse({");
    expect(workflow).toContain('status: "completed"');
    expect(workflow).toContain('stage = "persistence-recovery"');
    expect(workflow).toContain("await recordStreamCloseWarning({");
    expect(workflow).toContain('status: "completed-with-warning"');
  });

  test("workflow callbacks bypass both application auth matchers", () => {
    const middleware = readFrontend("src/middleware.ts");
    const proxy = readFrontend("src/proxy.ts");

    expect(middleware).toContain("\\.well-known/workflow/");
    expect(proxy).toContain("\\.well-known/workflow/");
  });

  test("the canary does not replace or import into the current AI page", () => {
    const currentPage = readFrontend("src/app/(main)/ai/page.tsx");
    const canaryPage = readFrontend("src/app/(main)/ai-workflow/page.tsx");

    expect(currentPage).not.toContain("DurableAiChatPage");
    expect(canaryPage).toContain("DurableAiChatPage");
  });
});
