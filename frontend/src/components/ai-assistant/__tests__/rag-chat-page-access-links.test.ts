import fs from "node:fs";
import path from "node:path";

const ragChatPagePath = path.join(
  process.cwd(),
  "src/components/ai-assistant/rag-chat-page.tsx",
);

describe("RagChatPage AI access links", () => {
  it("keeps review, profile, and teaching routes available outside the empty state", () => {
    const source = fs.readFileSync(ragChatPagePath, "utf8");

    expect(source).toContain('aria-label="AI workspace links"');
    expect(source).toContain('href="/ai/approvals"');
    expect(source).toContain('href="/ai/profile"');
    expect(source).toContain('href="/ai/teach"');
    expect(source).not.toContain("hidden items-center gap-3");
  });
});
