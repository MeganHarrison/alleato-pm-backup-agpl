import {
  buildEmailContentBlocks,
  latestReadableMessage,
  latestMessageOnly,
  stripLeadingPseudoHeader,
  stripQuotedReplyHistory,
} from "../email-thread";

describe("stripLeadingPseudoHeader", () => {
  it("removes a leading Subject/Date/From/To block and its trailing blank line", () => {
    const raw = [
      "Subject: Re: Exol Morrisville PA",
      "Date: 2026-06-12T14:49:19Z",
      "From: Brandon Clymer <bclymer@alleatogroup.com>",
      "To: Steve Fischer <steve.fischer@exol.com>",
      "",
      "Yes we will get it added.",
    ].join("\n");

    expect(stripLeadingPseudoHeader(raw)).toBe("Yes we will get it added.");
  });

  it("leaves a body with no leading header untouched", () => {
    const raw = "Hello team, here is the update.";
    expect(stripLeadingPseudoHeader(raw)).toBe(raw);
  });
});

describe("stripQuotedReplyHistory", () => {
  it("cuts at the first Outlook 'From: … Sent:' quote header", () => {
    const raw =
      "Yes we will get it added. Thank You Brandon Clymer CEO at Alleato Group " +
      "From: Steve Fischer <steve.fischer@exol.com> Sent: Friday, June 12, 2026 10:43 AM " +
      "To: Brandon Clymer Subject: Re: Exol Morrisville PA Can you include a joint fill price";

    expect(stripQuotedReplyHistory(raw)).toBe(
      "Yes we will get it added. Thank You Brandon Clymer CEO at Alleato Group",
    );
  });

  it("cuts at '-----Original Message-----'", () => {
    const raw = "Latest reply here.\n-----Original Message-----\nold stuff";
    expect(stripQuotedReplyHistory(raw)).toBe("Latest reply here.");
  });

  it("cuts at a Gmail-style 'On … wrote:' marker", () => {
    const raw = "Sounds good.\nOn Tue, Jun 11, 2026 at 9:00 AM Steve wrote:\nquoted";
    expect(stripQuotedReplyHistory(raw)).toBe("Sounds good.");
  });

  it("cuts at an injected external-sender banner", () => {
    const raw = "My message. NkdkJdXPPEBannerStart External Sender ... banner junk";
    expect(stripQuotedReplyHistory(raw)).toBe("My message.");
  });

  it("does not cut a simple message with no quoted history", () => {
    const raw = "Just a short note with no reply chain.";
    expect(stripQuotedReplyHistory(raw)).toBe(raw);
  });

  it("does not mistake a leading metadata 'From:'+'To:' for a quote header", () => {
    // The leading block uses From: ... To: (with Date:, not Sent:), so the
    // first real quote boundary is the inline 'From: … Sent:' further down.
    const raw =
      "From: Brandon Clymer <bclymer@alleatogroup.com>\n" +
      "To: Steve Fischer <steve.fischer@exol.com>\n\n" +
      "Real body. From: Steve Fischer <s@exol.com> Sent: Friday To: x quoted";

    expect(stripQuotedReplyHistory(raw)).toBe(
      "From: Brandon Clymer <bclymer@alleatogroup.com>\n" +
        "To: Steve Fischer <steve.fischer@exol.com>\n\n" +
        "Real body.",
    );
  });
});

describe("latestMessageOnly", () => {
  it("reduces a full stored thread to just the latest message (Brandon, not Bob)", () => {
    // Mirrors the real project_emails.body_text shape that surfaced the bug.
    const raw = [
      "Subject: Re: Exol Morrisville PA",
      "Date: 2026-06-11T15:14:41Z",
      "From: Brandon Clymer <bclymer@alleatogroup.com>",
      "To: Steve Fischer <steve.fischer@exol.com>",
      "",
      "Steve, Here is the updated number to include all the gear as well. " +
        "Thank You Brandon Clymer CEO at Alleato Group " +
        "From: Bob Wright <bwright@alleatogroup.com> Sent: Wednesday, June 10, 2026 " +
        "To: Steve Subject: Re: Exol regards, Bob Wright Senior Project Manager",
    ].join("\n");

    const result = latestMessageOnly(raw);
    expect(result).toContain("Steve, Here is the updated number");
    expect(result).toContain("Thank You Brandon Clymer CEO at Alleato Group");
    expect(result).not.toContain("Bob Wright");
    expect(result).not.toMatch(/Subject:|Date:|^From:/m);
  });
});

