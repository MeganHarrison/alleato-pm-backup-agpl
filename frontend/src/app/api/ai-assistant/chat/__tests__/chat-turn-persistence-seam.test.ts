import fs from "node:fs";
import path from "node:path";

describe("chat-turn persistence seam", () => {
  test("handler-v2 does not bypass the request-bound chat turn persistence adapter", () => {
    const handler = fs.readFileSync(
      path.resolve(__dirname, "..", "handler-v2.ts"),
      "utf8",
    );

    expect(handler).toContain("const persistChatHistoryRow");
    expect(handler).not.toContain('.from("chat_history").insert(');
    expect(handler.match(/persistChatHistoryRow\(/g)?.length).toBeGreaterThan(20);
  });
});
