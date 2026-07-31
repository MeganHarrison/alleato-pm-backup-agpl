export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { listOutlookCalendarEvents } from "@/lib/microsoft-graph/calendar-events";
import { getApiRouteUser } from "@/lib/supabase/server";
import type {
  HomeOutlookCalendarMeeting,
  HomeOutlookCalendarResponse,
} from "./types";

const MEETING_WINDOW_DAYS = 7;
const MEETING_LIMIT = 8;
const GRAPH_EVENT_LIMIT = 24;

function buildCalendarWindow(now = new Date()) {
  const end = new Date(now);
  end.setDate(now.getDate() + MEETING_WINDOW_DAYS);
  return {
    startIso: now.toISOString(),
    endIso: end.toISOString(),
  };
}

function eventEndsAfterWindowStart(
  event: { endDateTime: string | null },
  windowStartIso: string,
): boolean {
  if (!event.endDateTime) return true;
  const end = new Date(event.endDateTime).getTime();
  const windowStart = new Date(windowStartIso).getTime();
  if (Number.isNaN(end) || Number.isNaN(windowStart)) return true;
  return end >= windowStart;
}

export const GET = withApiGuardrails(
  "home-outlook-calendar#GET",
  async (): Promise<NextResponse<HomeOutlookCalendarResponse>> => {
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "home-outlook-calendar#GET",
        message: "Authentication required.",
      });
    }

    const window = buildCalendarWindow();
    const result = await listOutlookCalendarEvents({
      userEmail: user.email?.trim() || null,
      startIso: window.startIso,
      endIso: window.endIso,
      limit: GRAPH_EVENT_LIMIT,
    });

    if (!result.ok) {
      return NextResponse.json({
        ok: false,
        source: "microsoft-graph-live",
        error: result.error,
        userEmail: result.userEmail,
        window,
      });
    }

    const meetings: HomeOutlookCalendarMeeting[] = result.events
      .filter((event) => !event.isCancelled)
      .filter((event) => eventEndsAfterWindowStart(event, window.startIso))
      .sort(
        (left, right) =>
          new Date(left.startDateTime).getTime() -
          new Date(right.startDateTime).getTime(),
      )
      .slice(0, MEETING_LIMIT)
      .map((event) => ({
        id: event.id,
        subject: event.subject,
        startDateTime: event.startDateTime,
        endDateTime: event.endDateTime,
        timeZone: event.timeZone,
        isAllDay: event.isAllDay,
        location: event.location,
        organizerName: event.organizerName,
        attendeeCount: event.attendees.filter(
          (attendee) => attendee.email.trim().length > 0,
        ).length,
        webLink: event.webLink,
        joinUrl: event.joinUrl,
        responseStatus: event.responseStatus,
      }));

    return NextResponse.json({
      ok: true,
      source: "microsoft-graph-live",
      userEmail: result.userEmail,
      window,
      meetings,
      truncated: result.truncated,
    });
  },
);
