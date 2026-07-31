import { drawingMarkupCursor } from "../drawing-markup-cursor";

describe("drawingMarkupCursor", () => {
  it("keeps the normal cursor only when no markup tool is active", () => {
    expect(drawingMarkupCursor("idle", "#ef4444")).toBe("default");
  });

  it("uses the pan-grab cursor for selection and crosshair only for geometry", () => {
    expect(drawingMarkupCursor("select", "#ef4444")).toBe("grab");
    expect(drawingMarkupCursor("rectangle", "#ef4444")).toBe("crosshair");
  });

  it("uses one tool icon for pen and does not add a second crosshair", () => {
    const pen = drawingMarkupCursor("pen", "#ef4444");

    expect(pen).toContain(") 12 12, default");
    expect(pen).toContain("%23ef4444");
    expect(pen).not.toContain("crosshair");
  });

  it("falls back to the product accent when a cursor color is invalid", () => {
    expect(drawingMarkupCursor("pen", "not-a-color")).toContain("%23e76f22");
  });

  it("keeps the link cursor as a clean, background-free glyph", () => {
    const link = drawingMarkupCursor("link", "#ef4444");

    expect(link).not.toContain("<circle");
    expect(link).toContain("%2324262a");
  });
});
