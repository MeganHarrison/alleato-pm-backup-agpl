import {
  isPatternCEntityType,
  PATTERN_C_ENTITY_CONFIG,
} from "../pattern-c-entity-types";

describe("Pattern C client-safe entity contract", () => {
  it("recognizes every registered attachment entity without loading the server pipeline", () => {
    const registeredTypes = Object.keys(PATTERN_C_ENTITY_CONFIG);

    expect(registeredTypes).toContain("meeting_item");
    expect(registeredTypes.every(isPatternCEntityType)).toBe(true);
    expect(isPatternCEntityType("unsupported_entity")).toBe(false);
    expect(isPatternCEntityType("constructor")).toBe(false);
  });
});
