import { z } from "zod";

export const getRecentEmailsDescription =
  "Get a list of Outlook emails received within a specific date range. " +
  "Use this when the user asks a time-based question about emails: " +
  "'what emails did I receive today?', 'show me emails from this week', " +
  "'any emails received yesterday?', 'how many emails came in today?'. " +
  "This queries the backend Microsoft Graph live inbox first. Synced Outlook intake rows are fallback only — never treat them as live inbox truth. " +
  "By default, queries the signed-in user's synced mailbox so 'my emails today' does not spill into other mailboxes. " +
  "Returns consolidated conversation/thread groups first, with message counts, senders, recipients, dates, and previews. " +
  "Use participantEmail plus direction='to' or direction='from' only when the user explicitly asks for emails to/from a person. " +
  "Always summarize results by thread, not as a raw individual-message dump.";

export const getRecentEmailsInputSchema = z.object({
  sinceIso: z
    .string()
    .optional()
    .describe(
      "ISO 8601 date/time start. Required for date-range queries. " +
        "If the user says 'today', set to midnight of the current date.",
    ),
  untilIso: z
    .string()
    .optional()
    .describe(
      "ISO 8601 date/time end (exclusive upper bound). Defaults to now.",
    ),
  participantEmail: z
    .string()
    .optional()
    .describe(
      "Only use when the user explicitly names a person. Searches sender, to, cc fields. " +
        "Accepts partial match — 'brandon' will match brandon@example.com.",
    ),
  direction: z
    .enum(["any", "from", "to"])
    .optional()
    .default("any")
    .describe(
      "'from' = emails sent BY the participant, 'to' = emails sent TO the participant, 'any' = either direction.",
    ),
  mailboxUserId: z
    .string()
    .optional()
    .describe(
      "Whose mailbox to query. Defaults to the signed-in user's synced mailbox. " +
        "Provide an email or UPN to query another user's mailbox.",
    ),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .default(25)
    .describe("Max threads to return (1-100, default 25)"),
  importanceThreshold: z
    .number()
    .min(0)
    .max(10)
    .optional()
    .describe(
      "When set, only return emails with importance_score >= this value (0-10 scale).",
    ),
});

export const searchEmailsDescription =
  "Search Outlook emails by keyword, subject, or body content. Use when " +
  "the user asks: 'find emails about [topic]', 'search for [keyword] in my emails', " +
  "'any emails mentioning [subject]'. This performs a broad keyword search " +
  "across email subjects and body content using vector/semantic search. " +
  "For time-based email queries use getRecentEmails instead.";

export const searchEmailsInputSchema = z.object({
  query: z.string().describe("Search query — keywords, phrases, or topic"),
  participantEmail: z
    .string()
    .optional()
    .describe("Filter to emails involving this person"),
  projectId: z.number().optional().describe("Filter to a specific project"),
  limit: z
    .number()
    .optional()
    .default(15)
    .describe("Max results to return (default 15)"),
});

export const searchTeamsMessagesDescription =
  "Search Microsoft Teams messages and conversations by keyword or topic. " +
  "Use when the user asks: 'search Teams for [topic]', 'find Teams messages about [subject]', " +
  "'what was discussed on Teams about [project]'. This searches across Teams channels " +
  "and chat messages using semantic search.";

export const searchTeamsMessagesInputSchema = z.object({
  query: z.string().describe("Search query — keywords, phrases, or topic"),
  channelName: z
    .string()
    .optional()
    .describe(
      "Filter to a specific Teams channel name (partial match supported)",
    ),
  limit: z
    .number()
    .optional()
    .default(15)
    .describe("Max results to return (default 15)"),
});

export const draftOutlookEmailDescription =
  "Draft an Outlook email through Microsoft Graph. Use when the user asks to write an email, " +
  "draft a reply, compose a message to someone via email. Always return a preview first with " +
  "the adaptive-card mail widget, then write only after confirmation.";

export const draftOutlookEmailInputSchema = z.object({
  senderEmail: z
    .string()
    .email()
    .optional()
    .describe(
      "Sender mailbox. If omitted, the configured Outlook sender is used.",
    ),
  to: z
    .array(
      z.object({
        email: z.string().email(),
        name: z.string().optional(),
      }),
    )
    .min(1)
    .describe("Primary recipients"),
  cc: z
    .array(
      z.object({
        email: z.string().email(),
        name: z.string().optional(),
      }),
    )
    .optional()
    .describe("CC recipients"),
  subject: z.string().describe("Email subject line"),
  body: z.string().describe("Email body content (plain text or basic HTML)"),
  importance: z.enum(["low", "normal", "high"]).default("normal"),
  projectId: z
    .number()
    .optional()
    .describe("Project ID if this email is tied to a project"),
  confirmed: z
    .boolean()
    .default(false)
    .describe("Set to true only after user confirms the preview"),
  idempotencyKey: z
    .string()
    .optional()
    .describe("Optional idempotency key to prevent duplicate sends"),
});

export const sendTeamsMessageDescription =
  "Send a message to a Microsoft Teams channel through Graph API. " +
  "Use when the user asks to post a message to a Teams channel, send " +
  "a Teams notification, or message the team about something. " +
  "Always return a preview first, then write only after confirmation.";

export const sendTeamsMessageInputSchema = z.object({
  channelName: z
    .string()
    .describe(
      "Target Teams channel name (partial match). Use 'General' for default.",
    ),
  teamName: z
    .string()
    .optional()
    .describe("Team name if ambiguous (partial match)"),
  message: z.string().describe("Message content (plain text or basic HTML)"),
  projectId: z
    .number()
    .optional()
    .describe("Project ID if this message is tied to a project"),
  confirmed: z
    .boolean()
    .default(false)
    .describe("Set to true only after user confirms the preview"),
  idempotencyKey: z
    .string()
    .optional()
    .describe("Optional idempotency key to prevent duplicate sends"),
});

export const outlookInviteAttendeeSchema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
  type: z.enum(["required", "optional"]).default("required"),
});

export const outlookMailRecipientSchema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
});

export const createOutlookCalendarInviteDescription =
  "Create an Outlook calendar invite through Microsoft Graph. Use when the user asks to schedule a meeting, " +
  "send a calendar invite, add something to Outlook, or create a Teams meeting invite. Always return a preview " +
  "first with the adaptive-card calendar widget, then write only after confirmation.";

export const createOutlookCalendarInviteInputSchema = z.object({
  organizerEmail: z
    .string()
    .email()
    .optional()
    .describe("Organizer mailbox. If omitted, the configured Outlook calendar user is used."),
  subject: z.string().describe("Invite subject"),
  body: z.string().describe("Invite body or agenda"),
  startDateTime: z
    .string()
    .describe("ISO-compatible local start date/time, e.g. 2026-05-13T14:00:00"),
  endDateTime: z.string().describe("ISO-compatible local end date/time"),
  timeZone: z.string().default("Eastern Standard Time"),
  location: z.string().default("Microsoft Teams"),
  attendees: z.array(outlookInviteAttendeeSchema).min(1),
  isOnlineMeeting: z.boolean().default(true),
  projectId: z.number().optional().describe("Project ID if this invite is tied to a project"),
  confirmed: z
    .boolean()
    .default(false)
    .describe("Set to true only after user confirms the preview"),
  idempotencyKey: z
    .string()
    .optional()
    .describe("Optional idempotency key to prevent duplicate sends"),
});
