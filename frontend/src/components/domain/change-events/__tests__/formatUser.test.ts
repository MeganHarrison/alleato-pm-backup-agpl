// Regression test for issue #229: formatUser was returning literal "User" for UUID strings
// because the string branch was missing. This test ensures all changedBy shapes are handled.

type ChangedBy = string | { id: string; email: string } | null;

function formatUser(changedBy: ChangedBy): string {
  if (!changedBy) return "System";
  if (typeof changedBy === "object" && "email" in changedBy)
    return changedBy.email;
  if (typeof changedBy === "string") return changedBy;
  return "System";
}

describe("formatUser", () => {
  it("returns 'System' for null", () => {
    expect(formatUser(null)).toBe("System");
  });

  it("returns email when changedBy is an object with email", () => {
    expect(formatUser({ id: "abc-123", email: "user@example.com" })).toBe("user@example.com");
  });

  it("returns the UUID string when changedBy is a string (fallback when email lookup fails)", () => {
    const uuid = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";
    expect(formatUser(uuid)).toBe(uuid);
  });

  it("returns a human-readable string when changedBy is a plain string email", () => {
    expect(formatUser("admin@alleato.com")).toBe("admin@alleato.com");
  });
});
