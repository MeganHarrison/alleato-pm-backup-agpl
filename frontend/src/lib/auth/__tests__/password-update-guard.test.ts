import { evaluatePasswordUpdateGuard } from "../password-update-guard";

describe("evaluatePasswordUpdateGuard", () => {
  it("allows updating when the session matches the intended email", () => {
    const result = evaluatePasswordUpdateGuard({
      sessionEmail: "bclymer@alleatogroup.com",
      intendedEmail: "bclymer@alleatogroup.com",
    });

    expect(result.allowed).toBe(true);
    expect(result.kind).toBe("ok");
  });

  it("ignores case and surrounding whitespace when comparing emails", () => {
    const result = evaluatePasswordUpdateGuard({
      sessionEmail: "  BClymer@AlleatoGroup.com ",
      intendedEmail: "bclymer@alleatogroup.com",
    });

    expect(result.allowed).toBe(true);
  });

  it("blocks updating when the session belongs to a different user than the link", () => {
    // The exact incident: Brandon is signed in, an invite link for someone
    // else is opened in his session. The update must NOT overwrite Brandon.
    const result = evaluatePasswordUpdateGuard({
      sessionEmail: "bclymer@alleatogroup.com",
      intendedEmail: "newhire@subcontractor.com",
    });

    expect(result.allowed).toBe(false);
    expect(result.kind).toBe("email-mismatch");
    expect(result.message).toContain("newhire@subcontractor.com");
    expect(result.message).toContain("bclymer@alleatogroup.com");
  });

  it("blocks updating when there is no verified session", () => {
    const result = evaluatePasswordUpdateGuard({
      sessionEmail: null,
      intendedEmail: "newhire@subcontractor.com",
    });

    expect(result.allowed).toBe(false);
    expect(result.kind).toBe("no-session");
  });

  it("blocks when there is no session even if the link carried no email", () => {
    const result = evaluatePasswordUpdateGuard({
      sessionEmail: "",
      intendedEmail: null,
    });

    expect(result.allowed).toBe(false);
    expect(result.kind).toBe("no-session");
  });

  it("allows updating the active session when the link carried no intended email", () => {
    // Legacy links without an email param still work for the signed-in user;
    // they just can't benefit from the cross-account mismatch check.
    const result = evaluatePasswordUpdateGuard({
      sessionEmail: "someone@alleatogroup.com",
      intendedEmail: null,
    });

    expect(result.allowed).toBe(true);
    expect(result.kind).toBe("ok");
  });
});
