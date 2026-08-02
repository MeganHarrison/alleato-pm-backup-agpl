import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("Alleato AI widget runtime", () => {
  const widgetSource = readFileSync(
    join(__dirname, "..", "widget-ai-chat.tsx"),
    "utf8",
  );

  it("uses the shared Eve session and no legacy chat endpoint", () => {
    expect(widgetSource).toContain("<ChatWithSession");
    expect(widgetSource).toContain('assistantSurface="alleato_ai"');
    expect(widgetSource).not.toContain("/api/ai-assistant/chat");
  });
});
