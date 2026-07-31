import { SMART_GROUPS } from "@/features/documents/smart-groups";

describe("smart-groups", () => {
  it("includes an All group with no filter and no reclassify", () => {
    const all = SMART_GROUPS.find((g) => g.id === "all");
    expect(all).toBeDefined();
    expect(all!.filter).toEqual({});
    expect(all!.reclassifyTo).toBeNull();
  });

  it("maps Drawings to the Drawing category and is a drop target", () => {
    const drawings = SMART_GROUPS.find((g) => g.id === "drawings");
    expect(drawings!.filter.category).toBe("Drawing");
    expect(drawings!.reclassifyTo).toBe("Drawing");
    // document_type is intentionally unused (sparsely populated in the data).
    expect(drawings!.filter.document_type).toBeUndefined();
  });

  it("Commitments is a search-based group (no category) and not a drop target", () => {
    const commitments = SMART_GROUPS.find((g) => g.id === "commitments");
    expect(commitments!.search).toBe("commitment");
    expect(commitments!.filter).toEqual({});
    expect(commitments!.reclassifyTo).toBeNull();
  });

  it("Emails group filters by type=email and is not a drop target", () => {
    const emails = SMART_GROUPS.find((g) => g.id === "emails");
    expect(emails!.filter.type).toBe("email");
    expect(emails!.reclassifyTo).toBeNull();
  });

  it("Meetings group filters by type=meeting and is not a drop target", () => {
    const meetings = SMART_GROUPS.find((g) => g.id === "meetings");
    expect(meetings!.filter.type).toBe("meeting");
    expect(meetings!.reclassifyTo).toBeNull();
  });

  it("every group has a unique id", () => {
    const ids = SMART_GROUPS.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
