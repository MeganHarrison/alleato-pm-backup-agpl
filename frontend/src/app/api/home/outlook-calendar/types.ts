export type HomeOutlookCalendarMeeting = {
  id: string;
  subject: string;
  startDateTime: string;
  endDateTime: string;
  timeZone: string;
  isAllDay: boolean;
  location: string | null;
  organizerName: string | null;
  attendeeCount: number;
  webLink: string | null;
  joinUrl: string | null;
  responseStatus: string | null;
};

export type HomeOutlookCalendarResponse =
  | {
      ok: true;
      source: "microsoft-graph-live";
      userEmail: string;
      window: {
        startIso: string;
        endIso: string;
      };
      meetings: HomeOutlookCalendarMeeting[];
      truncated: boolean;
    }
  | {
      ok: false;
      source: "microsoft-graph-live";
      error: string;
      userEmail?: string;
      window: {
        startIso: string;
        endIso: string;
      };
    };
