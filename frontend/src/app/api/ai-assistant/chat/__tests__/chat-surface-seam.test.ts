import fs from "node:fs";
import path from "node:path";

describe("general assistant surface authorization", () => {
  test("checks conversation ownership before starting a general chat turn", () => {
    const handler = fs.readFileSync(
      path.resolve(__dirname, "..", "handler-v2.ts"),
      "utf8",
    );
    const ownershipCheck = handler.indexOf("conversationBelongsToSurface({");
    const generalSurface = handler.indexOf('surface: "alleato_ai"', ownershipCheck);
    const chatStart = handler.indexOf("return runChatV2({", ownershipCheck);

    expect(ownershipCheck).toBeGreaterThan(-1);
    expect(generalSurface).toBeGreaterThan(ownershipCheck);
    expect(chatStart).toBeGreaterThan(generalSurface);
    expect(handler).toContain(
      'message: "This conversation is not part of Alleato AI."',
    );
  });
});