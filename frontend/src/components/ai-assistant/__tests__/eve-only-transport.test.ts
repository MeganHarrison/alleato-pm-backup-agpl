import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

describe("AI Assistant sole runtime", () => {
  const source = readFileSync(
    join(__dirname, "..", "rag-chat-page.tsx"),
    "utf8",
  );

  it("mounts the canonical Eve transport directly", () => {
    expect(source).toContain("return <EveChatWithSession {...props} />");
    expect(source).toContain("useAlleatoEveChat({");
  });

  it("contains no runtime selector or fallback transport", () => {
    expect(source).not.toContain("/api/ai-assistant/turns/runtime");
    expect(source).not.toContain("/api/ai-assistant/chat");
    expect(source).not.toContain("LegacyChatWithSession");
    expect(source).not.toContain("assignment.runtime");
  });

  it("fails if a removed generation owner is reintroduced", () => {
    const frontendRoot = resolve(__dirname, "../../../..");
    const removedOwners = [
      "src/app/api/ai-assistant/chat/route.ts",
      "src/app/api/ai-assistant/chat/handler-v2.ts",
      "src/app/api/ai-assistant/turns/runtime/route.ts",
      "src/app/api/ask-alleato/chat/route.ts",
      "src/lib/ai/orchestrator.ts",
      "src/lib/ai/bot-core.ts",
      "src/lib/ai/agents/strategist.ts",
      "src/lib/ai/agents/cfo.ts",
      "src/lib/ai/agents/coo.ts",
      "src/lib/ai/agents/cro.ts",
      "src/lib/ai/agents/chro.ts",
      "src/lib/ai/agents/cmo.ts",
      "src/lib/ai/agents/vpbd.ts",
    ];

    for (const removedOwner of removedOwners) {
      expect(existsSync(join(frontendRoot, removedOwner))).toBe(false);
    }
  });
});
