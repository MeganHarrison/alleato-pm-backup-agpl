import { serviceDb } from "@/lib/supabase/service-db";
import {
  mergeProgressReportContacts,
  resolveProgressReportContacts,
} from "@/lib/progress-reports/contacts";
import {
  buildProgressReportDraft,
  defaultWeeklyReportRange,
} from "@/lib/progress-reports/report-builder";
import type { Json } from "@/types/database.types";
import type {
  ProgressReportContact,
  ProgressReportDetailResponse,
  ProgressReportAllListItem,
  ProgressReportListItem,
  ProgressReportRecord,
  ProgressReportSourceSnapshot,
  ProgressReportPhotoRecord,
  ProgressReportPhotoSelection,
  ProgressReportVersion,
} from "@/lib/progress-reports/types";

/**
 * Progress report persistence/service layer.
 *
 * This file owns the database contract for progress reports:
 * - reads/writes `project_progress_reports`
 * - manages selected photo links in `project_progress_report_photos`
 * - gathers project team contacts for the report contact block
 * - calls the deterministic builder to create the first draft content
 *
 * AI enrichment is intentionally not owned here. API routes may call
 * `generateProgressReportSections()` after `createProgressReportDraft()`, but
 * this service keeps draft creation deterministic and retry-safe.
 */

// Sentinel user ID used by cron jobs. When `updated_by` matches this value the
// draft has never been touched by a human and is safe to auto-refresh with
// fresh source data on each daily cron run.
export const PROGRESS_REPORT_CRON_USER_ID =
  "00000000-0000-0000-0000-000000000001";

// Raw Supabase row shapes used before coercing JSON/unknown columns into the
// stricter progress-report API types consumed by pages and route handlers.
interface ProgressReportRow {
  id: string;
  project_id: number;
  title: string;
  report_type: "weekly";
  status: "draft" | "ready" | "sent";
  week_start: string;
  week_end: string;
  construction_start_date: string | null;
  scheduled_completion_date: string | null;
  past_week_highlights: string;
  upcoming_week_activities: string;
  open_items: string;
  internal_notes?: string | null;
  review_status?: "needs_review" | "approved" | "sent" | null;
  version?: number | null;
  weather_days_lost: number;
  contacts: unknown;
  client_recipients: string[] | null;
  source_snapshot: unknown;
  sent_at: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

interface ProgressReportPhotoLinkRow {
  id: string;
  progress_report_id: string;
  project_id: number;
  project_photo_id: number;
  sort_order: number;
  caption: string | null;
  created_at: string | null;
}

interface ProjectPhotoRow {
  id: number;
  title: string;
  description: string | null;
  file_url: string;
  date_taken: string | null;
  created_at: string | null;
  location: string | null;
  tags: string[] | null;
}

interface ProjectRoleRow {
  id: string;
  role_name: string;
  display_order: number | null;
}

interface ProjectRoleMemberRow {
  project_role_id: string;
  person_id: string;
}

interface ProjectTeamPersonRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone_business: string | null;
  phone_mobile: string | null;
  job_title: string | null;
}

interface ProgressReportProjectRow {
  id: number;
  name: string | null;
  project_number: string | null;
}

// JSON columns are not trusted at runtime. These parsers keep corrupt or older
// rows from crashing the editor/list pages and provide conservative defaults.
function parseContacts(value: unknown): ProgressReportContact[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const entry = item as Record<string, unknown>;
      return {
        role: typeof entry.role === "string" ? entry.role : "",
        name: typeof entry.name === "string" ? entry.name : "",
        email: typeof entry.email === "string" ? entry.email : "",
        phone: typeof entry.phone === "string" ? entry.phone : "",
      };
    })
    .filter((item): item is ProgressReportContact => item !== null);
}

