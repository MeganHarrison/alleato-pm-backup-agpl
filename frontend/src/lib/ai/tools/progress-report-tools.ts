import { tool } from "ai";
import { z } from "zod";
import {
  createProgressReportDraft,
  getProgressReportDetail,
  saveProgressReport,
} from "@/lib/progress-reports/server";
import { createToolGuardrails } from "./guardrails";
import { type ToolTracePayload, withTrace, withWriteTrace } from "./tool-utils";

export type ProgressReportToolsOptions = {
  onTrace?: (trace: ToolTracePayload) => void;
  pinnedProjectId?: number;
};

const reportSectionSchema = z.object({
  pastWeekHighlights: z.string().optional(),
  upcomingWeekActivities: z.string().optional(),
  openItems: z.string().optional(),
  weatherDaysLost: z.number().int().min(0).optional(),
  title: z.string().min(1).optional(),
  status: z.enum(["draft", "ready", "sent"]).optional(),
});

const photoSelectionSchema = z.object({
  projectPhotoId: z.number().int().positive(),
  caption: z.string().optional().nullable(),
});

function reportUrl(projectId: number, reportId: string) {
  return `/${projectId}/progress-reports/${reportId}`;
}

function pdfUrl(projectId: number, reportId: string, disposition: "inline" | "attachment") {
  return `/api/projects/${projectId}/progress-reports/${reportId}/pdf?disposition=${disposition}`;
}