describe("latestReadableMessage", () => {
  it("decodes entities and strips mashed forwarded metadata into readable body text", () => {
    const raw =
      "Subject: Re: Exol Morrisville Laydown Areas Date: 2026-06-11T13:40:08Z " +
      "From: Brandon Clymer <bclymer@alleatogroup.com> To: Parker Hollingsworth <phollingsworth@alleatogroup.com> " +
      "Parker, Where do you have the storage for the dock equipment at?&nbsp; Thank You&nbsp; Brandon Clymer " +
      "CEO at Alleato Group&nbsp; Mobile&nbsp; 317.760.0088&nbsp; | &nbsp; Email&nbsp; bclymer@alleatogroup.com " +
      "From: Parker Hollingsworth <phollingsworth@alleatogroup.com> Sent: Wednesday, June 10, 2026 1:18 PM To: Bob Wright";

    const result = latestReadableMessage(raw);

    expect(result).toContain("Parker, Where do you have the storage for the dock equipment at?");
    expect(result).toContain("Thank You\nBrandon Clymer");
    expect(result).not.toContain("&nbsp;");
    expect(result).not.toContain("Sent: Wednesday, June 10, 2026 1:18 PM");
    expect(result).not.toMatch(/^Subject:/m);
  });

  it("promotes inline sign-off and signature lines into separate lines", () => {
    const raw =
      "Parker, Where do you have the storage for the dock equipment at? Thank You Brandon Clymer CEO at Alleato Group";

    const result = latestReadableMessage(raw);

    expect(result).toContain(
      "Parker, Where do you have the storage for the dock equipment at?\n\nThank You\nBrandon Clymer\nCEO at Alleato Group",
    );
  });

  it("formats flattened file-list emails and strips vendor disclaimer blocks", () => {
    const raw =
      "Hello, The below files have been uploaded to the SharePoint " +
      "250-05901-Exol, Morrisville, Phase 1, (Overall Plan Layout) Rev D " +
      "Rev D: Updated to match latest Revit Model " +
      "250-05908-Exol, Morrisville, Phase 1, (Pit Locations and Details) Rev B " +
      "Rev B: Updated mezzanine columns to match the latest Revit Model " +
      "4.01.2 - Current Layout WILLIAM BLANK | senior project engineer e: wblank@symbotic.com " +
      "www.symbotic.com SYMBOTIC 200 Research Drive Wilmington, MA 01887 " +
      "Reinvent the warehouse | Reimagine the supply chain® **Symbotic Confidential** " +
      "This e-mail and any attachments contain Symbotic confidential information.";

    const result = latestReadableMessage(raw);

    expect(result).toContain("Hello, The below files have been uploaded to the SharePoint");
    expect(result).toContain("\n250-05901-Exol, Morrisville, Phase 1, (Overall Plan Layout) Rev D");
    expect(result).toContain("\nRev D: Updated to match latest Revit Model");
    expect(result).toContain("\n250-05908-Exol, Morrisville, Phase 1, (Pit Locations and Details) Rev B");
    expect(result).not.toContain("Symbotic Confidential");
    expect(result).not.toContain("wblank@symbotic.com");
  });

  it("formats flattened request/list emails into readable sections", () => {
    const raw =
      "Hi Brandon, Good day! We would like to ask or request the following information in connection with preparing " +
      "Brandon's 2025 Form 1040 Personal Return. Please provide or verify if the following information is still valid for " +
      "2025. Client Information Address: 11012 N College Ave, Carmel, IN 46280-1068 Your Occupation: Date of Birth: " +
      "Phone No: 317-760-0088 We would also like to ask if you have paid the following for 2025 . If yes, please upload " +
      "the supporting documents to them to ShareFile. 2025 Estimated Tax Payment Federal Payment Indiana Payment " +
      "Charitable Contribution Real Estate Taxes Home Mortgage Interest (Form 1098) If you have the following tax " +
      "documents for 2025 , please upload them to ShareFile. Form W-2s WorkSmart Systems, Inc Alleato LLC " +
      "No Boundaries Consulting LLC Form 1099-INT & DIV Pershing LLC Any other tax documents that may be required " +
      "for your personal return. You can upload the documents under this directory in ShareFile: Brandon Clymer > 5 Tax " +
      "Return Documents > 2025 Tax Documents For reference, here is the permalink to access the ShareFile: " +
      "https://rottweilertax.sharefile.com/ If you have any questions or require further clarification, please feel free to " +
      "reach out. Thank you for your time and cooperation.";

    const result = latestReadableMessage(raw);

    expect(result).toContain("\n\nPlease provide or verify");
    expect(result).toContain("\nClient Information Address:");
    expect(result).toContain("\nYour Occupation:");
    expect(result).toContain("\nFederal Payment:");
    expect(result).toContain("\nForm W-2s:");
    expect(result).toContain("\n\nThank you for your time and cooperation.");
  });
});

