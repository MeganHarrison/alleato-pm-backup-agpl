import fs from "node:fs";
import path from "node:path";

describe("AI assistant tool approval seam", () => {
  it("wires the registry policy and signed approval secret into streamText", () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, "..", "handler-v2.ts"),
      "utf8",
    );

    expect(source).toContain("parseAiAssistantSurface(routeAssistantSurface)");
    expect(source).toContain("includeActionTools: actionToolsEnabled");
    expect(source).toContain("createAssistantToolApprovalPolicy(");
    expect(source).toContain(
      "resolveToolApprovalSecret({ actionToolsEnabled })",
    );
    expect(source).toContain("toolApproval,");
    expect(source).toContain("experimental_toolApprovalSecret: approvalSecret");
    expect(source).toContain("allowArtifactWrites: actionToolsEnabled");
    expect(source).not.toContain("parseConfirmedChangeEventApprovalInput");
    expect(source).not.toContain("change-event-confirmed-write");
    expect(source).not.toContain("rawAssistantSurface");
  });

  it("binds capabilities and conversation namespaces in server-owned routes", () => {
    const fullRoute = fs.readFileSync(
      path.resolve(__dirname, "..", "route.ts"),
      "utf8",
    );
    const askRoute = fs.readFileSync(
      path.resolve(
        __dirname,
        "../../../ask-alleato/chat/route.ts",
      ),
      "utf8",
    );

    expect(fullRoute).toContain("assistantSurface: AI_ASSISTANT_SURFACES.full");
    expect(fullRoute).toContain('conversationSurface: "alleato_ai"');
    expect(askRoute).toContain(
      "assistantSurface: AI_ASSISTANT_SURFACES.askAlleato",
    );
    expect(askRoute).toContain('conversationSurface: "ask_alleato"');
  });

  it("renders signed SDK approval responses and preserves automatic resume", () => {
    const source = fs.readFileSync(
      path.resolve(
        __dirname,
        "../../../../../components/ai-assistant/chat-area.tsx",
      ),
      "utf8",
    );

    expect(source).toContain(
      "This action requires approval before it can run.",
    );
    expect(source).toContain("User approved tool execution");
    expect(source).toContain("User denied tool execution");
    expect(source).toContain("onToolApprovalResponse");
  });

  it("sends estimate workbook binaries through the authenticated server preview route", () => {
    const source = fs.readFileSync(
      path.resolve(
        __dirname,
        "../../../../../components/ai-assistant/chat-area.tsx",
      ),
      "utf8",
    );

    expect(source).toContain('formData.append(\n        "file"');
    expect(source).toContain(
      "`/api/projects/${projectId}/contracts/estimate-import/preview`",
    );
    expect(source).toContain("formatEstimateWorkbookPreviewForChat(preview)");
    expect(source).toContain("selectedProjectIdProp ?? null");
    expect(source).toContain(
      "return `(estimate workbook preview blocked: ${error instanceof Error ? error.message",
    );
    expect(source).not.toContain(
      "if (!(error instanceof ApiError && error.status === 400))",
    );
  });
});
