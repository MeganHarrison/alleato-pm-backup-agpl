import { clampSplit } from "@/features/documents/use-resizable-split";

describe("clampSplit", () => {
  it("returns the ratio unchanged when within bounds", () => {
    expect(clampSplit(0.5, { containerWidth: 1000, minPx: 120 })).toBe(0.5);
  });

  it("clamps so the left pane keeps the min width", () => {
    expect(clampSplit(0.01, { containerWidth: 1000, minPx: 120 })).toBeCloseTo(0.12, 5);
  });

  it("clamps so the right pane keeps the min width", () => {
    expect(clampSplit(0.99, { containerWidth: 1000, minPx: 120 })).toBeCloseTo(0.88, 5);
  });

  it("honors a layout-specific maximum ratio", () => {
    expect(
      clampSplit(0.99, {
        containerWidth: 1000,
        minPx: 120,
        maxRatio: 0.72,
      }),
    ).toBeCloseTo(0.72, 5);
  });

  it("never returns <0 or >1 for tiny containers", () => {
    const r = clampSplit(0.5, { containerWidth: 100, minPx: 120 });
    expect(r).toBeGreaterThanOrEqual(0);
    expect(r).toBeLessThanOrEqual(1);
  });
});