describe("buildEmailContentBlocks", () => {
  it("keeps flattened upload emails readable as multiple paragraphs", () => {
    const raw =
      "Hello, The below files have been uploaded to the SharePoint " +
      "250-05901-Exol, Morrisville, Phase 1, (Overall Plan Layout) Rev D " +
      "Rev D: Updated to match latest Revit Model " +
      "250-05908-Exol, Morrisville, Phase 1, (Pit Locations and Details) Rev B " +
      "Rev B: Updated mezzanine columns to match the latest Revit Model " +
      "4.01.2 - Current Layout WILLIAM BLANK | senior project engineer e: wblank@symbotic.com " +
      "www.symbotic.com **Symbotic Confidential** footer";

    const blocks = buildEmailContentBlocks(raw);
    const text = blocks.flatMap((block) => block.lines).join("\n");

    expect(blocks.length).toBeGreaterThan(1);
    expect(text).toContain("250-05901-Exol, Morrisville, Phase 1, (Overall Plan Layout) Rev D");
    expect(text).toContain("Rev B: Updated mezzanine columns to match the latest Revit Model");
    expect(text).not.toContain("Symbotic Confidential");
  });

  it("breaks a run-on body whose line breaks were flattened into runs of spaces", () => {
    // Real shape of an Outlook plain-text export: the original newlines survive
    // only as runs of 2+ spaces, so without reflow the whole message is a single
    // 3500-char paragraph (the "big ball of text" bug).
    const raw =
      "They accepted many of our changes and I think we are in relatively good shape.   " +
      "Bigger items - A141   Water Warranty (3.1.12.2). They added back the water-tight language.   " +
      "Warranty Disclaimer (3.1.12.5). They struck the no other reps/warranties language.  " +
      "Indemnification (3.1.14).  Exol added the defense obligation.";

    const blocks = buildEmailContentBlocks(raw);
    const lineCount = blocks.reduce((sum, block) => sum + block.lines.length, 0);

    // Must no longer be one unbroken line.
    expect(lineCount).toBeGreaterThan(3);
    const lines = blocks.flatMap((block) => block.lines);
    expect(lines).toContain("Water Warranty (3.1.12.2). They added back the water-tight language.");
    expect(lines).toContain("Indemnification (3.1.14).");
    // No single rendered line should still be a wall of text.
    expect(Math.max(...lines.map((line) => line.length))).toBeLessThan(200);
  });
});
