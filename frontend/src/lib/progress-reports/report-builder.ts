import type {
  ProgressReportContact,
  ProgressReportSourceSnapshot,
} from "@/lib/progress-reports/types";

/**
 * Deterministic progress report draft builder.
 *
 * This file should stay free of Supabase and AI calls. It receives source rows
 * from `server.ts` and converts them into an editable first draft:
 * - title and schedule dates
 * - past-week highlights
 * - upcoming-week activities
 * - open items
 * - contacts/recipients
 * - source snapshot and initial photo selections
 *
 * Keeping this pure makes draft generation predictable, testable, and safe to
 * retry before the API route optionally applies AI enrichment.
 */

// Input shapes are intentionally narrower than the database rows. The service
// layer decides what to query; the builder only needs the fields used for copy,
// source attribution, contact fallback, and photo selection.
interface DraftProjectInput {
  name: string | null;
  project_number: string | null;
  client: string | null;
  start_date: string | null;
  scheduled_completion_date: string | null;
}

interface DraftMeetingInput {
  id: string;
  title: string | null;
  date: string | null;
  summary: string | null;
  overview: string | null;
  action_items: string | null;
  summary_bullets: unknown;
}

interface DraftEmailInput {
  id: number;
  subject: string;
  body: string | null;
  body_text: string | null;
  sent_at: string | null;
  received_at: string | null;
  created_at: string | null;
}

interface DraftPhotoInput {
  id: number;
  title: string;
  description: string | null;
  file_url: string;
  date_taken: string | null;
  created_at: string | null;
  location: string | null;
  tags: string[] | null;
}

interface DraftCurrentUser {
  email: string | null;
  fullName: string | null;
}

export interface ProgressReportDraftResult {
  title: string;
  constructionStartDate: string | null;
  scheduledCompletionDate: string | null;
  pastWeekHighlights: string;
  upcomingWeekActivities: string;
  openItems: string;
  weatherDaysLost: number;
  contacts: ProgressReportContact[];
  clientRecipients: string[];
  sourceSnapshot: ProgressReportSourceSnapshot;
  selectedPhotos: Array<{
    project_photo_id: number;
    sort_order: number;
    caption: string | null;
  }>;
}

// Persist date-only values in the same YYYY-MM-DD shape the editor and PDF use.
function toIsoDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

