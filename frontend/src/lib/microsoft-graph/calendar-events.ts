import "server-only";

import {
  getGraphToken,
  getGraphCalendarPermissionStatus,
  resolveOutlookOrganizerEmail,
} from "./calendar-invites";

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

// Per Microsoft Graph docs: $filter+$orderby on /events requires a single
// orderby key matching the filter. $top is capped at 999. We use the
// calendarView endpoint instead because it auto-expands recurring series
// into individual instances within the window — what users actually want
// when they ask "what's on my calendar tomorrow?".
const MAX_EVENTS = 50;

const GRAPH_CALENDAR_READ_PERMISSIONS = new Set([
  "Calendars.Read",
  "Calendars.Read.Shared",
  "Calendars.ReadWrite",
  "Calendars.ReadWrite.Shared",
]);

export type OutlookCalendarEvent = {
  id: string;
  subject: string;
  startDateTime: string; // ISO with timezone
  endDateTime: string;
  timeZone: string;
  isAllDay: boolean;
  isCancelled: boolean;
  location: string | null;
  organizerEmail: string | null;
  organizerName: string | null;
  attendees: Array<{
    email: string;
    name: string | null;
    response: string | null;
    type: string | null;
  }>;
  bodyPreview: string | null;
  webLink: string | null;
  joinUrl: string | null;
  importance: string | null;
  showAs: string | null;
  responseStatus: string | null;
};

export type ListOutlookCalendarEventsInput = {
  /** Mailbox to read. Defaults to MICROSOFT_CALENDAR_USER env. */
  userEmail?: string | null;
  /** Inclusive ISO timestamp (with timezone) for window start. */
  startIso: string;
  /** Inclusive ISO timestamp for window end. */
  endIso: string;
  /** Max events returned. Hard cap 50. */
  limit?: number;
};

export type ListOutlookCalendarEventsResult =
  | { ok: true; userEmail: string; events: OutlookCalendarEvent[]; truncated: boolean }
  | { ok: false; error: string; userEmail?: string };

type GraphAttendee = {
  emailAddress?: { address?: string | null; name?: string | null } | null;
  status?: { response?: string | null } | null;
  type?: string | null;
};

type GraphCalendarViewEvent = {
  id?: string;
  subject?: string | null;
  bodyPreview?: string | null;
  start?: { dateTime?: string | null; timeZone?: string | null } | null;
  end?: { dateTime?: string | null; timeZone?: string | null } | null;
  isAllDay?: boolean | null;
  isCancelled?: boolean | null;
  location?: { displayName?: string | null } | null;
  organizer?: { emailAddress?: { address?: string | null; name?: string | null } | null } | null;
  attendees?: GraphAttendee[] | null;
  webLink?: string | null;
  onlineMeeting?: { joinUrl?: string | null } | null;
  importance?: string | null;
  showAs?: string | null;
  responseStatus?: { response?: string | null } | null;
};

function assertGraphCalendarReadPermission(accessToken: string): void {
  const status = getGraphCalendarPermissionStatus(accessToken);
  // Reuse the write-permission helper to decode roles, then check the read set.
  const hasRead =
    status.roles.some((role) => GRAPH_CALENDAR_READ_PERMISSIONS.has(role)) ||
    status.scopes.some((scope) => GRAPH_CALENDAR_READ_PERMISSIONS.has(scope));
  if (!hasRead) {
    throw new Error(
      [
        "Microsoft Graph token does not have a Calendars read permission.",
        "Cause: getOutlookCalendarEvents needs application permission Calendars.Read or Calendars.ReadWrite for the configured Microsoft app registration.",
        `Roles seen on token: ${status.roles.join(", ") || "(none)"}.`,
        "Detection gap: calendar reads were not previously verified against Graph runtime configuration.",
        "Prevention: fail before attempting the read when no calendar permission is granted.",
      ].join(" "),
    );
  }
}

/**
 * List events from an Outlook calendar within a date window.
 *
 * Uses Graph's calendarView endpoint, which auto-expands recurring series
 * into individual occurrences within [startIso, endIso). That's what
 * users expect when they ask "what meetings tomorrow?" — they want
 * concrete instances, not series definitions.
 */
export async function listOutlookCalendarEvents(
  input: ListOutlookCalendarEventsInput,
): Promise<ListOutlookCalendarEventsResult> {
  const userEmail = resolveOutlookOrganizerEmail(input.userEmail ?? null);
  if (!userEmail) {
    return {
      ok: false,
      error:
        "No Outlook mailbox specified. Provide userEmail or set MICROSOFT_CALENDAR_USER / OUTLOOK_CALENDAR_USER in env.",
    };
  }

  let accessToken: string;
  try {
    accessToken = await getGraphToken();
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      userEmail,
    };
  }

  try {
    assertGraphCalendarReadPermission(accessToken);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      userEmail,
    };
  }

  const limit = Math.min(input.limit ?? MAX_EVENTS, MAX_EVENTS);
  const params = new URLSearchParams({
    startDateTime: input.startIso,
    endDateTime: input.endIso,
    $orderby: "start/dateTime",
    $top: String(limit),
    $select:
      "id,subject,bodyPreview,start,end,isAllDay,isCancelled,location,organizer,attendees,webLink,onlineMeeting,importance,showAs,responseStatus",
  });
  const url = `${GRAPH_BASE}/users/${encodeURIComponent(userEmail)}/calendarView?${params.toString()}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      // Prefer header gets back ISO timestamps in a deterministic timezone.
      Prefer: 'outlook.timezone="America/New_York"',
    },
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    return {
      ok: false,
      userEmail,
      error: `Graph calendarView ${response.status} ${response.statusText}: ${detail.slice(0, 400)}`,
    };
  }

  const data = (await response.json()) as { value?: GraphCalendarViewEvent[]; "@odata.nextLink"?: string };
  const raw = data.value ?? [];

  const events: OutlookCalendarEvent[] = raw.map((e) => ({
    id: e.id ?? "",
    subject: e.subject ?? "(no subject)",
    startDateTime: e.start?.dateTime ?? "",
    endDateTime: e.end?.dateTime ?? "",
    timeZone: e.start?.timeZone ?? "America/New_York",
    isAllDay: Boolean(e.isAllDay),
    isCancelled: Boolean(e.isCancelled),
    location: e.location?.displayName ?? null,
    organizerEmail: e.organizer?.emailAddress?.address ?? null,
    organizerName: e.organizer?.emailAddress?.name ?? null,
    attendees: (e.attendees ?? []).map((a) => ({
      email: a.emailAddress?.address ?? "",
      name: a.emailAddress?.name ?? null,
      response: a.status?.response ?? null,
      type: a.type ?? null,
    })),
    bodyPreview: e.bodyPreview ?? null,
    webLink: e.webLink ?? null,
    joinUrl: e.onlineMeeting?.joinUrl ?? null,
    importance: e.importance ?? null,
    showAs: e.showAs ?? null,
    responseStatus: e.responseStatus?.response ?? null,
  }));

  return {
    ok: true,
    userEmail,
    events,
    truncated: Boolean(data["@odata.nextLink"]),
  };
}
