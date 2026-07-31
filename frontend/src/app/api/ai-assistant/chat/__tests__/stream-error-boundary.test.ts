import fs from "node:fs";
import path from "node:path";

describe("AI assistant stream error boundary", () => {
  it("maps streamText provider failures before AI SDK replaces them with generic copy", () => {
    const handlerSource = fs.readFileSync(
      path.resolve(__dirname, "../handler-v2.ts"),
      "utf8",
    );

    expect(handlerSource).toContain("result.toUIMessageStream({");
    expect(handlerSource).toContain(
      "return buildAssistantStreamErrorMessage(message);",
    );
  });
});
