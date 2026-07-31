import {
  buildSubmittalExportFilename,
  COVER_SHEET_EXPORT_ITEM,
  isPdfPacketPartSupported,
  parseSelectedSubmittalExportItems,
} from "../export-packet";

describe("submittal export packet helpers", () => {
  it("defaults to the cover sheet when no explicit packet items are selected", () => {
    const params = new URLSearchParams();
    expect(parseSelectedSubmittalExportItems(params)).toEqual([
      COVER_SHEET_EXPORT_ITEM,
    ]);
  });

  it("preserves packet item order while removing duplicates", () => {
    const params = new URLSearchParams();
    params.append("item", COVER_SHEET_EXPORT_ITEM);
    params.append("item", "doc-1");
    params.append("item", "doc-1");
    params.append("item", "doc-2");

    expect(parseSelectedSubmittalExportItems(params)).toEqual([
      COVER_SHEET_EXPORT_ITEM,
      "doc-1",
      "doc-2",
    ]);
  });

  it("accepts supported PDF packet file types", () => {
    expect(
      isPdfPacketPartSupported({
        fileName: "submittal.pdf",
        mimeType: "application/pdf",
      }),
    ).toBe(true);
    expect(
      isPdfPacketPartSupported({
        fileName: "photo.png",
        mimeType: "image/png",
      }),
    ).toBe(true);
    expect(
      isPdfPacketPartSupported({
        fileName: "markup.jpeg",
        mimeType: null,
      }),
    ).toBe(true);
  });

  it("rejects unsupported packet file types", () => {
    expect(
      isPdfPacketPartSupported({
        fileName: "notes.docx",
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      }),
    ).toBe(false);
  });

  it("builds a stable export file name", () => {
    expect(
      buildSubmittalExportFilename({
        submittalNumber: "05-001",
        title: "Structural Steel",
      }),
    ).toBe("05-001-Structural-Steel.pdf");
  });
});
