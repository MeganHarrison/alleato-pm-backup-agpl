import { isAnnotationType, isPdfPageMarkupData } from "../annotation-contract";

describe("drawing annotation contract", () => {
  it("accepts only supported annotation types", () => {
    expect(isAnnotationType("rectangle")).toBe(true);
    expect(isAnnotationType("cloud")).toBe(true);
    expect(isAnnotationType("polygon")).toBe(false);
  });

  it("requires a non-array page-percent geometry object", () => {
    expect(isPdfPageMarkupData({ page_percent: true, start: { x: 1, y: 2 } })).toBe(true);
    expect(isPdfPageMarkupData({ start: { x: 1, y: 2 } })).toBe(false);
    expect(isPdfPageMarkupData([{ page_percent: true }])).toBe(false);
    expect(isPdfPageMarkupData(null)).toBe(false);
  });
});
