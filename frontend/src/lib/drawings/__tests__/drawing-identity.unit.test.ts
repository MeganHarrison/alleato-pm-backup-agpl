import { getDrawingUploadDetectedMetadata } from "@/lib/drawings/drawing-identity";

describe("getDrawingUploadDetectedMetadata", () => {
  it("detects drawing number, title, revision, and discipline from filenames", () => {
    expect(getDrawingUploadDetectedMetadata("A101 First Floor Plan Rev 2.pdf")).toMatchObject({
      drawingNumber: "A101",
      title: "First Floor Plan",
      revisionNumber: "2",
      discipline: "Architectural",
      confidence: "high",
      source: "filename",
    });
  });

  it("falls back loudly with low confidence when filename cannot be split", () => {
    expect(getDrawingUploadDetectedMetadata("unknown-sheet.pdf")).toMatchObject({
      drawingNumber: "unknown-sheet",
      title: "unknown-sheet",
      revisionNumber: "A",
      discipline: "",
      confidence: "low",
    });
  });
});
