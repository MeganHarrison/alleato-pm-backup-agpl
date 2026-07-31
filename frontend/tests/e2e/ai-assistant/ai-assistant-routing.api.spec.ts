import { expect, test, type APIRequestContext } from "@playwright/test";
import { join } from "node:path";

import { createAuthenticatedRequestContext } from "../../helpers/api-auth";

const storageStatePath = join(__dirname, "../..", ".auth/user.json");
const appUrl =
  process.env.BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

type ChatRunReport = {
  content: string;
  metadata: Record<string, unknown>;
  sessionId: string;
};

type ToolTrace = {
  tool?: unknown;
  input?: unknown;
  output?: unknown;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function extractTextFromUiMessageStream(streamText: string): string {
  const chunks: string[] = [];

  for (const line of streamText.split(/\n/).filter(Boolean)) {
    const payload = line.startsWith("data: ") ? line.slice(6) : line;
    try {
      const event = JSON.parse(payload);
      if (event?.type === "text-delta" && typeof event.delta === "string") {
        chunks.push(event.delta);
      }
    } catch {
      // Ignore status chunks and malformed stream control frames.
    }
  }

  return chunks.join("");
}

function toolTrace(metadata: Record<string, unknown>): ToolTrace[] {
  return Array.isArray(metadata.tool_trace)
    ? metadata.tool_trace.filter(
        (trace): trace is ToolTrace => Boolean(trace) && typeof trace === "object",
      )
    : [];
}

function toolNames(metadata: Record<string, unknown>): string[] {
  return toolTrace(metadata)
    .map((trace) => trace.tool)
    .filter((tool): tool is string => typeof tool === "string");
}

function expectIntentPlanner(
  metadata: Record<string, unknown>,
  expectedIntents: string[],
): void {
  const plannerTrace = toolTrace(metadata).find((trace) => trace.tool === "intentPlanner");
  expect(plannerTrace, "assistant must plan intent before routing").toBeTruthy();

  const output = asRecord(plannerTrace?.output);
  expect(expectedIntents).toContain(output.intent);
  expect(output.responseMode).toEqual(expect.any(String));
  expect(output.rationale).toEqual(expect.any(String));
}

async function createConversation(apiContext: APIRequestContext, title: string): Promise<string> {
  const response = await apiContext.post("/api/ai-assistant/conversations", {
    data: { title },
  });
  expect([200, 201]).toContain(response.status());

  const body = await response.json();
  const sessionId = body.session_id ?? body.id ?? body.conversation?.session_id;
  expect(sessionId).toEqual(expect.any(String));
  return sessionId;
}

async function runChatPrompt(
  apiContext: APIRequestContext,
  label: string,
  prompt: string,
): Promise<ChatRunReport> {
  const sessionId = await createConversation(apiContext, `routing-${label}-${Date.now()}`);
  const response = await apiContext.post("/api/ai-assistant/chat", {
    data: {
      id: sessionId,
      messages: [
        {
          id: `${label}-user`,
          role: "user",
          parts: [{ type: "text", text: prompt }],
        },
      ],
      selectedModel: "openai/gpt-5.4",
    },
    timeout: 180_000,
  });
  expect(response.status()).toBe(200);

  const streamText = await response.text();
  const streamedContent = extractTextFromUiMessageStream(streamText);
  expect(streamedContent.length).toBeGreaterThan(100);

  const messagesResponse = await apiContext.get(`/api/ai-assistant/messages/${sessionId}`);
  expect(messagesResponse.status()).toBe(200);
  const messagesBody = await messagesResponse.json();
  const messages = Array.isArray(messagesBody.messages) ? messagesBody.messages : [];
  const assistantMessage = [...messages].reverse().find((message) => message.role === "assistant");
  expect(assistantMessage?.content).toEqual(streamedContent);

  return {
    content: assistantMessage.content,
    metadata: assistantMessage.metadata ?? {},
    sessionId,
  };
}

test.describe("AI assistant intent and tool routing", () => {
  test.describe.configure({ mode: "serial" });

  let apiContext: APIRequestContext;

  test.beforeAll(async ({ playwright }) => {
    apiContext = await createAuthenticatedRequestContext(
      playwright,
      storageStatePath,
      appUrl,
    );
  });

  test.afterAll(async () => {
    await apiContext.dispose();
  });

  test("routes RFI creation requests through preview-only action tooling", async () => {
    const report = await runChatPrompt(
      apiContext,
      "rfi-preview",
      "I need to create an RFI for Westfield about delayed electrical rough-in. What info do you need, and can you draft the action safely?",
    );

    expect(report.content).toContain("Preview Only - No RFI Was Created");
    expect(report.content).toContain("Westfield Collective (#43)");
    expectIntentPlanner(report.metadata, [
      "change_management_review",
      "implementation_planning",
    ]);
    expect(toolNames(report.metadata)).toContain("createRFI");
    expect(toolNames(report.metadata)).toContain("rfiActionIntentRouter");
    expect(asRecord(report.metadata.provider_decision).providerPath).toEqual(
      expect.any(String),
    );

    const createRfiTrace = toolTrace(report.metadata).find((trace) => trace.tool === "createRFI");
    expect(createRfiTrace?.input).toMatchObject({
      projectId: 43,
      confirmed: false,
    });
    const createRfiOutput = asRecord(createRfiTrace?.output);
    const preview = asRecord(createRfiOutput.preview);
    expect(asRecord(preview.fields)).toMatchObject({
      project_id: 43,
      status: "open",
      subject: "RFI - Delayed Electrical Rough-in",
    });
  });

  test("routes Teams source questions as source lookup instead of project briefing", async () => {
    const report = await runChatPrompt(
      apiContext,
      "source-lookup",
      "What did Brandon say about JobPlanner in Teams? I need the actual source context, not a project status report.",
    );

    expect(report.content).toContain("I treated this as a source lookup");
    expect(report.content).toContain("Teams DM Conversation");
    expect(report.content).not.toContain("**Hard Facts**");
    expectIntentPlanner(report.metadata, ["source_lookup"]);
    expect(toolNames(report.metadata)).toContain("semanticSearch");
    expect(toolNames(report.metadata)).toContain("sourceLookupIntentRouter");
    expect(asRecord(report.metadata.response_quality).sourceQuality).toBe("high");
  });

  test("answers executive briefing metadata follow-ups without asking for a project", async () => {
    const report = await runChatPrompt(
      apiContext,
      "briefing-metadata",
      "When was this regenerated?",
    );

    expect(report.content).toContain("daily operating brief");
    expect(report.content).toContain("daily_recaps.recap_kind=executive_briefing");
    expect(report.content).not.toContain("Which project?");
    expect(report.content).not.toContain("give me the project name");
    expect(toolNames(report.metadata)).toContain("executiveBriefingMetadataLookup");
  });

  test("answers personal task prompts from task sources instead of inferred reconstruction", async () => {
    const report = await runChatPrompt(
      apiContext,
      "my-tasks",
      "What are my tasks?",
    );

    expect(report.content).toContain("Sources Checked");
    expect(report.content).toContain("tasks.assignee_person_id");
    expect(report.content).not.toContain("likely current tasks");
    expect(report.content).not.toContain("pretty good reconstruction");
    expect(toolNames(report.metadata)).toContain("getMyTasks");
  });

  test("returns a source-grounded Westfield briefing without streaming tool fallback", async () => {
    const report = await runChatPrompt(
      apiContext,
      "westfield-briefing",
      "Give me a current executive project update for Westfield, including hard facts, open risks, and recommended next actions.",
    );

    const names = toolNames(report.metadata);
    expect(report.content).toContain("**Hard Facts**");
    expect(report.content).toContain("Westfield Collective");
    expectIntentPlanner(report.metadata, ["latest_status", "risk_review"]);
    expect(names).toContain("serverBusinessContextPreflight");
    expect(names).toContain("getProjectBriefingSnapshot");
    expect(names).toContain("semanticSearch");
    expect(names).not.toContain("streamTextError");
    expect(names).not.toContain("noToolRetry");
    expect(asRecord(report.metadata.response_quality).sourceQuality).toBe("high");
  });
});
