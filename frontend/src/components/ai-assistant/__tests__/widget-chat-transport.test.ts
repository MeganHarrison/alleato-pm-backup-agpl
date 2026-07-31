import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("Alleato AI widget transport", () => {
  const widgetSource = readFileSync(
    join(__dirname, "..", "widget-ai-chat.tsx"),
    "utf8",
  );

  it("uses the shared AI chat endpoint", () => {
    expect(widgetSource).toContain('chatApi="/api/ai-assistant/chat"');
  });
});