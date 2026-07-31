export type ParsedCalendarInviteRequest = {
  organizerEmail?: string;
  attendeeEmail?: string;
  attendeeName?: string;
  subject: string;
  body: string;
  startDateTime: string;
  endDateTime: string;
  timeZone: string;
  location: string;
  isOnlineMeeting: boolean;
  confirmed: boolean;
};

function normalizeHour(hour: string, minute: string | undefined, meridiem: string | undefined): string {
  let parsedHour = Number(hour);
  const parsedMinute = Number(minute ?? "0");
  if (meridiem) {
    const lower = meridiem.toLowerCase();
    if (lower === "pm" && parsedHour < 12) parsedHour += 12;
    if (lower === "am" && parsedHour === 12) parsedHour = 0;
  }
  return `${String(parsedHour).padStart(2, "0")}:${String(parsedMinute).padStart(2, "0")}:00`;
}

function getCalendarDateFromMessage(message: string): string | null {
  const explicitDateMatch = message.match(/\bDate:\s*(20\d{2}-\d{2}-\d{2})\b/i) ?? message.match(/\b(20\d{2}-\d{2}-\d{2})\b/i);
  if (explicitDateMatch) return explicitDateMatch[1];

  const now = new Date();
  if (/\btomorrow\b/i.test(message)) {
    now.setDate(now.getDate() + 1);
    return now.toISOString().slice(0, 10);
  }

  if (/\btoday\b/i.test(message)) {
    return now.toISOString().slice(0, 10);
  }

  return null;
}

function getNaturalCalendarTimeRange(message: string): { startTime: string; endTime: string } | null {
  const rangeMatch = message.match(
    /\bTime:\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*(?:-|–|—|to)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i,
  ) ?? message.match(
    /\bfrom\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*(?:-|–|—|to)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i,
  );
  if (rangeMatch) {
    const endMeridiem = rangeMatch[6] ?? rangeMatch[3];
    return {
      startTime: normalizeHour(rangeMatch[1], rangeMatch[2], rangeMatch[3] ?? endMeridiem),
      endTime: normalizeHour(rangeMatch[4], rangeMatch[5], endMeridiem),
    };
  }

  const startMatch = message.match(/\b(?:at|@)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
  if (!startMatch) return null;

  const durationMatch = message.match(/\b(\d{1,3})\s*(?:minute|minutes|min|mins)\b/i);
  const durationMinutes = Number(durationMatch?.[1] ?? "30");
  const [hour, minute] = normalizeHour(startMatch[1], startMatch[2], startMatch[3])
    .split(":")
    .map(Number);
  const end = new Date(Date.UTC(2000, 0, 1, hour, minute + durationMinutes, 0));
  return {
    startTime: normalizeHour(startMatch[1], startMatch[2], startMatch[3]),
    endTime: `${String(end.getUTCHours()).padStart(2, "0")}:${String(end.getUTCMinutes()).padStart(2, "0")}:00`,
  };
}

function getCalendarSubjectFromMessage(message: string): string | null {
  const subjectMatch = message.match(/\bSubject:\s*([^.\n]+)/i);
  if (subjectMatch) return subjectMatch[1].trim();

  const topicMatch = message.match(/\b(?:about|regarding|re:)\s+([^.\n]+?)(?:\s+with\s+agenda\b|\s+via\b|\s+on\s+teams\b|\.|$)/i);
  if (topicMatch) return topicMatch[1].trim();

  return null;
}

function getNaturalCalendarAttendeeName(message: string): string | undefined {
  const attendeeMatch = message.match(/\bAttendee:\s*([^.<\n]+?)\s*<([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})>/i);
  if (attendeeMatch) return attendeeMatch[1]?.trim();

  const naturalMatch = message.match(/\b(?:to|with|invite)\s+([A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){1,2})\b/);
  return naturalMatch?.[1]?.trim();
}

export function parseCalendarInviteRequest(message: string): ParsedCalendarInviteRequest | null {
  const emails = [...message.matchAll(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)].map((match) => match[0]);

  const organizerMatch = message.match(/\bOrganizer:\s*([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i);
  const attendeeMatch = message.match(/\bAttendee:\s*([^.<\n]+?)\s*<([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})>/i);
  const organizerEmail = organizerMatch?.[1]?.trim().toLowerCase();
  const attendeeEmail = (attendeeMatch?.[2] ?? emails.find((email) => email.toLowerCase() !== organizerEmail))?.trim().toLowerCase();
  const attendeeName = attendeeMatch?.[1]?.trim() ?? getNaturalCalendarAttendeeName(message);

  if (!attendeeEmail && !attendeeName) return null;

  const date = getCalendarDateFromMessage(message);
  const timeRange = getNaturalCalendarTimeRange(message);
  const subject = getCalendarSubjectFromMessage(message);
  if (!date || !timeRange || !subject) return null;

  const bodyMatch = message.match(/\bBody:\s*([^]+?)(?:\s+This is authorized\.|\s+Use createOutlookCalendarInvite|\s+Do not just describe|$)/i);
  const confirmed =
    /\bconfirmed:\s*true\b/i.test(message) ||
    /\b(create and send|send .*now|authorized|confirm(ed)?)\b/i.test(message);

  return {
    organizerEmail,
    attendeeEmail,
    attendeeName,
    subject,
    body: bodyMatch?.[1]?.trim() || "Created by the Alleato AI assistant.",
    startDateTime: `${date}T${timeRange.startTime}`,
    endDateTime: `${date}T${timeRange.endTime}`,
    timeZone: "Eastern Standard Time",
    location: /teams/i.test(message) ? "Microsoft Teams" : "Microsoft Teams",
    isOnlineMeeting: /teams/i.test(message),
    confirmed,
  };
}