export function createProgressReportTools(
  userId: string,
  options: ProgressReportToolsOptions = {},
) {
  const guardrails = createToolGuardrails(userId, {
    pinnedProjectId: options.pinnedProjectId,
  });

  async function enforceReportAccess(projectId: number) {
    const access = await guardrails.enforceProjectAccess(projectId);
    if (!access.ok) {
      return { ok: false as const, error: access.error };
    }
    return { ok: true as const };
  }

  return {
    createWeeklyProgressReportDraft: tool({
      description:
        "Create a weekly project progress report draft in the application. " +
        "Use when the user asks to create, start, draft, or generate a weekly report/progress report. " +
        "Preview first and ask for confirmation before writing. The draft can later be edited, have photos selected, previewed as PDF, and emailed.",
      inputSchema: z.object({
        projectId: z.number().int().positive().describe("Project ID for the report"),
        weekStart: z.string().optional().describe("Optional ISO date YYYY-MM-DD"),
        weekEnd: z.string().optional().describe("Optional ISO date YYYY-MM-DD"),
        confirmed: z.boolean().default(false),
      }),
      execute: withWriteTrace(
        "createWeeklyProgressReportDraft",
        options,
        async ({ projectId, weekStart, weekEnd, confirmed }) => {
          const access = await enforceReportAccess(projectId);
          if (!access.ok) return { success: false, error: access.error };

          if (!confirmed) {
            return {
              action: "preview",
              message:
                "I can create a weekly progress report draft for this project. Approve this action to write it into Progress Reports.",
              preview: {
                table: "project_progress_reports",
                fields: {
                  project_id: projectId,
                  report_type: "weekly",
                  week_start: weekStart ?? "default last 7 days",
                  week_end: weekEnd ?? "today",
                  status: "draft",
                },
              },
            };
          }

          const result = await createProgressReportDraft({
            projectId,
            userId,
            userEmail: null,
            weekStart,
            weekEnd,
          });

          return {
            success: true,
            message: "Weekly progress report draft is ready.",
            record: {
              id: result.reportId,
              project_id: projectId,
            },
            reportUrl: reportUrl(projectId, result.reportId),
            previewUrl: pdfUrl(projectId, result.reportId, "inline"),
            downloadUrl: pdfUrl(projectId, result.reportId, "attachment"),
            nextSteps: [
              "Review the report sections",
              "Select or caption progress photos",
              "Preview the PDF before emailing it",
            ],
          };
        },
      ),
    }),

    updateProgressReportSections: tool({
      description:
        "Update editable text/status fields on an existing weekly progress report. " +
        "Use when the user asks to change highlights, upcoming activities, open items, weather days, title, or readiness status. " +
        "Preview before writing and ask for approval.",
      inputSchema: z.object({
        projectId: z.number().int().positive(),
        reportId: z.string().uuid(),
        updates: reportSectionSchema,
        confirmed: z.boolean().default(false),
      }),
      execute: withWriteTrace(
        "updateProgressReportSections",
        options,
        async ({ projectId, reportId, updates, confirmed }) => {
          const access = await enforceReportAccess(projectId);
          if (!access.ok) return { success: false, error: access.error };

          if (!confirmed) {
            return {
              action: "preview",
              message:
                "I can update these progress report sections. Approve this action to save the changes.",
              preview: {
                table: "project_progress_reports",
                id: reportId,
                fields: updates,
              },
            };
          }

          const detail = await getProgressReportDetail(projectId, reportId);
          const saved = await saveProgressReport({
            projectId,
            reportId,
            userId,
            updates: {
              title: updates.title ?? detail.report.title,
              status: updates.status ?? detail.report.status,
              week_start: detail.report.week_start,
              week_end: detail.report.week_end,
              construction_start_date: detail.report.construction_start_date,
              scheduled_completion_date: detail.report.scheduled_completion_date,
              past_week_highlights:
                updates.pastWeekHighlights ?? detail.report.past_week_highlights,
              upcoming_week_activities:
                updates.upcomingWeekActivities ?? detail.report.upcoming_week_activities,
              open_items: updates.openItems ?? detail.report.open_items,
              weather_days_lost:
                updates.weatherDaysLost ?? detail.report.weather_days_lost,
              contacts: detail.report.contacts,
              client_recipients: detail.report.client_recipients,
              selected_photos: detail.selectedPhotos.map((photo, index) => ({
                project_photo_id: photo.project_photo_id,
                caption: photo.caption,
                sort_order: index,
              })),
            },
          });

          return {
            success: true,
            message: "Progress report updated.",
            record: {
              id: saved.report.id,
              project_id: saved.report.project_id,
              status: saved.report.status,
            },
            reportUrl: reportUrl(projectId, reportId),
            previewUrl: pdfUrl(projectId, reportId, "inline"),
          };
        },
      ),
    }),

    listProgressReportPhotos: tool({
      description:
        "List available and selected project photos for a progress report. Use before selecting photos or when the user asks which photos can be added.",
      inputSchema: z.object({
        projectId: z.number().int().positive(),
        reportId: z.string().uuid(),
      }),
      execute: withTrace(
        "listProgressReportPhotos",
        options,
        async ({ projectId, reportId }) => {
          const access = await enforceReportAccess(projectId);
          if (!access.ok) return { success: false, error: access.error };

          const detail = await getProgressReportDetail(projectId, reportId);
          const selectedIds = new Set(
            detail.selectedPhotos.map((photo) => photo.project_photo_id),
          );

          return {
            success: true,
            selected: detail.selectedPhotos.map((photo) => ({
              projectPhotoId: photo.project_photo_id,
              title: photo.photo.title,
              caption: photo.caption,
              date: photo.photo.date_taken ?? photo.photo.created_at,
            })),
            available: detail.availablePhotos.map((photo) => ({
              projectPhotoId: photo.id,
              title: photo.title,
              description: photo.description,
              date: photo.date_taken ?? photo.created_at,
              location: photo.location,
              selected: selectedIds.has(photo.id),
            })),
          };
        },
        "Progress report photos could not be loaded. Tell the user exactly what failed and continue with any report details already available.",
      ),
    }),

    selectProgressReportPhotos: tool({
      description:
        "Add, remove, or replace selected photos on an existing weekly progress report. " +
        "Use when the user says to add specific photos, remove photos, or choose photos for the weekly report PDF. Preview before writing.",
      inputSchema: z.object({
        projectId: z.number().int().positive(),
        reportId: z.string().uuid(),
        mode: z.enum(["add", "remove", "replace"]).default("add"),
        photos: z.array(photoSelectionSchema).min(1),
        confirmed: z.boolean().default(false),
      }),
      execute: withWriteTrace(
        "selectProgressReportPhotos",
        options,
        async ({ projectId, reportId, mode, photos, confirmed }) => {
          const access = await enforceReportAccess(projectId);
          if (!access.ok) return { success: false, error: access.error };

          if (!confirmed) {
            return {
              action: "preview",
              message:
                "I can update the photos on this progress report. Approve this action to save the photo selection.",
              preview: {
                table: "project_progress_report_photos",
                id: reportId,
                fields: {
                  mode,
                  photos,
                },
              },
            };
          }

          const detail = await getProgressReportDetail(projectId, reportId);
          const requestedIds = new Set(photos.map((photo) => photo.projectPhotoId));
          const captions = new Map(
            photos.map((photo) => [photo.projectPhotoId, photo.caption ?? null]),
          );
          const availableIds = new Set(detail.availablePhotos.map((photo) => photo.id));
          const invalidIds = [...requestedIds].filter((id) => !availableIds.has(id));

          if (invalidIds.length > 0) {
            return {
              success: false,
              error: `These photo IDs are not available for this project report: ${invalidIds.join(", ")}`,
            };
          }

          const existing = detail.selectedPhotos.map((photo) => ({
            project_photo_id: photo.project_photo_id,
            caption: photo.caption,
          }));
          const requested = photos.map((photo) => ({
            project_photo_id: photo.projectPhotoId,
            caption: photo.caption ?? null,
          }));
          const next =
            mode === "replace"
              ? requested
              : mode === "remove"
              ? existing.filter((photo) => !requestedIds.has(photo.project_photo_id))
              : [
                  ...existing.filter(
                    (photo) => !requestedIds.has(photo.project_photo_id),
                  ),
                  ...requested,
                ];

          const saved = await saveProgressReport({
            projectId,
            reportId,
            userId,
            updates: {
              title: detail.report.title,
              status: detail.report.status,
              week_start: detail.report.week_start,
              week_end: detail.report.week_end,
              construction_start_date: detail.report.construction_start_date,
              scheduled_completion_date: detail.report.scheduled_completion_date,
              past_week_highlights: detail.report.past_week_highlights,
              upcoming_week_activities: detail.report.upcoming_week_activities,
              open_items: detail.report.open_items,
              weather_days_lost: detail.report.weather_days_lost,
              contacts: detail.report.contacts,
              client_recipients: detail.report.client_recipients,
              selected_photos: next.map((photo, index) => ({
                project_photo_id: photo.project_photo_id,
                caption: captions.get(photo.project_photo_id) ?? photo.caption,
                sort_order: index,
              })),
            },
          });

          return {
            success: true,
            message: "Progress report photos updated.",
            record: {
              id: saved.report.id,
              project_id: saved.report.project_id,
              selected_photo_count: saved.selectedPhotos.length,
            },
            reportUrl: reportUrl(projectId, reportId),
            previewUrl: pdfUrl(projectId, reportId, "inline"),
          };
        },
      ),
    }),

    generateProgressReportPdf: tool({
      description:
        "Generate view/download links for an existing weekly progress report PDF. " +
        "Use when the user asks to export, preview, view, download, or open the PDF for a weekly progress report.",
      inputSchema: z.object({
        projectId: z.number().int().positive(),
        reportId: z.string().uuid(),
      }),
      execute: withTrace(
        "generateProgressReportPdf",
        options,
        async ({ projectId, reportId }) => {
          const access = await enforceReportAccess(projectId);
          if (!access.ok) return { success: false, error: access.error };

          const detail = await getProgressReportDetail(projectId, reportId);
          return {
            success: true,
            message:
              "The progress report PDF is ready to preview or download. The PDF route renders the latest saved report content.",
            record: {
              id: detail.report.id,
              project_id: detail.report.project_id,
              title: detail.report.title,
              week_start: detail.report.week_start,
              week_end: detail.report.week_end,
            },
            reportUrl: reportUrl(projectId, reportId),
            previewUrl: pdfUrl(projectId, reportId, "inline"),
            downloadUrl: pdfUrl(projectId, reportId, "attachment"),
          };
        },
        "The progress report PDF link could not be prepared. Tell the user which report could not be checked.",
      ),
    }),
  };
}
