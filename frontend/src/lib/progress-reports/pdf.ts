import type {
  ProgressReportContact,
  ProgressReportPhotoSelection,
  ProgressReportRecord,
} from "@/lib/progress-reports/types";
import {
  buildBrandedDocumentHtml,
  buildBrandedLastPageFooterOverlayPlan,
} from "@/lib/documents/branded-letterhead";
import type { PdfFooterOverlayPlan } from "@/lib/documents/print-layout";
import { parseProgressReportDate } from "@/lib/progress-reports/date-format";

function esc(value: string | number | null | undefined): string {
  if (value == null) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDate(value: string | null | undefined): string {
  const parsed = parseProgressReportDate(value);
  if (!parsed) return "—";
  return parsed.toLocaleDateString("en-US", {
    month: "long",
    day: "2-digit",
    year: "numeric",
  });
}

function formatWeekRange(start: string, end: string): string {
  const startDate = parseProgressReportDate(start);
  const endDate = parseProgressReportDate(end);
  if (!startDate || !endDate) return "—";
  return `${startDate.toLocaleDateString("en-US")} - ${endDate.toLocaleDateString("en-US")}`;
}

function bulletLines(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.replace(/^[-*•]\s*/, "").trim())
    .filter(Boolean);
}

function renderRichInline(value: string): string {
  return esc(value)
    .replace(/#{1,6}\s+/g, "")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*\*([^*]+)\*/g, "<strong>$1</strong>");
}

export type ProgressReportAudience = "client" | "internal";
export type ProgressReportLength = "detailed" | "brief";
export interface ProgressReportView {
  audience: ProgressReportAudience;
  length: ProgressReportLength;
}
export const DEFAULT_PROGRESS_REPORT_VIEW: ProgressReportView = {
  audience: "client",
  length: "detailed",
};

// Brief mode keeps each bullet to a single, scannable line — the condensed
// register the report used before. Trim at a sentence boundary near the cap so
// the line stays grammatical, then hard-cap as a fallback.
const BRIEF_LINE_CHARS = 120;
function briefLine(line: string): string {
  const text = line.replace(/\*\*/g, "").trim();
  if (text.length <= BRIEF_LINE_CHARS) return line;
  const window = text.slice(0, BRIEF_LINE_CHARS);
  const lastStop = Math.max(window.lastIndexOf(". "), window.lastIndexOf("; "));
  if (lastStop > 60) return text.slice(0, lastStop + 1);
  const lastSpace = window.lastIndexOf(" ");
  return `${text.slice(0, lastSpace > 60 ? lastSpace : BRIEF_LINE_CHARS).trim()}…`;
}

function renderBulletSection(title: string, value: string, length: ProgressReportLength = "detailed") {
  const lines = bulletLines(value).map((line) => (length === "brief" ? briefLine(line) : line));
  return `
    <section class="section">
      <h2>${esc(title)}</h2>
      ${
        lines.length > 0
          ? `<ul>${lines.map((line) => `<li>${renderRichInline(line)}</li>`).join("")}</ul>`
          : `<p class="empty">No content added yet.</p>`
      }
    </section>
  `;
}

function renderSummaryContact(contact: ProgressReportContact) {
  return `
    <div class="summary-contact">
      <span class="summary-contact-role">${esc(contact.role || "Project Team")}</span>
      <span class="summary-contact-name">${esc(contact.name || "—")}</span>
      ${contact.email ? `<span>${esc(contact.email)}</span>` : ""}
      ${contact.phone ? `<span>${esc(contact.phone)}</span>` : ""}
    </div>
  `;
}

function renderPhoto(photo: ProgressReportPhotoSelection) {
  const takenOn = formatDate(photo.photo.date_taken ?? photo.photo.created_at);
  const caption = photo.caption || photo.photo.description || photo.photo.title;

  return `
    <figure class="photo-card">
      <div class="photo-frame">
        <img src="${esc(photo.photo.file_url)}" alt="${esc(photo.photo.title)}" />
      </div>
      <figcaption>
        <div class="photo-title">${esc(photo.photo.title)}</div>
        <div class="photo-meta">${esc(takenOn)}${photo.photo.location ? ` · ${esc(photo.photo.location)}` : ""}</div>
        ${caption ? `<div class="photo-caption">${esc(caption)}</div>` : ""}
      </figcaption>
    </figure>
  `;
}

export function buildProgressReportHtml({
  project,
  report,
  selectedPhotos,
  view = DEFAULT_PROGRESS_REPORT_VIEW,
}: {
  project: {
    name: string | null;
    project_number: string | null;
    address: string | null;
  };
  report: ProgressReportRecord;
  selectedPhotos: ProgressReportPhotoSelection[];
  view?: ProgressReportView;
}): string {
  const { audience, length } = view;
  const title = project.name ? `${project.name} Progress Report` : report.title;
  const addressLine = project.address;
  const weekRange = formatWeekRange(report.week_start, report.week_end);
  const contacts = report.contacts.length > 0 ? report.contacts : [];

  const bodyHtml = `
    <style>
    .dates-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px 18px;
      margin: 18px 0 22px;
      padding: 16px 18px;
      border: 1px solid #d7d2cc;
      background: #f4f2ef;
    }
    .dates-grid div { min-width: 0; }
    .dates-grid .team-summary {
      grid-column: 1 / -1;
      margin-top: 4px;
      padding-top: 14px;
      border-top: 1px solid #d7d2cc;
    }
    .label {
      display: block;
      margin-bottom: 2px;
      font-size: 11px;
      font-weight: 700;
      color: #55514c;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }
    .value {
      font-size: 14px;
      color: #2d2c2a;
    }
    .summary-contacts {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px 14px;
      margin-top: 8px;
    }
    .summary-contact {
      min-width: 0;
      color: #5f5b56;
      font-size: 10px;
      line-height: 1.35;
    }
    .summary-contact span {
      display: block;
      overflow-wrap: anywhere;
    }
    .summary-contact-role {
      color: #55514c;
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }
    .summary-contact-name {
      color: #242424;
      font-size: 11px;
      font-weight: 700;
    }
    .section {
      margin-bottom: 20px;
      page-break-inside: avoid;
    }
    .section h2 {
      margin: 0 0 10px;
      padding-bottom: 6px;
      border-bottom: 1px solid #d7d2cc;
      font-size: 16px;
      color: #2d2c2a;
    }
    .section ul {
      margin: 0;
      padding-left: 18px;
    }
    .section li {
      margin-bottom: 6px;
    }
    .section strong {
      font-weight: 700;
      color: #242424;
    }
    .empty {
      color: #68645f;
      margin: 0;
    }
    .weather {
      font-size: 14px;
      font-weight: 600;
    }
    .photo-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 16px;
    }
    .photo-card {
      margin: 0;
      border: 1px solid #d7d2cc;
      background: #ffffff;
    }
    .photo-frame {
      height: 220px;
      overflow: hidden;
      background: #efedea;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .photo-frame img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    figcaption {
      padding: 10px 12px 12px;
    }
    .photo-title {
      font-weight: 700;
      margin-bottom: 2px;
    }
    .photo-meta {
      color: #68645f;
      font-size: 11px;
      margin-bottom: 6px;
    }
    .photo-caption {
      color: #3f3c38;
      font-size: 12px;
    }
    </style>

    <section class="dates-grid">
      <div>
        <span class="label">Construction Start Date</span>
        <span class="value">${esc(formatDate(report.construction_start_date))}</span>
      </div>
      <div>
        <span class="label">Scheduled Substantial Completion</span>
        <span class="value">${esc(formatDate(report.scheduled_completion_date))}</span>
      </div>
      ${
        contacts.length > 0
          ? `<div class="team-summary">
              <span class="label">Project Team Contacts</span>
              <div class="summary-contacts">${contacts.slice(0, 6).map(renderSummaryContact).join("")}</div>
            </div>`
          : ""
      }
    </section>

    ${renderBulletSection("1. Past Week’s Highlights", report.past_week_highlights, length)}
    ${renderBulletSection("2. Upcoming Week’s Activities", report.upcoming_week_activities, length)}
    ${renderBulletSection("3. Open Items", report.open_items, length)}

    ${
      audience === "internal" && (report.internal_notes ?? "").trim()
        ? renderBulletSection("Internal Notes (not shared with client)", report.internal_notes as string, length)
        : ""
    }

    <section class="section">
      <h2>4. Days Lost Due to Weather This Week</h2>
      <div class="weather">${esc(report.weather_days_lost)} day${report.weather_days_lost === 1 ? "" : "s"}</div>
    </section>

    <section class="section">
      <h2>5. Progress Mark-up / Photos</h2>
      ${
        selectedPhotos.length > 0
          ? `<div class="photo-grid">${selectedPhotos.map(renderPhoto).join("")}</div>`
          : `<p class="empty">No progress photos selected for this report yet.</p>`
      }
    </section>
  `;

  return buildBrandedDocumentHtml({
    title,
    subtitle: addressLine || undefined,
    detail: `Week of ${weekRange}`,
    bodyHtml,
    renderFooterInBody: false,
  });
}

function formatFooterGeneratedAt(value: Date): string {
  return value.toLocaleDateString("en-US", {
    month: "numeric",
    day: "numeric",
    year: "numeric",
  });
}

export function buildProgressReportPdfLayout({
  project,
  report,
  selectedPhotos,
  view = DEFAULT_PROGRESS_REPORT_VIEW,
  generatedAt = new Date(),
}: {
  project: {
    name: string | null;
    project_number: string | null;
    address: string | null;
  };
  report: ProgressReportRecord;
  selectedPhotos: ProgressReportPhotoSelection[];
  view?: ProgressReportView;
  generatedAt?: Date;
}): {
  html: string;
  footerOverlayPlan: PdfFooterOverlayPlan;
} {
  const documentTitle = project.name
    ? `${project.name} Progress Report`
    : report.title;

  return {
    html: buildProgressReportHtml({ project, report, selectedPhotos, view }),
    footerOverlayPlan: buildBrandedLastPageFooterOverlayPlan({
      documentTitle,
      generatedAtLabel: formatFooterGeneratedAt(generatedAt),
    }),
  };
}

export function buildProgressReportEmailHtml({
  projectName,
  weekStart,
  weekEnd,
  senderName,
  note,
}: {
  projectName: string;
  weekStart: string;
  weekEnd: string;
  senderName: string;
  note?: string | null;
}) {
  return `
    <div style="font-family: Arial, Helvetica, sans-serif; color: #111827; line-height: 1.5;">
      <p style="margin: 0 0 12px;">Hello,</p>
      <p style="margin: 0 0 12px;">
        ${esc(senderName)} sent the latest weekly progress report for ${esc(projectName)}
        covering ${esc(formatWeekRange(weekStart, weekEnd))}.
      </p>
      ${
        note
          ? `<p style="margin: 0 0 12px;"><strong>Note:</strong> ${esc(note)}</p>`
          : ""
      }
      <p style="margin: 0;">The PDF report is attached.</p>
    </div>
  `;
}
