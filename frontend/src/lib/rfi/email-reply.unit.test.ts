import {
  parseReplyMailbox,
  buildRfiReplyAddress,
  extractTokenFromRecipients,
  extractTokenFromBody,
  extractReplyToken,
  stripQuotedReply,
} from "./email-reply";

const MAILBOX = parseReplyMailbox("rfi@alleatogroup.com")!;
const TOKEN = "Ab12_Cd34-Ef56Gh78Ij90Kl12Mn34";

describe("parseReplyMailbox", () => {
  it("splits local part and domain", () => {
    expect(MAILBOX).toEqual({
      localPart: "rfi",
      domain: "alleatogroup.com",
      address: "rfi@alleatogroup.com",
    });
  });

  it("returns null for invalid addresses", () => {
    expect(parseReplyMailbox("")).toBeNull();
    expect(parseReplyMailbox("not-an-email")).toBeNull();
    expect(parseReplyMailbox("@domain.com")).toBeNull();
    expect(parseReplyMailbox(undefined)).toBeNull();
  });
});

describe("buildRfiReplyAddress", () => {
  it("embeds the token as a plus-address", () => {
    expect(buildRfiReplyAddress(MAILBOX, TOKEN)).toBe(
      `rfi+${TOKEN}@alleatogroup.com`,
    );
  });
});

describe("extractTokenFromRecipients", () => {
  it("extracts the token from a plus-address To header", () => {
    expect(
      extractTokenFromRecipients([`rfi+${TOKEN}@alleatogroup.com`], MAILBOX),
    ).toBe(TOKEN);
  });

  it("extracts from a 'Name <addr>' formatted recipient", () => {
    expect(
      extractTokenFromRecipients(
        [`"RFI Replies" <rfi+${TOKEN}@alleatogroup.com>`],
        MAILBOX,
      ),
    ).toBe(TOKEN);
  });

  it("is case-insensitive on the domain/local part", () => {
    expect(
      extractTokenFromRecipients([`RFI+${TOKEN}@ALLEATOGROUP.COM`], MAILBOX),
    ).toBe(TOKEN);
  });

  it("ignores the plain mailbox address with no token", () => {
    expect(
      extractTokenFromRecipients(["rfi@alleatogroup.com"], MAILBOX),
    ).toBeNull();
  });

  it("ignores unrelated recipients", () => {
    expect(
      extractTokenFromRecipients(
        ["someone@else.com", "rfi@other-domain.com"],
        MAILBOX,
      ),
    ).toBeNull();
  });
});

describe("extractTokenFromBody", () => {
  it("finds the token in a quoted magic link", () => {
    const body = `Sounds good.\n\nOn Tue wrote:\n> Respond here: https://projects.alleatogroup.com/respond/rfi/${TOKEN}`;
    expect(extractTokenFromBody(body)).toBe(TOKEN);
  });

  it("returns null when no link is present", () => {
    expect(extractTokenFromBody("just some text")).toBeNull();
  });
});

describe("extractReplyToken", () => {
  it("prefers the recipient plus-address over the body", () => {
    expect(
      extractReplyToken(
        [`rfi+${TOKEN}@alleatogroup.com`],
        `/respond/rfi/DIFFERENTtoken000000`,
        MAILBOX,
      ),
    ).toBe(TOKEN);
  });

  it("falls back to the body when recipients lack the token", () => {
    expect(
      extractReplyToken(
        ["rfi@alleatogroup.com"],
        `link: /respond/rfi/${TOKEN}`,
        MAILBOX,
      ),
    ).toBe(TOKEN);
  });
});

describe("stripQuotedReply", () => {
  it("keeps only the new text above an 'On ... wrote:' quote", () => {
    const body = [
      "Use 5/8\" Type X gypsum per S-301.",
      "",
      "On Tue, Jun 24, 2026 at 9:00 AM Brandon <b@x.com> wrote:",
      "> What spec for the demising wall?",
    ].join("\n");
    expect(stripQuotedReply(body)).toBe('Use 5/8" Type X gypsum per S-301.');
  });

  it("stops at an Outlook 'From:' header block", () => {
    const body = [
      "Confirmed on site.",
      "",
      "From: RFI Replies <rfi@alleatogroup.com>",
      "Sent: Tuesday",
      "Subject: RFI #1",
    ].join("\n");
    expect(stripQuotedReply(body)).toBe("Confirmed on site.");
  });

  it("drops quoted '>' lines", () => {
    const body = ["My answer.", "> original question"].join("\n");
    expect(stripQuotedReply(body)).toBe("My answer.");
  });

  it("removes a trailing signature after '--'", () => {
    const body = ["The answer is yes.", "--", "John Doe", "Acme Co"].join("\n");
    expect(stripQuotedReply(body)).toBe("The answer is yes.");
  });

  it("returns trimmed body when there is no quote", () => {
    expect(stripQuotedReply("  just an answer  ")).toBe("just an answer");
  });
});
