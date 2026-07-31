import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import * as XLSX from "xlsx";

export type ExportableLookahead = {
  revisionId: string;
  revisionNumber: number;
  window: { startDate: string; endDate: string; weeks: 2 | 3 | 6 };
  activities: Array<{
    sourceTaskId: string;
    name: string;
    forecastStartDate: string | null;
    forecastFinishDate: string | null;
    constraint: { type: string; date: string } | null;
    dependencies: Array<{ predecessorSourceId: string; type: string; lagDays: number }>;
    submittalRisk: { status: "clear" | "at_risk"; reason?: string };
  }>;
};

function windowLabel(lookahead: ExportableLookahead): string {
  return `${lookahead.window.startDate} to ${lookahead.window.endDate} (${lookahead.window.weeks} weeks)`;
}

function dependenciesLabel(activity: ExportableLookahead["activities"][number]): string {
  return activity.dependencies.map((dependency) => `${dependency.type} ${dependency.lagDays >= 0 ? "+" : ""}${dependency.lagDays}d`).join("; ");
}

function constraintLabel(activity: ExportableLookahead["activities"][number]): string {
  return activity.constraint ? `${activity.constraint.type}: ${activity.constraint.date}` : "";
}

export function createLookaheadWorkbook(lookahead: ExportableLookahead): ArrayBuffer {
  const rows = [
    ["Schedule lookahead"],
    ["Revision", String(lookahead.revisionNumber)],
    ["Revision ID", lookahead.revisionId],
    ["Window", windowLabel(lookahead)],
    [],
    ["Activity", "Forecast start", "Forecast finish", "Constraint", "Dependencies", "Submittal risk"],
    ...lookahead.activities.map((activity) => [
      activity.name,
      activity.forecastStartDate ?? "",
      activity.forecastFinishDate ?? "",
      constraintLabel(activity),
      dependenciesLabel(activity),
      activity.submittalRisk.reason ?? "",
    ]),
  ];
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet["!cols"] = [
    { wch: 30 }, { wch: 16 }, { wch: 16 }, { wch: 28 }, { wch: 25 }, { wch: 45 },
  ];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Lookahead");
  return XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
}

export async function createLookaheadPdf(lookahead: ExportableLookahead): Promise<Uint8Array> {
  const document = await PDFDocument.create();
  const font = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  let page = document.addPage();
  let y = page.getHeight() - 48;
  const drawLine = (text: string, emphasize = false) => {
    if (y < 52) {
      page = document.addPage();
      y = page.getHeight() - 48;
    }
    page.drawText(text.slice(0, 125), { x: 42, y, size: emphasize ? 13 : 9, font: emphasize ? bold : font, color: rgb(0.12, 0.12, 0.12) });
    y -= emphasize ? 22 : 14;
  };

  drawLine("Schedule lookahead", true);
  drawLine(`Published revision ${lookahead.revisionNumber}`);
  drawLine(`Window: ${windowLabel(lookahead)}`);
  y -= 6;
  for (const activity of lookahead.activities) {
    drawLine(activity.name, true);
    drawLine(`Forecast: ${activity.forecastStartDate ?? "—"} to ${activity.forecastFinishDate ?? "—"}`);
    if (activity.constraint) drawLine(`Constraint: ${constraintLabel(activity)}`);
    if (activity.dependencies.length) drawLine(`Dependencies: ${dependenciesLabel(activity)}`);
    if (activity.submittalRisk.status === "at_risk") drawLine(`Submittal risk: ${activity.submittalRisk.reason ?? "At risk"}`);
    y -= 4;
  }
  return document.save();
}
