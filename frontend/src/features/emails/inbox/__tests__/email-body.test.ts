import { cleanEmailBody, decodeHtmlEntities } from "../email-body";

describe("cleanEmailBody", () => {
  it("strips a leading pseudo-header block that duplicates the pane metadata", () => {
    const raw = [
      "Subject: Park Collective Updated Plan and Answers",
      "Date: 2026-06-12T18:46:24Z",
      "From: Douglas Franklin <dfranklin@alleatogroup.com>",
      "To: jerome.daksiewicz <jerome.daksiewicz@dkgrar.com>",
      "",
      "Jerome, I do have some answers from today's call.",
    ].join("\n");

    expect(cleanEmailBody(raw)).toBe(
      "Jerome, I do have some answers from today's call.",
    );
  });

  it("handles Cc/Bcc/Sent/Reply-To header variants", () => {
    const raw = [
      "From: a@b.com",
      "Sent: Monday",
      "Cc: c@d.com",
      "Bcc: e@f.com",
      "Reply-To: g@h.com",
      "",
      "Body starts here.",
    ].join("\n");

    expect(cleanEmailBody(raw)).toBe("Body starts here.");
  });

  it("does NOT strip a colon-bearing line in the middle of the body", () => {
    const raw = ["Hello team,", "", "Note: the gates will be removed."].join(
      "\n",
    );

    // No leading header block → nothing stripped.
    expect(cleanEmailBody(raw)).toBe(
      "Hello team,\n\nNote: the gates will be removed.",
    );
  });

  it("preserves a 'Subject:'-like sentence that is real body content", () => {
    const raw = "Please review the change before Subject: discussion.";
    expect(cleanEmailBody(raw)).toBe(raw);
  });

  it("collapses runs of 3+ blank lines and trims edges", () => {
    const raw = "\n\nFirst line\n\n\n\nSecond line\n\n";
    expect(cleanEmailBody(raw)).toBe("First line\n\nSecond line");
  });

  it("decodes HTML entities in the body", () => {
    expect(cleanEmailBody("Tom &amp; Jerry &lt;3 &nbsp;done")).toBe(
      "Tom & Jerry <3  done",
    );
  });

  it("returns empty string for an all-header body", () => {
    const raw = "Subject: x\nFrom: a@b.com\nTo: c@d.com";
    expect(cleanEmailBody(raw)).toBe("");
  });
});

describe("decodeHtmlEntities", () => {
  it("decodes the common entity set", () => {
    expect(
      decodeHtmlEntities("&lt;a&gt; &amp; &quot;b&quot; &#39;c&apos;&nbsp;"),
    ).toBe("<a> & \"b\" 'c' ");
  });
});