function parseSourceSnapshot(value: unknown): ProgressReportSourceSnapshot {
  if (!value || typeof value !== "object") {
    return {
      generatedAt: new Date().toISOString(),
      strategy: "unknown",
      meetings: [],
      emails: [],
      photos: [],
    };
  }

  const snapshot = value as Record<string, unknown>;
  return {
    generatedAt:
      typeof snapshot.generatedAt === "string"
        ? snapshot.generatedAt
        : new Date().toISOString(),
    strategy:
      typeof snapshot.strategy === "string" ? snapshot.strategy : "unknown",
    meetings: Array.isArray(snapshot.meetings)
      ? snapshot.meetings
          .map((item) => {
            if (!item || typeof item !== "object") return null;
            const entry = item as Record<string, unknown>;
            return {
              id: typeof entry.id === "string" ? entry.id : "",
              title:
                typeof entry.title === "string"
                  ? entry.title
                  : "Untitled meeting",
              date: typeof entry.date === "string" ? entry.date : null,
              summary: typeof entry.summary === "string" ? entry.summary : "",
            };
          })
          .filter(
            (item): item is ProgressReportSourceSnapshot["meetings"][number] =>
              item !== null,
          )
      : [],
    emails: Array.isArray(snapshot.emails)
      ? snapshot.emails
          .map((item) => {
            if (!item || typeof item !== "object") return null;
            const entry = item as Record<string, unknown>;
            return {
              id: typeof entry.id === "number" ? entry.id : 0,
              subject:
                typeof entry.subject === "string"
                  ? entry.subject
                  : "Untitled email",
              date: typeof entry.date === "string" ? entry.date : null,
              preview: typeof entry.preview === "string" ? entry.preview : "",
            };
          })
          .filter(
            (item): item is ProgressReportSourceSnapshot["emails"][number] =>
              item !== null,
          )
      : [],
    photos: Array.isArray(snapshot.photos)
      ? snapshot.photos
          .map((item) => {
            if (!item || typeof item !== "object") return null;
            const entry = item as Record<string, unknown>;
            return {
              id: typeof entry.id === "number" ? entry.id : 0,
              title:
                typeof entry.title === "string"
                  ? entry.title
                  : "Untitled photo",
              date: typeof entry.date === "string" ? entry.date : null,
              file_url:
                typeof entry.file_url === "string" ? entry.file_url : "",
            };
          })
          .filter(
            (item): item is ProgressReportSourceSnapshot["photos"][number] =>
              item !== null,
          )
      : [],
  };
}

function mapPhoto(photo: ProjectPhotoRow): ProgressReportPhotoRecord {
  return {
    id: photo.id,
    title: photo.title,
    description: photo.description,
    file_url: photo.file_url,
    date_taken: photo.date_taken,
    created_at: photo.created_at,
    location: photo.location,
    tags: photo.tags,
  };
}

function mapReport(row: ProgressReportRow): ProgressReportRecord {
  return {
    ...row,
    review_status:
      row.review_status ?? (row.status === "sent" ? "sent" : "needs_review"),
    version: row.version ?? 1,
    contacts: parseContacts(row.contacts),
    client_recipients: row.client_recipients ?? [],
    source_snapshot: parseSourceSnapshot(row.source_snapshot),
  };
}

function reportContent(report: ProgressReportRecord) {
  return {
    title: report.title,
    past_week_highlights: report.past_week_highlights,
    upcoming_week_activities: report.upcoming_week_activities,
    open_items: report.open_items,
    internal_notes: report.internal_notes,
    status: report.status,
    review_status: report.review_status,
  };
}

async function appendReportVersion({
  report,
  projectId,
  userId,
  action,
  audience = "client",
}: {
  report: ProgressReportRecord;
  projectId: number;
  userId: string;
  action: ProgressReportVersion["action"];
  audience?: "internal" | "client";
}) {
  const { error } = await serviceDb
    .from("project_progress_report_versions")
    .upsert(
      {
        progress_report_id: report.id,
        project_id: projectId,
        version: report.version,
        action,
        audience,
        content: reportContent(report) as unknown as Json,
        source_snapshot: report.source_snapshot as unknown as Json,
        created_by: userId,
      },
      { onConflict: "progress_report_id,version" },
    );
  if (error)
    throw new Error(
      `Could not write progress report version ${report.version}: ${error.message}`,
    );
}

