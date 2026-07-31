import { EMAIL_INBOX_SPLIT_VIEW_CLASSNAME } from "../email-inbox-client";

describe("EmailInboxClient layout", () => {
  it("keeps the inbox split view on a flex-fill layout contract", () => {
    expect(EMAIL_INBOX_SPLIT_VIEW_CLASSNAME).toContain("h-full");
    expect(EMAIL_INBOX_SPLIT_VIEW_CLASSNAME).toContain("min-h-0");
    expect(EMAIL_INBOX_SPLIT_VIEW_CLASSNAME).toContain("flex-1");
    expect(EMAIL_INBOX_SPLIT_VIEW_CLASSNAME).toContain("overflow-hidden");
    expect(EMAIL_INBOX_SPLIT_VIEW_CLASSNAME).toContain("w-full");
    expect(EMAIL_INBOX_SPLIT_VIEW_CLASSNAME).not.toContain("100dvh");
  });
});
