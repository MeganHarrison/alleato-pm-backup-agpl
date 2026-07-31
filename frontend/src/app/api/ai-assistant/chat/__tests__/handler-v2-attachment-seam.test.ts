import fs from "node:fs";
import path from "node:path";

// Regression guard for the vision-attachment seam.
//
// History: a complete vision helper lives in
// `@/lib/ai/chat-attachment-capabilities` (detect capabilities, build the
// system note, forward only validated images). A later handler change quietly
// stopped using it and hand-rolled a private `detectAttachments` that flagged
// EVERY file part — images included — as unreadable, then injected a
// "you CANNOT read directly: <screenshot>" instruction. That contradicted the
// image the model actually received as a vision input and caused refusals /
// mis-routing on screenshot-driven requests (trace d9a9595f).
//
// These assertions fail if the handler drifts back to a disconnected helper.
describe("handler-v2 vision attachment seam", () => {
  const handler = fs.readFileSync(
    path.resolve(__dirname, "..", "handler-v2.ts"),
    "utf8",
  );

  test("uses the shared chat-attachment-capabilities helper", () => {
    expect(handler).toContain(
      'from "@/lib/ai/chat-attachment-capabilities"',
    );
    expect(handler).toContain("detectChatAttachmentCapabilities(");
    expect(handler).toContain("buildChatAttachmentNote(");
    expect(handler).toContain("filterModelReadableAttachments(");
  });

  test("does not re-introduce a private attachment classifier", () => {
    // A local `function detectAttachments(` is the exact shape of the removed
    // helper that classified images as unreadable.
    expect(handler).not.toMatch(/function\s+detectAttachments\s*\(/);
  });

  test("never tells the model an attached image cannot be read", () => {
    // The old contradictory instruction. The shared builder only warns about
    // genuinely unsupported files and, for images, says they are vision inputs
    // to inspect — so this literal must not appear in the handler itself.
    expect(handler).not.toContain("you CANNOT read directly");
  });

  test("forwards attachments through the vision filter before the model", () => {
    // filterModelReadableAttachments must wrap the messages handed to
    // convertToModelMessages, so unsupported binaries are dropped and only
    // validated images reach the provider.
    expect(handler).toMatch(
      /convertToModelMessages\(\s*filterModelReadableAttachments\(/,
    );
  });
});