export async function listProgressReportVersions(
  projectId: number,
  reportId: string,
): Promise<ProgressReportVersion[]> {
  const { data, error } = await serviceDb
    .from("project_progress_report_versions")
    .select(
      "id, progress_report_id, project_id, version, action, audience, content, source_snapshot, created_by, created_at",
    )
    .eq("project_id", projectId)
    .eq("progress_report_id", reportId)
    .order("version", { ascending: false });
  if (error)
    throw new Error(`Could not load progress report history: ${error.message}`);
  return (data ?? []) as unknown as ProgressReportVersion[];
}

export async function refineProgressReport({
  projectId,
  reportId,
  userId,
}: {
  projectId: number;
  reportId: string;
  userId: string;
}) {
  const detail = await getProgressReportDetail(projectId, reportId);
  const { assembleProgressReportFromDeepRead } =
    await import("@/lib/progress-reports/assemble-from-deep-read");
  const sections = await assembleProgressReportFromDeepRead(projectId);
  if (!sections)
    throw new Error(
      "No daily deep-read source evidence is available for this project yet.",
    );
  const { error } = await serviceDb
    .from("project_progress_reports")
    .update({
      past_week_highlights: sections.past_week_highlights,
      upcoming_week_activities: sections.upcoming_week_activities,
      open_items: sections.open_items,
      internal_notes: sections.internal_notes,
      status: "draft",
      review_status: "needs_review",
      version: detail.report.version + 1,
      refined_at: new Date().toISOString(),
      refined_by: userId,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", reportId)
    .eq("project_id", projectId);
  if (error)
    throw new Error(`Could not refine progress report: ${error.message}`);
  const refreshed = await getProgressReportDetail(projectId, reportId);
  await appendReportVersion({
    report: refreshed.report,
    projectId,
    userId,
    action: "refined",
    audience: "internal",
  });
  return refreshed;
}

// Supabase accepts JSON-compatible objects for `contacts`, but the app should
// only persist the stable public shape used by the editor/PDF/email surfaces.
function contactsToJson(contacts: ProgressReportContact[]): Json {
  return contacts.map((contact) => ({
    role: contact.role,
    name: contact.name,
    email: contact.email,
    phone: contact.phone,
  }));
}

function fullName(person: ProjectTeamPersonRow): string {
  return [person.first_name, person.last_name].filter(Boolean).join(" ").trim();
}

// Contact merge/resolve logic lives in ./contacts so it can be unit-tested
// without pulling in the Supabase service client. Re-exported here because route
// handlers import these from the service layer.
export { mergeProgressReportContacts, resolveProgressReportContacts };

/**
 * Builds the default contact list shown on new progress reports.
 *
 * Source: `project_roles` + `project_role_members`, which the Directory role
 * UI owns.
 */
export async function listProjectTeamContacts(
  projectId: number,
): Promise<ProgressReportContact[]> {
  const rolesResult = await serviceDb
    .from("project_roles")
    .select("id, role_name, display_order")
    .eq("project_id", projectId)
    .order("display_order", { ascending: true });

  if (rolesResult.error) throw new Error(rolesResult.error.message);

  const roles = (rolesResult.data ?? []) as ProjectRoleRow[];
  const roleIds = roles.map((role) => role.id);

  const roleMembersResult =
    roleIds.length > 0
      ? await serviceDb
          .from("project_role_members")
          .select("project_role_id, person_id")
          .in("project_role_id", roleIds)
      : { data: [], error: null };

  if (roleMembersResult.error) throw new Error(roleMembersResult.error.message);

  const roleMembers = (roleMembersResult.data ?? []) as ProjectRoleMemberRow[];
  const personIds = Array.from(new Set(roleMembers.map((member) => member.person_id)));

  if (personIds.length === 0) return [];

  const { data: people, error: peopleError } = await serviceDb
    .from("people")
    .select(
      "id, first_name, last_name, email, phone_business, phone_mobile, job_title",
    )
    .in("id", personIds);

  if (peopleError) throw new Error(peopleError.message);

  const peopleById = new Map(
    ((people ?? []) as ProjectTeamPersonRow[]).map((person) => [
      person.id,
      person,
    ]),
  );
  const rolesById = new Map(roles.map((role) => [role.id, role]));
  const contacts: ProgressReportContact[] = [];

  for (const member of roleMembers) {
    const person = peopleById.get(member.person_id);
    const role = rolesById.get(member.project_role_id);
    if (!person) continue;
    contacts.push({
      role: role?.role_name ?? person.job_title ?? "Project Team",
      name: fullName(person) || person.email || "Project Team",
      email: person.email ?? "",
      phone: person.phone_mobile ?? person.phone_business ?? "",
    });
  }

  return mergeProgressReportContacts(contacts, []);
}

// Convert the draft builder's typed source snapshot back into the DB JSON shape.
// This snapshot is an audit/debug aid: it records which meetings, emails, and
// photos contributed to the initial deterministic draft.
function sourceSnapshotToJson(snapshot: ProgressReportSourceSnapshot): Json {
  return {
    generatedAt: snapshot.generatedAt,
    strategy: snapshot.strategy,
    meetings: snapshot.meetings.map((meeting) => ({
      id: meeting.id,
      title: meeting.title,
      date: meeting.date,
      summary: meeting.summary,
    })),
    emails: snapshot.emails.map((email) => ({
      id: email.id,
      subject: email.subject,
      date: email.date,
      preview: email.preview,
    })),
    photos: snapshot.photos.map((photo) => ({
      id: photo.id,
      title: photo.title,
      date: photo.date,
      file_url: photo.file_url,
    })),
  };
}

export async function listProgressReports(
  projectId: number,
): Promise<ProgressReportListItem[]> {
  const [
    { data: reports, error: reportsError },
    { data: photoLinks, error: linksError },
  ] = await Promise.all([
    serviceDb
      .from("project_progress_reports")
      .select("*")
      .eq("project_id", projectId)
      .order("week_end", { ascending: false }),
    serviceDb
      .from("project_progress_report_photos")
      .select("progress_report_id")
      .eq("project_id", projectId),
  ]);

  if (reportsError) throw new Error(reportsError.message);
  if (linksError) throw new Error(linksError.message);

  const counts = new Map<string, number>();
  for (const link of photoLinks ?? []) {
    const reportId = (link as { progress_report_id: string })
      .progress_report_id;
    counts.set(reportId, (counts.get(reportId) ?? 0) + 1);
  }

  return ((reports ?? []) as ProgressReportRow[]).map((report) => ({
    ...mapReport(report),
    selected_photo_count: counts.get(report.id) ?? 0,
  }));
}

// Returns the cross-project progress report table view. This intentionally
// enriches reports with project identity in one batch instead of joining through
// the report query, keeping the JSON parsing path shared with project lists.
export async function listAllProgressReports(): Promise<
  ProgressReportAllListItem[]
> {
  const [
    { data: reports, error: reportsError },
    { data: photoLinks, error: linksError },
  ] = await Promise.all([
    serviceDb
      .from("project_progress_reports")
      .select("*")
      .order("week_end", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(500),
    serviceDb
      .from("project_progress_report_photos")
      .select("progress_report_id"),
  ]);

  if (reportsError) throw new Error(reportsError.message);
  if (linksError) throw new Error(linksError.message);

  const reportRows = (reports ?? []) as ProgressReportRow[];
  const projectIds = Array.from(
    new Set(reportRows.map((report) => report.project_id)),
  );

  const projectsById = new Map<number, ProgressReportProjectRow>();
  if (projectIds.length > 0) {
    const { data: projects, error: projectsError } = await serviceDb
      .from("projects")
      .select("id, name, project_number")
      .in("id", projectIds);

    if (projectsError) throw new Error(projectsError.message);

    for (const project of (projects ?? []) as ProgressReportProjectRow[]) {
      projectsById.set(project.id, project);
    }
  }

  const counts = new Map<string, number>();
  for (const link of photoLinks ?? []) {
    const reportId = (link as { progress_report_id: string })
      .progress_report_id;
    counts.set(reportId, (counts.get(reportId) ?? 0) + 1);
  }

  return reportRows.map((report) => {
    const project = projectsById.get(report.project_id);
    return {
      ...mapReport(report),
      selected_photo_count: counts.get(report.id) ?? 0,
      project: {
        id: report.project_id,
        name: project?.name ?? null,
        project_number: project?.project_number ?? null,
        job_number: project?.project_number ?? null,
        client: null,
      },
    };
  });
}

// Detail payload for the editor: persisted report, currently selected photos,
// and the available project photo library used to change selections.
export async function getProgressReportDetail(
  projectId: number,
  reportId: string,
): Promise<ProgressReportDetailResponse> {
  const { data: reportRow, error: reportError } = await serviceDb
    .from("project_progress_reports")
    .select("*")
    .eq("project_id", projectId)
    .eq("id", reportId)
    .single();

  if (reportError || !reportRow) {
    throw new Error(reportError?.message ?? "Progress report not found");
  }

  const [photoLinksResult, availablePhotosResult, currentProjectContacts] =
    await Promise.all([
      serviceDb
        .from("project_progress_report_photos")
        .select("*")
        .eq("progress_report_id", reportId)
        .order("sort_order", { ascending: true }),
      serviceDb
        .from("project_photos")
        .select(
          "id, title, description, file_url, date_taken, created_at, location, tags",
        )
        .eq("project_id", projectId)
        .is("deleted_at", null)
        .order("date_taken", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(60),
      listProjectTeamContacts(projectId),
    ]);

  if (photoLinksResult.error) throw new Error(photoLinksResult.error.message);
  if (availablePhotosResult.error) {
    throw new Error(availablePhotosResult.error.message);
  }

  const availablePhotos = (
    (availablePhotosResult.data ?? []) as ProjectPhotoRow[]
  ).map(mapPhoto);
  const availablePhotoMap = new Map(
    availablePhotos.map((photo) => [photo.id, photo]),
  );

  const selectedPhotos = (
    (photoLinksResult.data ?? []) as ProgressReportPhotoLinkRow[]
  )
    .map((link) => {
      const photo = availablePhotoMap.get(link.project_photo_id);
      if (!photo) return null;
      return {
        ...link,
        photo,
      };
    })
    .filter((item): item is ProgressReportPhotoSelection => item !== null);

  const mappedReport = mapReport(reportRow as ProgressReportRow);
  const report =
    mappedReport.status === "draft"
      ? {
          ...mappedReport,
          contacts: currentProjectContacts,
        }
      : mappedReport;

  return {
    report,
    selectedPhotos,
    availablePhotos,
  };
}

function dateInRange(
  dateValue: string | null | undefined,
  start: string,
  end: string,
) {
  if (!dateValue) return false;
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return false;
  const value = date.toISOString().slice(0, 10);
  return value >= start && value <= end;
}

/**
 * Creates a weekly draft report if one does not already exist for the same
 * project/week range.
 *
 * Idempotency is important because this function is called by both manual UI
 * actions and scheduled/admin cron endpoints. If the report already exists, the
 * existing ID is returned and no source data is rebuilt or overwritten.
 *
 * Draft generation flow:
 * 1. Resolve or default the weekly date range.
 * 2. Check for an existing `project_progress_reports` row for that range.
 * 3. Load recent project source data in parallel.
 * 4. Filter source rows to the week, falling back to recent rows when the week
 *    is empty so the draft is useful instead of blank.
 * 5. Build deterministic client-facing sections with `buildProgressReportDraft`.
 * 6. Persist the report and selected photo links.
 */
export async function createProgressReportDraft({
  projectId,
  userId,
  userEmail,
  weekStart,
  weekEnd,
}: {
  projectId: number;
  userId: string;
  userEmail: string | null;
  weekStart?: string;
  weekEnd?: string;
}) {
  const range =
    weekStart && weekEnd ? { weekStart, weekEnd } : defaultWeeklyReportRange();

  // Idempotency gate: prevent duplicate weekly reports. When a report already
  // exists in `draft` status and hasn't been touched by a human (updated_by
  // still matches the cron sentinel), refresh its content with the latest
  // source data from the week so the report builds up day by day. Reports
  // edited by a real user or promoted to ready/sent are never auto-overwritten.
  const { data: existing } = await serviceDb
    .from("project_progress_reports")
    .select("id, status, updated_by, source_snapshot")
    .eq("project_id", projectId)
    .eq("week_start", range.weekStart)
    .eq("week_end", range.weekEnd)
    .maybeSingle();

  // The daily deep read is the source of truth for report content and refreshes
  // this row every day (source_snapshot.source === "daily_deep_read"). The weekly
  // meetings/emails builder must NOT clobber it — otherwise the two writers would
  // flip-flop the content day to day. Leave deep-read-owned drafts alone.
  const existingSource = (
    existing?.source_snapshot as { source?: string } | null
  )?.source;
  const isDeepReadOwned = existingSource === "daily_deep_read";

  const shouldRefresh =
    !!existing?.id &&
    existing.status === "draft" &&
    existing.updated_by === PROGRESS_REPORT_CRON_USER_ID &&
    userId === PROGRESS_REPORT_CRON_USER_ID &&
    !isDeepReadOwned;

  if (
    existing?.id &&
    isDeepReadOwned &&
    userId === PROGRESS_REPORT_CRON_USER_ID
  ) {
    // Deep read owns this week's report; the weekly cron defers to it.
    return { reportId: existing.id as string, action: "skipped" as const };
  }

  if (existing?.id && !shouldRefresh) {
    return { reportId: existing.id as string, action: "skipped" as const };
  }

  // Pull all source inputs in parallel. The builder receives already-loaded data
  // and stays pure/deterministic; this service owns all Supabase access.
  const [
    projectResult,
    meetingsResult,
    emailsResult,
    photosResult,
    profileResult,
    projectContacts,
  ] = await Promise.all([
    serviceDb
      .from("projects")
      .select(`name, project_number, "start date", "est completion"`)
      .eq("id", projectId)
      .single(),
    serviceDb
      .from("document_metadata")
      .select(
        "id, title, date, summary, overview, action_items, summary_bullets",
      )
      .eq("project_id", projectId)
      .eq("type", "meeting")
      .order("date", { ascending: false })
      .limit(20),
    serviceDb
      .from("project_emails")
      .select("id, subject, body, body_text, sent_at, received_at, created_at")
      .eq("project_id", projectId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(30),
    serviceDb
      .from("project_photos")
      .select(
        "id, title, description, file_url, date_taken, created_at, location, tags",
      )
      .eq("project_id", projectId)
      .is("deleted_at", null)
      .order("date_taken", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(30),
    serviceDb
      .from("user_profiles")
      .select("full_name")
      .eq("id", userId)
      .maybeSingle(),
    listProjectTeamContacts(projectId),
  ]);

  if (projectResult.error || !projectResult.data) {
    throw new Error(projectResult.error?.message ?? "Project not found");
  }
  if (meetingsResult.error) throw new Error(meetingsResult.error.message);
  if (emailsResult.error) throw new Error(emailsResult.error.message);
  if (photosResult.error) throw new Error(photosResult.error.message);

  // Prefer source material inside the requested reporting week. If a source type
  // has no weekly rows, fall back to the recent query result so the generated
  // draft still gives the PM something concrete to edit.
  const meetings = (
    (meetingsResult.data ?? []) as Array<Record<string, unknown>>
  ).filter((meeting) =>
    dateInRange(meeting.date as string | null, range.weekStart, range.weekEnd),
  );

  const emails = (
    (emailsResult.data ?? []) as Array<Record<string, unknown>>
  ).filter((email) =>
    dateInRange(
      (email.received_at as string | null) ??
        (email.sent_at as string | null) ??
        (email.created_at as string | null),
      range.weekStart,
      range.weekEnd,
    ),
  );

  const photos = ((photosResult.data ?? []) as ProjectPhotoRow[]).filter(
    (photo) =>
      dateInRange(
        photo.date_taken ?? photo.created_at,
        range.weekStart,
        range.weekEnd,
      ),
  );

  const draft = buildProgressReportDraft({
    project: {
      name: projectResult.data.name,
      project_number: projectResult.data.project_number,
      client: null,
      start_date: projectResult.data["start date"],
      scheduled_completion_date: projectResult.data["est completion"],
    },
    meetings:
      meetings.length > 0
        ? (meetings as never[])
        : ((meetingsResult.data ?? []) as never[]),
    emails:
      emails.length > 0
        ? (emails as never[])
        : ((emailsResult.data ?? []) as never[]),
    photos:
      photos.length > 0
        ? photos
        : ((photosResult.data ?? []) as ProjectPhotoRow[]),
    currentUser: {
      email: userEmail,
      fullName: profileResult.data?.full_name ?? null,
    },
    projectContacts,
  });

  // Daily refresh path: update text sections and source snapshot with the
  // latest week's source material. Photo selections are left untouched because
  // the PM may have already picked specific images on a prior visit.
  if (shouldRefresh && existing?.id) {
    const { error: updateError } = await serviceDb
      .from("project_progress_reports")
      .update({
        past_week_highlights: draft.pastWeekHighlights,
        upcoming_week_activities: draft.upcomingWeekActivities,
        open_items: draft.openItems,
        source_snapshot: sourceSnapshotToJson(draft.sourceSnapshot),
        updated_by: PROGRESS_REPORT_CRON_USER_ID,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .eq("project_id", projectId);

    if (updateError) throw new Error(updateError.message);

    return { reportId: existing.id as string, action: "refreshed" as const };
  }

  // First-creation path: persist the full report and initial photo selections.
  const { data: created, error: createError } = await serviceDb
    .from("project_progress_reports")
    .insert({
      project_id: projectId,
      title: draft.title,
      report_type: "weekly",
      status: "draft",
      week_start: range.weekStart,
      week_end: range.weekEnd,
      construction_start_date: draft.constructionStartDate,
      scheduled_completion_date: draft.scheduledCompletionDate,
      past_week_highlights: draft.pastWeekHighlights,
      upcoming_week_activities: draft.upcomingWeekActivities,
      open_items: draft.openItems,
      weather_days_lost: draft.weatherDaysLost,
      contacts: contactsToJson(draft.contacts),
      client_recipients: draft.clientRecipients,
      source_snapshot: sourceSnapshotToJson(draft.sourceSnapshot),
      version: 1,
      review_status: "needs_review",
      created_by: userId,
      updated_by: userId,
    })
    .select("id")
    .single();

  if (createError || !created?.id) {
    throw new Error(createError?.message ?? "Could not create progress report");
  }

  if (draft.selectedPhotos.length > 0) {
    const { error: photosInsertError } = await serviceDb
      .from("project_progress_report_photos")
      .insert(
        draft.selectedPhotos.map((selection) => ({
          progress_report_id: created.id as string,
          project_id: projectId,
          project_photo_id: selection.project_photo_id,
          sort_order: selection.sort_order,
          caption: selection.caption,
          created_by: userId,
        })),
      );

    if (photosInsertError) {
      throw new Error(photosInsertError.message);
    }
  }

  return { reportId: created.id as string, action: "created" as const };
}

/**
 * Saves manual editor changes.
 *
 * This function does not regenerate deterministic or AI content. It trusts the
 * editor payload as the current report of record, then replaces photo links as a
 * full set to keep ordering simple and deterministic.
 */
export async function saveProgressReport({
  projectId,
  reportId,
  userId,
  updates,
}: {
  projectId: number;
  reportId: string;
  userId: string;
  updates: {
    title: string;
    status: "draft" | "ready" | "sent";
    week_start: string;
    week_end: string;
    construction_start_date: string | null;
    scheduled_completion_date: string | null;
    past_week_highlights: string;
    upcoming_week_activities: string;
    open_items: string;
    internal_notes?: string | null;
    review_status?: "needs_review" | "approved" | "sent";
    weather_days_lost: number;
    contacts: ProgressReportContact[];
    client_recipients: string[];
    selected_photos: Array<{
      project_photo_id: number;
      sort_order: number;
      caption: string | null;
    }>;
  };
}) {

  const current = await getProgressReportDetail(projectId, reportId);
  const nextVersion = current.report.version + 1;
  // Main report update: client-facing text, date range, contacts, status, and
  // send timestamp. The `sent_at` value mirrors the editor status transition.
  const { error: updateError } = await serviceDb
    .from("project_progress_reports")
    .update({
      title: updates.title,
      status: updates.status,
      week_start: updates.week_start,
      week_end: updates.week_end,
      construction_start_date: updates.construction_start_date,
      scheduled_completion_date: updates.scheduled_completion_date,
      past_week_highlights: updates.past_week_highlights,
      upcoming_week_activities: updates.upcoming_week_activities,
      open_items: updates.open_items,
      internal_notes: updates.internal_notes ?? null,
      weather_days_lost: updates.weather_days_lost,
      contacts: contactsToJson(updates.contacts),
      client_recipients: updates.client_recipients,
      updated_by: userId,
      updated_at: new Date().toISOString(),
      sent_at: updates.status === "sent" ? new Date().toISOString() : null,
      review_status:
        updates.status === "sent"
          ? "sent"
          : (updates.review_status ?? "needs_review"),
      version: nextVersion,
    })
    .eq("project_id", projectId)
    .eq("id", reportId);

  if (updateError) throw new Error(updateError.message);

  // Photo links are replaced wholesale because the editor sends the intended
  // final ordered list. This avoids diff bugs around removed/reordered photos.
  const { error: deleteLinksError } = await serviceDb
    .from("project_progress_report_photos")
    .delete()
    .eq("progress_report_id", reportId);

  if (deleteLinksError) throw new Error(deleteLinksError.message);

  if (updates.selected_photos.length > 0) {
    const { error: insertLinksError } = await serviceDb
      .from("project_progress_report_photos")
      .insert(
        updates.selected_photos.map((selection) => ({
          progress_report_id: reportId,
          project_id: projectId,
          project_photo_id: selection.project_photo_id,
          sort_order: selection.sort_order,
          caption: selection.caption,
          created_by: userId,
        })),
      );

    if (insertLinksError) throw new Error(insertLinksError.message);
  }

  const detail = await getProgressReportDetail(projectId, reportId);
  await appendReportVersion({
    report: detail.report,
    projectId,
    userId,
    action: updates.status === "sent" ? "sent" : "edited",
  });
  return detail;
}

export async function deleteProgressReport(
  projectId: number,
  reportId: string,
): Promise<void> {
  const { error: deletePhotosError } = await serviceDb
    .from("project_progress_report_photos")
    .delete()
    .eq("progress_report_id", reportId)
    .eq("project_id", projectId);

  if (deletePhotosError) throw new Error(deletePhotosError.message);

  const { error } = await serviceDb
    .from("project_progress_reports")
    .delete()
    .eq("id", reportId)
    .eq("project_id", projectId);

  if (error) throw new Error(error.message);
}
