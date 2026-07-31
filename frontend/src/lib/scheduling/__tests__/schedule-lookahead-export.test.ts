import * as XLSX from "xlsx";
import { PDFDocument } from "pdf-lib";
import { createLookaheadPdf, createLookaheadWorkbook } from "../schedule-lookahead-export";

const lookahead = {
  revisionId: "revision-2",
  revisionNumber: 2,
  window: { startDate: "2026-08-03", endDate: "2026-08-16", weeks: 2 as const },
  activities: [{
    sourceTaskId: "task-1",
    name: "Place foundation",
    forecastStartDate: "2026-08-04",
    forecastFinishDate: "2026-08-08",
    constraint: { type: "finish_no_later_than", date: "2026-08-07" },
    dependencies: [{ predecessorSourceId: "task-permit", type: "finish_to_start", lagDays: 1 }],
    submittalRisk: { status: "at_risk" as const, reason: "Concrete mix submittal is overdue." },
  }],
};

describe("schedule lookahead exports", () => {
  it("writes the same revision, window, activity, and risk context to XLSX", () => {
    const bytes = createLookaheadWorkbook(lookahead);
    const workbook = XLSX.read(bytes, { type: "array" });
    const rows = XLSX.utils.sheet_to_json<string[]>(workbook.Sheets.Lookahead, { header: 1 });

    expect(rows).toContainEqual(["Revision", "2"]);
    expect(rows).toContainEqual(["Window", "2026-08-03 to 2026-08-16 (2 weeks)"]);
    expect(rows).toContainEqual(expect.arrayContaining(["Place foundation", "2026-08-04", "2026-08-08", "finish_no_later_than: 2026-08-07", "finish_to_start +1d", "Concrete mix submittal is overdue."]));
  });

  it("creates a readable PDF for the exact selected lookahead", async () => {
    const bytes = await createLookaheadPdf(lookahead);
    const document = await PDFDocument.load(bytes);

    expect(document.getPageCount()).toBeGreaterThan(0);
    expect(new TextDecoder().decode(bytes.slice(0, 4))).toBe("%PDF");
  });
});
