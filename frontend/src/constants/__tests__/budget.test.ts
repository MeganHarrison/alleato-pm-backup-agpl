import { UNITS_OF_MEASURE, normalizeUomCode } from "@/constants/budget";

describe("UNITS_OF_MEASURE canonical casing", () => {
  it("stores every UOM code in uppercase", () => {
    // The FK/UOM edit-prefill guard depends on the canonical codes being
    // uppercase. If a lowercase code is ever added here, an edit form that
    // seeds a Select from a stored uppercase value would silently render blank.
    for (const uom of UNITS_OF_MEASURE) {
      expect(uom.code).toBe(uom.code.toUpperCase());
    }
  });
});

describe("normalizeUomCode", () => {
  it("resolves a lowercase stored value to its canonical uppercase code", () => {
    // Regression: the original-budget edit modal used lowercase options
    // ("ea"), while create forms store uppercase ("EA"), so the saved value
    // never matched an option and the UOM select rendered blank on edit.
    expect(normalizeUomCode("ea")).toBe("EA");
    expect(normalizeUomCode("sf")).toBe("SF");
    expect(normalizeUomCode("Ls")).toBe("LS");
  });

  it("passes through an already-canonical code unchanged", () => {
    expect(normalizeUomCode("EA")).toBe("EA");
    expect(normalizeUomCode("TON")).toBe("TON");
  });

  it("trims surrounding whitespace", () => {
    expect(normalizeUomCode("  sf  ")).toBe("SF");
  });

  it("returns an empty string for null / undefined / blank", () => {
    expect(normalizeUomCode(null)).toBe("");
    expect(normalizeUomCode(undefined)).toBe("");
    expect(normalizeUomCode("   ")).toBe("");
  });

  it("preserves an unknown/custom code rather than dropping it", () => {
    expect(normalizeUomCode("CUSTOM")).toBe("CUSTOM");
  });
});
