import fs from "node:fs";
import path from "node:path";

describe("main application layout landmarks", () => {
  it("gives the immersive branch an explicit primary content landmark", () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, "../layout.tsx"),
      "utf8",
    );
    expect(source).toMatch(
      /if \(isImmersiveChatPage\)[\s\S]*?<main[\s\S]*?id="app-main-content"[\s\S]*?\{\.\.\.feedbackTargetProps\("app\.main-content"\)\}/,
    );
  });
});
