import {
  normalizeRoleMemberIds,
  planRoleMemberUpdate,
  roleMemberSetsMatch,
} from "./project-role-members";

describe("project role member updates", () => {
  it("normalizes role member IDs without duplicates or blank values", () => {
    expect(normalizeRoleMemberIds(["p1", " p2 ", "p1", "", null])).toEqual([
      "p1",
      "p2",
    ]);
  });

  it("rejects non-array member payloads", () => {
    expect(() => normalizeRoleMemberIds("p1")).toThrow(
      "member_person_ids must be an array",
    );
  });

  it("plans a non-destructive diff for mixed remove and add updates", () => {
    expect(planRoleMemberUpdate(["p2", "p3"], ["p1", "p2"])).toEqual({
      requestedIds: ["p2", "p3"],
      existingIds: ["p1", "p2"],
      idsToAdd: ["p3"],
      idsToRemove: ["p1"],
    });
  });

  it("verifies persisted role members by set equality", () => {
    expect(roleMemberSetsMatch(["p2", "p3"], ["p3", "p2"])).toBe(true);
    expect(roleMemberSetsMatch(["p2", "p3"], ["p2"])).toBe(false);
  });
});
