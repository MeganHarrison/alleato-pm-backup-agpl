import { tool } from "ai";
import { z } from "zod";
import {
  createOutboundActionPolicy,
  redactToolOutput,
  safeRedactToolTrace,
  wrapToolSetWithOutboundActionPolicy,
} from "../outbound-action-policy";

describe("outbound-action-policy", () => {
  it("blocks write tools that omit the confirmed field", async () => {
    const tools = wrapToolSetWithOutboundActionPolicy(
      {
        sendExternalMessage: tool({
          inputSchema: z.object({ message: z.string() }),
          execute: async () => ({ status: "created", id: "sent-1" }),
        }),
      },
      { enabled: true, writeToolNames: ["sendExternalMessage"] },
    );

    const result = await tools.sendExternalMessage.execute?.({ message: "send it" }, {} as never);

    expect(result).toMatchObject({
      __toolDenied: true,
      reason: "MISSING_CONFIRMATION_FIELD",
      toolName: "sendExternalMessage",
    });
  });

  it("allows unconfirmed writes only when the result stays draft-only", async () => {
    const tools = wrapToolSetWithOutboundActionPolicy(
      {
        draftOutlookEmail: tool({
          inputSchema: z.object({ confirmed: z.boolean().default(false), body: z.string() }),
          execute: async () => ({ status: "draft", body: "Ready for approval" }),
        }),
      },
      { enabled: true, writeToolNames: ["draftOutlookEmail"] },
    );

    await expect(
      tools.draftOutlookEmail.execute?.({ confirmed: false, body: "Draft this" }, {} as never),
    ).resolves.toMatchObject({ status: "draft", body: "Ready for approval" });
  });

  it("denies unconfirmed write results that bypass draft-only behavior", async () => {
    const tools = wrapToolSetWithOutboundActionPolicy(
      {
        sendTeamsMessage: tool({
          inputSchema: z.object({ confirmed: z.boolean().default(false), message: z.string() }),
          execute: async () => ({ status: "created", externalId: "msg-1" }),
        }),
      },
      { enabled: true, writeToolNames: ["sendTeamsMessage"] },
    );

    const result = await tools.sendTeamsMessage.execute?.({ confirmed: false, message: "Go" }, {} as never);

    expect(result).toMatchObject({
      __toolDenied: true,
      reason: "UNCONFIRMED_WRITE_DENIED",
      toolName: "sendTeamsMessage",
    });
  });

  it("redacts secret-bearing output before traces or UI content", async () => {
    const traces: unknown[] = [];
    const tools = wrapToolSetWithOutboundActionPolicy(
      {
        createExternalDraft: tool({
          inputSchema: z.object({ confirmed: z.boolean().default(false) }),
          execute: async () => ({ status: "draft", accessToken: "secret-token", nested: { authorization: "Bearer abc123456789012" } }),
        }),
      },
      { enabled: true, writeToolNames: ["createExternalDraft"], onTrace: (trace) => traces.push(trace.output) },
    );

    const result = await tools.createExternalDraft.execute?.({ confirmed: false }, {} as never);

    expect(result).toMatchObject({
      status: "draft",
      accessToken: "[REDACTED]",
      nested: { authorization: "[REDACTED]" },
    });
    expect(JSON.stringify(result)).not.toContain("secret-token");
  });

  it("fails safely when redaction cannot complete", () => {
    const circular: Record<string, unknown> = { status: "draft" };
    circular.self = circular;

    expect(() => redactToolOutput(circular)).toThrow("Cannot redact circular tool output.");
    expect(safeRedactToolTrace({ tool: "unsafeTool", input: {}, output: circular, timestamp: "now" })).toMatchObject({
      __toolError: true,
      source: "unsafeTool",
      policy: "outbound-action-policy",
    });
  });

  it("exposes explicit beforeToolCall and afterToolCall semantics", () => {
    const policy = createOutboundActionPolicy(["createRFI"]);
    const decision = policy.beforeToolCall({ toolName: "createRFI", input: { confirmed: false } });

    expect(decision).toMatchObject({ allowed: true, mode: "draft-only" });
    expect(policy.afterToolCall({ toolName: "createRFI", input: { confirmed: false }, output: { status: "created" }, decision })).toMatchObject({
      __toolDenied: true,
      reason: "UNCONFIRMED_WRITE_DENIED",
    });
  });
});