// Normalize messy meeting/email text before extracting candidate report bullets.
function cleanText(value: string | null | undefined): string {
  return (value ?? "")
    .replace(/\u2022/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\t/g, " ")
    .replace(/[ ]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Extract sentence-like or line-like fragments from source text. This is a
// heuristic, not an AI step: it gives PMs concrete editable bullets even when
// meetings/emails were saved as paragraphs instead of structured lists.
function splitBulletCandidates(value: string | null | undefined): string[] {
  return cleanText(value)
    .split(/\n|(?<=[.?!])\s+(?=[A-Z0-9])/)
    .map((line) => line.replace(/^[-*]\s*/, "").trim())
    .filter((line) => line.length >= 10);
}

// Preserve first occurrence ordering while removing exact semantic duplicates.
function uniqueItems(items: string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const item of items) {
    const normalized = item.toLowerCase();
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    output.push(item);
  }

  return output;
}

// Meeting summaries sometimes store bullet arrays as JSON. Non-array shapes are
// treated as empty instead of throwing because source data may be inconsistent.
function parseJsonStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

// Report sections are plain markdown-ish bullets for the editor/PDF pipeline.
// The fallback text is intentionally explicit so an empty source set fails
// visibly to the PM instead of generating a blank client report.
function formatBulletBlock(items: string[], fallback: string): string {
  const lines = items.slice(0, 5);
  if (lines.length === 0) return fallback;
  return lines.map((line) => `- ${line}`).join("\n");
}

function getEmailDate(email: DraftEmailInput): string | null {
  return email.received_at ?? email.sent_at ?? email.created_at ?? null;
}

function buildDefaultContacts(currentUser: DraftCurrentUser): ProgressReportContact[] {
  if (!currentUser.email && !currentUser.fullName) return [];

  return [
    {
      role: "Project Manager",
      name: currentUser.fullName ?? currentUser.email ?? "Project Manager",
      email: currentUser.email ?? "",
      phone: "",
    },
  ];
}

// Default report range is the trailing seven days ending at the reference date.
// API callers can override this for manual or cron-specific windows.
export function defaultWeeklyReportRange(referenceDate = new Date()) {
  const end = new Date(referenceDate);
  end.setHours(0, 0, 0, 0);

  const start = new Date(end);
  start.setDate(start.getDate() - 7);

  return {
    weekStart: start.toISOString().slice(0, 10),
    weekEnd: end.toISOString().slice(0, 10),
  };
}

/**
 * Builds the initial deterministic draft from already-fetched source rows.
 *
 * Section strategy:
 * - Past week highlights combine meeting summary signals and photo activity.
 * - Upcoming activities combine explicit meeting action items and "continue..."
 *   versions of the strongest meeting highlights.
 * - Open items combine email subjects/previews and meeting action items.
 *
 * The function also records a source snapshot so editors can understand why a
 * draft said what it said, and selects the first four project photos as the
 * default image set for the report.
 */
export function buildProgressReportDraft({
  project,
  meetings,
  emails,
  photos,
  currentUser,
  projectContacts = [],
}: {
  project: DraftProjectInput;
  meetings: DraftMeetingInput[];
  emails: DraftEmailInput[];
  photos: DraftPhotoInput[];
  currentUser: DraftCurrentUser;
  projectContacts?: ProgressReportContact[];
}): ProgressReportDraftResult {
  // Meeting highlights are the strongest deterministic signal because they are
  // already curated through summaries, overviews, or summary bullet arrays.
  const meetingHighlightLines = uniqueItems(
    meetings.flatMap((meeting) => [
      ...parseJsonStringArray(meeting.summary_bullets),
      ...splitBulletCandidates(meeting.overview),
      ...splitBulletCandidates(meeting.summary),
    ]),
  );

  // Action items become both upcoming activities and open items because they
  // usually represent work still visible to the client.
  const meetingActionLines = uniqueItems(
    meetings.flatMap((meeting) => splitBulletCandidates(meeting.action_items)),
  );

  // Photo titles/locations provide visible field-progress signals when meeting
  // notes are sparse.
  const photoLines = uniqueItems(
    photos.map((photo) => {
      const location = photo.location ? ` at ${photo.location}` : "";
      return `${photo.title}${location}`;
    }),
  );

  // Email subjects plus one preview fragment create a lightweight open-items
  // list without copying long email bodies into the report.
  const emailOpenItems = uniqueItems(
    emails.flatMap((email) => {
      const preview = splitBulletCandidates(email.body_text ?? email.body);
      return [email.subject, ...preview.slice(0, 1)];
    }),
  );

  // The three report body fields are intentionally bounded to five bullets each
  // so the first draft is concise enough for PM review and PDF/email delivery.
  const pastWeekHighlights = formatBulletBlock(
    uniqueItems([...meetingHighlightLines, ...photoLines]),
    "- Add weekly highlights for the client-facing report.",
  );

  const upcomingWeekActivities = formatBulletBlock(
    uniqueItems([
      ...meetingActionLines,
      ...meetingHighlightLines.map((line) => `Continue ${line.charAt(0).toLowerCase()}${line.slice(1)}`),
    ]),
    "- Add the upcoming week activities for the client-facing report.",
  );

  const openItems = formatBulletBlock(
    uniqueItems([...emailOpenItems, ...meetingActionLines]),
    "- Add open items that still need client visibility.",
  );

  // Snapshot only stores compact source evidence, not full email bodies or all
  // meeting text. It is for traceability and debugging, not a complete archive.
  const sourceSnapshot: ProgressReportSourceSnapshot = {
    generatedAt: new Date().toISOString(),
    strategy: "deterministic-progress-report-v1",
    meetings: meetings.slice(0, 6).map((meeting) => ({
      id: meeting.id,
      title: meeting.title ?? "Untitled meeting",
      date: meeting.date,
      summary:
        parseJsonStringArray(meeting.summary_bullets)[0] ??
        splitBulletCandidates(meeting.summary)[0] ??
        splitBulletCandidates(meeting.overview)[0] ??
        "",
    })),
    emails: emails.slice(0, 6).map((email) => ({
      id: email.id,
      subject: email.subject,
      date: getEmailDate(email),
      preview: splitBulletCandidates(email.body_text ?? email.body)[0] ?? "",
    })),
    photos: photos.slice(0, 12).map((photo) => ({
      id: photo.id,
      title: photo.title,
      date: photo.date_taken ?? photo.created_at,
      file_url: photo.file_url,
    })),
  };

  // Contacts prefer project directory roles; if none are configured, use the
  // current user as a Project Manager fallback so the report has an owner.
  return {
    title: `${project.name ?? "Project"} Weekly Progress Report`,
    constructionStartDate: toIsoDate(project.start_date),
    scheduledCompletionDate: toIsoDate(project.scheduled_completion_date),
    pastWeekHighlights,
    upcomingWeekActivities,
    openItems,
    weatherDaysLost: 0,
    contacts: projectContacts.length > 0 ? projectContacts : buildDefaultContacts(currentUser),
    clientRecipients: [],
    sourceSnapshot,
    selectedPhotos: photos.slice(0, 4).map((photo, index) => ({
      project_photo_id: photo.id,
      sort_order: index,
      caption: photo.title,
    })),
  };
}
