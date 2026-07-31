import { NextResponse } from "next/server";
import { z } from "zod";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { requireDeveloperApi } from "@/lib/auth/require-developer";
import { getApiRouteUserFromRequest } from "@/lib/supabase/server";
import {
  deleteProgressReport,
  getProgressReportDetail,
  listProjectTeamContacts,
  resolveProgressReportContacts,
  saveProgressReport,
} from "@/lib/progress-reports/server";

const contactSchema = z.object({
  role: z.string(),
  name: z.string(),
  email: z.string(),
  phone: z.string(),
});

const selectedPhotoSchema = z.object({
  project_photo_id: z.number().int().positive(),
  sort_order: z.number().int().nonnegative(),
  caption: z.string().nullable(),
});

const updateSchema = z.object({
  title: z.string().min(1),
  status: z.enum(["draft", "ready", "sent"]),
  week_start: z.string(),
  week_end: z.string(),
  construction_start_date: z.string().nullable(),
  scheduled_completion_date: z.string().nullable(),
  past_week_highlights: z.string(),
  upcoming_week_activities: z.string(),
  open_items: z.string(),
  internal_notes: z.string().nullable().optional(),
  review_status: z.enum(["needs_review", "approved", "sent"]).optional(),
  weather_days_lost: z.number().int().min(0),
  contacts: z.array(contactSchema),
  client_recipients: z.array(z.string()),
  selected_photos: z.array(selectedPhotoSchema),
});

export const GET = withApiGuardrails(
  "projects/[projectId]/progress-reports/[reportId]#GET",
  async ({ request, params }) => {
    const developerGuard = await requireDeveloperApi(request);
    if (developerGuard) return developerGuard;

    const user = await getApiRouteUserFromRequest(request);
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/[projectId]/progress-reports/[reportId]#GET",
        message: "Authentication required.",
      });
    }

    const { projectId, reportId } = await params;
    const numericProjectId = Number.parseInt(projectId, 10);
    if (!Number.isFinite(numericProjectId)) {
      return NextResponse.json(
        { error: "Invalid project ID" },
        { status: 400 },
      );
    }

    const [detail, projectTeamContacts] = await Promise.all([
      getProgressReportDetail(numericProjectId, reportId),
      listProjectTeamContacts(numericProjectId),
    ]);

    return NextResponse.json({
      ...detail,
      report: {
        ...detail.report,
        contacts: resolveProgressReportContacts(
          projectTeamContacts,
          detail.report.contacts,
        ),
      },
    });
  },
);

export const PUT = withApiGuardrails(
  "projects/[projectId]/progress-reports/[reportId]#PUT",
  async ({ request, params }) => {
    const developerGuard = await requireDeveloperApi(request);
    if (developerGuard) return developerGuard;

    const user = await getApiRouteUserFromRequest(request);
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/[projectId]/progress-reports/[reportId]#PUT",
        message: "Authentication required.",
      });
    }

    const { projectId, reportId } = await params;
    const numericProjectId = Number.parseInt(projectId, 10);
    if (!Number.isFinite(numericProjectId)) {
      return NextResponse.json(
        { error: "Invalid project ID" },
        { status: 400 },
      );
    }

    const body = updateSchema.parse(await request.json());
    const [detail, projectTeamContacts] = await Promise.all([
      saveProgressReport({
        projectId: numericProjectId,
        reportId,
        userId: user.id,
        updates: body,
      }),
      listProjectTeamContacts(numericProjectId),
    ]);

    return NextResponse.json({
      ...detail,
      report: {
        ...detail.report,
        contacts: resolveProgressReportContacts(
          projectTeamContacts,
          detail.report.contacts,
        ),
      },
    });
  },
);

export const DELETE = withApiGuardrails(
  "projects/[projectId]/progress-reports/[reportId]#DELETE",
  async ({ request, params }) => {
    const developerGuard = await requireDeveloperApi(request);
    if (developerGuard) return developerGuard;

    const user = await getApiRouteUserFromRequest(request);
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/[projectId]/progress-reports/[reportId]#DELETE",
        message: "Authentication required.",
      });
    }

    const { projectId, reportId } = await params;
    const numericProjectId = Number.parseInt(projectId, 10);
    if (!Number.isFinite(numericProjectId)) {
      return NextResponse.json(
        { error: "Invalid project ID" },
        { status: 400 },
      );
    }

    await deleteProgressReport(numericProjectId, reportId);
    return NextResponse.json({ success: true });
  },
);
