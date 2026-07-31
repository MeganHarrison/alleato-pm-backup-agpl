/**
 * Regression test for: budget POST "Cost type is required" bug.
 *
 * Root cause: the budget-codes API returns `costTypeId` as a UUID.
 * The modal sends that UUID as `costType` in the POST payload.
 * The POST route was looking up the value in `cost_code_types.code` (which stores "L", "M", "S"),
 * so a UUID never matched → `resolvedCostTypeId` was null → NOT NULL constraint violation → "Cost type is required."
 *
 * Fix: UUIDs are detected and passed through unchanged; only letter codes are resolved via lookup.
 */

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Mirrors the resolution logic in the budget POST route */
function resolveCostTypeId(
  costTypeId: string | null,
  codeToUuidMap: Map<string, string>,
): string | null {
  if (!costTypeId) return null;
  if (UUID_REGEX.test(costTypeId)) return costTypeId;
  return codeToUuidMap.get(costTypeId) ?? null;
}

describe("budget POST cost-type resolution", () => {
  const LABOR_UUID = "11111111-2222-3333-4444-555555555555";
  const codeToUuidMap = new Map([["L", LABOR_UUID]]);

  it("passes through a UUID unchanged (client already resolved)", () => {
    const result = resolveCostTypeId(LABOR_UUID, codeToUuidMap);
    expect(result).toBe(LABOR_UUID);
  });

  it("resolves a letter code to its UUID via the map", () => {
    const result = resolveCostTypeId("L", codeToUuidMap);
    expect(result).toBe(LABOR_UUID);
  });

  it("returns null for an unknown letter code (map miss)", () => {
    const result = resolveCostTypeId("Z", codeToUuidMap);
    expect(result).toBeNull();
  });

  it("returns null when costTypeId is null", () => {
    const result = resolveCostTypeId(null, codeToUuidMap);
    expect(result).toBeNull();
  });

  it("does NOT look up a UUID in the letter-code map (regression guard)", () => {
    // This was the original bug: UUID was passed to codeToUuidMap.get() which always missed
    const mapWithoutUuid = new Map([["L", LABOR_UUID]]);
    // Should return the UUID itself, not null
    const result = resolveCostTypeId(LABOR_UUID, mapWithoutUuid);
    expect(result).toBe(LABOR_UUID);
    expect(result).not.toBeNull();
  });

  it("UUID detection is case-insensitive", () => {
    const upperUUID = LABOR_UUID.toUpperCase();
    expect(UUID_REGEX.test(upperUUID)).toBe(true);
    const result = resolveCostTypeId(upperUUID, codeToUuidMap);
    expect(result).toBe(upperUUID);
  });
});
