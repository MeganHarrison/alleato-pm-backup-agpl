import { readFileSync } from "node:fs";
import { join } from "node:path";

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

  it.todo(
    "AAI-1307 removes the superseded generation owners after the transplanted runtime is proven",
  );
});
