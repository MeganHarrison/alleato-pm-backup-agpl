import { buildOwnEmailsFilter } from "../access";

describe("buildOwnEmailsFilter", () => {
  it("returns null when no identifiers are provided", () => {
    expect(buildOwnEmailsFilter({ authUserId: null, email: null })).toBeNull();
    expect(buildOwnEmailsFilter({ authUserId: undefined, email: undefined })).toBeNull();
    expect(buildOwnEmailsFilter({ authUserId: "", email: "" })).toBeNull();
  });

  it("builds clauses for from, mailbox owner, to/cc/bcc, and creator", () => {
    const filter = buildOwnEmailsFilter({
      authUserId: "user-123",
      email: "megan@alleatogroup.com",
    });
    expect(filter).toBe(
      [
        "from_email.ilike.megan@alleatogroup.com",
        "mailbox_user_id.ilike.megan@alleatogroup.com",
        "to_list.cs.{megan@alleatogroup.com}",
        "cc_list.cs.{megan@alleatogroup.com}",
        "bcc_list.cs.{megan@alleatogroup.com}",
        "created_by.eq.user-123",
      ].join(","),
    );
  });

  it("lowercases and trims the email", () => {
    const filter = buildOwnEmailsFilter({
      authUserId: null,
      email: "  MEGAN@Alleatogroup.com  ",
    });
    expect(filter).toContain("from_email.ilike.megan@alleatogroup.com");
    expect(filter).not.toContain("MEGAN");
  });

  it("omits email clauses when the email is unsafe for the PostgREST filter grammar", () => {
    // Commas, quotes, braces, or whitespace inside the email would break `cs.{...}`.
    const dangerous = ["bad,user@x.com", "bad\"user@x.com", "bad}user@x.com", "bad user@x.com"];
    for (const email of dangerous) {
      const filter = buildOwnEmailsFilter({ authUserId: "user-123", email });
      // Only the created_by clause should remain — no email-based clauses leak through.
      expect(filter).toBe("created_by.eq.user-123");
    }
  });

  it("returns only the creator clause when no email is supplied", () => {
    const filter = buildOwnEmailsFilter({ authUserId: "user-123", email: null });
    expect(filter).toBe("created_by.eq.user-123");
  });

  it("returns only the email clauses when no auth id is supplied", () => {
    const filter = buildOwnEmailsFilter({ authUserId: null, email: "x@y.com" });
    expect(filter).toBe(
      [
        "from_email.ilike.x@y.com",
        "mailbox_user_id.ilike.x@y.com",
        "to_list.cs.{x@y.com}",
        "cc_list.cs.{x@y.com}",
        "bcc_list.cs.{x@y.com}",
      ].join(","),
    );
  });
});
