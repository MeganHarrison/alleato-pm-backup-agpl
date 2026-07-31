import { buildProgressReportPdfLayout } from "@/lib/progress-reports/pdf";
import type { ProgressReportRecord } from "@/lib/progress-reports/types";

const baseReport: ProgressReportRecord = {
  id: "report-1",
  project_id: 876,
  title: "Exol Morrisville Progress Report",
  week_start: "2026-06-24",
  week_end: "2026-07-01",
  construction_start_date: "2026-03-30",
  scheduled_completion_date: "2027-01-14",
  weather_days_lost: 0,
  past_week_highlights: "- Received permit",
  upcoming_week_activities: "- Mobilize construction",
  open_items: "- Await owner approval",
  selected_photo_ids: [],
  contacts: [],
  created_at: "2026-07-06T10:00:00.000Z",
  updated_at: "2026-07-06T10:00:00.000Z",
};

describe("buildProgressReportPdfLayout", () => {
  it("returns the shared footer overlay plan used by progress report exports", () => {
    const layout = buildProgressReportPdfLayout({
      project: {
        name: "Exol Morrisville",
        project_number: "2300",
        address: "2300 South Pennsylvania Ave",
      },
      report: baseReport,
      selectedPhotos: [],
      generatedAt: new Date("2026-07-06T12:00:00.000Z"),
    });

    expect(layout.html).toContain("Exol Morrisville Progress Report");
    expect(layout.footerOverlayPlan.marginBottom).toBe("1.35in");
    expect(layout.footerOverlayPlan.defaultVariant).toMatchObject({
      kind: "simple",
      companyName: "Alleato Group",
      documentTitle: "Exol Morrisville Progress Report",
      generatedAtLabel: "7/6/2026",
    });
    expect(layout.footerOverlayPlan.lastPageVariant).toMatchObject({
      kind: "detailed",
      companyName: "Alleato Group",
    });
  });
});
