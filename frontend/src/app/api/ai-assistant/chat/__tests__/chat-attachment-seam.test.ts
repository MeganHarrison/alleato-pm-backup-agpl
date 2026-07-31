import fs from "node:fs";
import path from "node:path";

describe("chat attachment production seam", () => {
  test("handler-v2 validates the full UI message payload and forwards only model-readable images", () => {
    const handler = fs.readFileSync(
      path.resolve(__dirname, "..", "handler-v2.ts"),
      "utf8",
    );

    expect(handler).toContain("validateChatAttachmentPayload(messages)");
    expect(handler).toContain(
      "detectChatAttachmentCapabilitiesAcrossMessages(args.messages)",
    );
    expect(handler).toContain("filterModelReadableAttachments(args.messages)");
    expect(handler).toContain(
      "buildChatAttachmentNote(attachmentCapabilities)",
    );
    expect(handler).toContain(
      "hasAttachments: attachmentCapabilities.hasAttachments",
    );
    expect(handler).toContain("convertToModelMessages(modelReadableMessages)");
    expect(handler).not.toContain("function detectAttachments(");
    expect(handler).not.toContain(
      "The user attached file(s) you CANNOT read directly:",
    );
  });
});
