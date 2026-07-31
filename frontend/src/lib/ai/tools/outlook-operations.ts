import { tool } from "ai";
import { z } from "zod";
import { type ToolTracePayload, withTrace as _withTrace } from "./tool-utils";
import { listOutlookCalendarEvents } from "@/lib/microsoft-graph/calendar-events";
import { createToolContext, type ToolContext } from "./tool-context";

import { type AnyRow } from "./types";
type OutlookOperationsStatus = "healthy" | "degraded";

export type CreateOutlookOperationsToolsOptions = {
  onTrace?: (trace: ToolTracePayload) => void;
  pinnedProjectId?: number;
  // Injected data seam; defaults to building a real context when omitted.
  ctx?: ToolContext;
};

function withTrace<TInput extends Record<string, unknown>, TResult>(
  name: string,
  options: CreateOutlookOperationsToolsOptions,
  execute: (input: TInput) => Promise<TResult>,
) {
  return _withTrace(
    name,
    options,
    execute,
    "Outlook operations failed during retrieval. Tell the user exactly which Outlook source could not be checked, then continue with any other successful data instead of ending the response.",
  );
}

function normalizeSubscription(row: AnyRow) {
  return {
    id: row.id,
    source: row.source,
    resource: row.resource,
    resourceId: row.resource_id,
    resourceName: row.resource_name,
    changeType: row.change_type,
    status: row.status,
    expirationAt: row.expiration_at,
    lastNotificationAt: row.last_notification_at,
    lastLifecycleEventAt: row.last_lifecycle_event_at,
    lastRenewedAt: row.last_renewed_at,
    lastErrorMessage: row.last_error_message,
  };
}

function normalizeSyncState(row: AnyRow) {
  return {
    id: row.id,
    source: row.source,
    resourceId: row.resource_id,
    resourceName: row.resource_name,
    syncStatus: row.sync_status,
    lastSyncAt: row.last_sync_at,
    itemsSynced: row.items_synced,
    errorMessage: row.error_message,
    updatedAt: row.updated_at,
  };
}

export function evaluateOutlookOperationsStatus({
  activeSubscriptionCount,
  erroredSyncStateCount,
  source,
  subscriptionCount,
  syncStateCount,
}: {
  activeSubscriptionCount: number;
  erroredSyncStateCount: number;
  source: "outlook_email" | "all_graph";
  subscriptionCount: number;
  syncStateCount: number;
}): { status: OutlookOperationsStatus; warnings: string[] } {
  const warnings: string[] = [];

  if (activeSubscriptionCount === 0) {
    warnings.push(
      `No active ${source === "outlook_email" ? "Outlook email" : "Microsoft Graph"} subscriptions are registered. Treat real-time webhook monitoring as degraded until a subscription is active.`,
    );
  }

  if (subscriptionCount === 0 && syncStateCount === 0) {
    warnings.push(
      "No Graph subscription or sync-state rows were visible to the assistant operations tool. Verify the RAG Supabase client/env and table permissions before reporting Outlook monitoring as healthy.",
    );
  }

  if (erroredSyncStateCount > 0) {
    warnings.push(
      "One or more Graph sync-state rows are errored. Review graph_sync_state.error_message before reporting Outlook ingestion as healthy.",
    );
  }

  return {
    status: warnings.length > 0 ? "degraded" : "healthy",
    warnings,
  };
}

export function createOutlookOperationsTools(
  userId: string,
  options: CreateOutlookOperationsToolsOptions = {},
) {
  const ctx = options.ctx ?? createToolContext({ userId, pinnedProjectId: options.pinnedProjectId });
  const ragSupabase = ctx.rag;
  const guardrails = ctx.guardrails;

  async function requireAdminForOutlook() {
    const scope = await guardrails.getScope();
    if (scope.isAdmin) return { ok: true as const };
    return {
      ok: false as const,
      error:
        "Outlook mailbox access is admin-only in Alleato. I can still use project records, meetings, and documents you have access to.",
    };
  }

  return {
    getOutlookOperationsStatus: tool({
      description:
        "Check Outlook/Microsoft Graph operational status for real-time email capability: Graph subscriptions, webhook notifications, sync freshness, and errors. Use when the user asks whether Outlook monitoring, notifications, or real-time email querying is working.",
      inputSchema: z.object({
        source: z.enum(["outlook_email", "all_graph"]).optional().default("outlook_email"),
      }),
      execute: withTrace(
        "getOutlookOperationsStatus",
        options,
        async ({ source }) => {
          const access = await requireAdminForOutlook();
          if (!access.ok) return { error: access.error };

          const targetSource = source ?? "outlook_email";
          let subscriptionQuery = ragSupabase
            .from("graph_subscriptions")
            .select(
              "id,source,resource,resource_id,resource_name,change_type,status,expiration_at,last_notification_at,last_lifecycle_event_at,last_renewed_at,last_error_message",
            )
            .order("updated_at", { ascending: false })
            .limit(20);
          let syncQuery = ragSupabase
            .from("graph_sync_state")
            .select("id,source,resource_id,resource_name,sync_status,last_sync_at,items_synced,error_message,updated_at")
            .order("updated_at", { ascending: false })
            .limit(20);

          if (targetSource === "outlook_email") {
            subscriptionQuery = subscriptionQuery.eq("source", "outlook_email");
            syncQuery = syncQuery.eq("source", "outlook_email");
          }

          const [
            { data: subscriptions, error: subscriptionError },
            { data: syncStates, error: syncError },
          ] = await Promise.all([subscriptionQuery, syncQuery]);

          if (subscriptionError) {
            throw new Error(`Graph subscription lookup failed: ${subscriptionError.message}`);
          }
          if (syncError) {
            throw new Error(`Graph sync-state lookup failed: ${syncError.message}`);
          }

          const normalizedSubscriptions = ((subscriptions ?? []) as AnyRow[]).map(normalizeSubscription);
          const normalizedSyncStates = ((syncStates ?? []) as AnyRow[]).map(normalizeSyncState);
          const activeSubscriptions = normalizedSubscriptions.filter((row) => row.status === "active");
          const erroredSyncStates = normalizedSyncStates.filter((row) => row.syncStatus === "error" || row.errorMessage);
          const operationsStatus = evaluateOutlookOperationsStatus({
            source: targetSource,
            subscriptionCount: normalizedSubscriptions.length,
            activeSubscriptionCount: activeSubscriptions.length,
            syncStateCount: normalizedSyncStates.length,
            erroredSyncStateCount: erroredSyncStates.length,
          });

          return {
            source: targetSource,
            status: operationsStatus.status,
            warnings: operationsStatus.warnings,
            subscriptionCount: normalizedSubscriptions.length,
            activeSubscriptionCount: activeSubscriptions.length,
            syncStateCount: normalizedSyncStates.length,
            erroredSyncStateCount: erroredSyncStates.length,
            subscriptions: normalizedSubscriptions,
            syncStates: normalizedSyncStates,
            failsLoudly:
              "Webhook notifications are recorded into source_sync_runs and subscription/sync failures are visible through graph_subscriptions, graph_sync_state, source-sync health, and Render cron failures. Zero active subscriptions or zero visible operational rows must be reported as degraded, not healthy.",
          };
        },
      ),
    }),

    // -----------------------------------------------------------------------
    // getOutlookCalendarEvents — read the owner's Outlook calendar.
    // -----------------------------------------------------------------------

    getOutlookCalendarEvents: tool({
      description:
        "Read calendar events from Outlook for a date window. " +
        "Use this when the user asks 'what meetings do I have today / tomorrow / this week', " +
        "'is my calendar free Tuesday afternoon', 'who am I meeting with', 'what's next on my schedule'. " +
        "Use createOutlookCalendarInvite for WRITES (scheduling); this tool only READS. " +
        "Returns event subject, start/end (in America/New_York timezone), location, attendees, organizer, " +
        "online meeting join URL, and importance. Recurring meetings are expanded into individual instances " +
        "within the window. Cancelled and all-day events are included; the caller can filter as needed.",
      inputSchema: z.object({
        window: z
          .enum([
            "today",
            "tomorrow",
            "this_week",
            "next_week",
            "next_24_hours",
            "next_7_days",
            "custom",
          ])
          .default("tomorrow")
          .describe(
            "Convenience window. Use 'custom' with startIso/endIso for arbitrary ranges.",
          ),
        startIso: z
          .string()
          .optional()
          .describe("Required when window='custom'. ISO 8601 timestamp; assumed America/New_York if no offset."),
        endIso: z
          .string()
          .optional()
          .describe("Required when window='custom'. Exclusive end timestamp."),
        userEmail: z
          .string()
          .optional()
          .describe(
            "Mailbox to read (e.g. 'bclymer@alleatogroup.com'). Defaults to the configured owner mailbox.",
          ),
        limit: z
          .number()
          .int()
          .min(1)
          .max(50)
          .optional()
          .default(25)
          .describe("Max events to return (1-50, default 25)."),
        includeCancelled: z
          .boolean()
          .optional()
          .default(false)
          .describe("If false (default), cancelled events are filtered out of the result."),
      }),
      execute: withTrace(
        "getOutlookCalendarEvents",
        options,
        async ({ window, startIso, endIso, userEmail, limit, includeCancelled }) => {
          const access = await requireAdminForOutlook();
          if (!access.ok) return { error: access.error };

          const resolved = resolveCalendarWindow(window, startIso, endIso);
          if ("error" in resolved) return { error: resolved.error };

          const result = await listOutlookCalendarEvents({
            startIso: resolved.startIso,
            endIso: resolved.endIso,
            userEmail: userEmail ?? null,
            limit: limit ?? 25,
          });

          if (!result.ok) {
            return { error: result.error, userEmail: result.userEmail ?? null };
          }

          const events = includeCancelled
            ? result.events
            : result.events.filter((event) => !event.isCancelled);

          return {
            userEmail: result.userEmail,
            window,
            startIso: resolved.startIso,
            endIso: resolved.endIso,
            timezone: "America/New_York",
            eventCount: events.length,
            truncated: result.truncated,
            events: events.map((event) => ({
              id: event.id,
              subject: event.subject,
              start: event.startDateTime,
              end: event.endDateTime,
              isAllDay: event.isAllDay,
              isCancelled: event.isCancelled,
              location: event.location,
              organizerEmail: event.organizerEmail,
              organizerName: event.organizerName,
              attendees: event.attendees.slice(0, 12).map((a) => ({
                email: a.email,
                name: a.name,
                response: a.response,
                type: a.type,
              })),
              attendeeCount: event.attendees.length,
              bodyPreview: event.bodyPreview,
              joinUrl: event.joinUrl,
              webLink: event.webLink,
              importance: event.importance,
              showAs: event.showAs,
              responseStatus: event.responseStatus,
            })),
            failsLoudly:
              "If Graph returns an auth or permission error, the tool surfaces it inline in the `error` field and the AI must explain to the user which mailbox or permission is missing rather than pretending the calendar was checked.",
          };
        },
      ),
    }),
  };
}

// ---------------------------------------------------------------------------
// Calendar window helper — resolves enum windows to ISO timestamps in the
// America/New_York timezone (the owner's local timezone).
// ---------------------------------------------------------------------------

function resolveCalendarWindow(
  window: "today" | "tomorrow" | "this_week" | "next_week" | "next_24_hours" | "next_7_days" | "custom",
  startIsoInput?: string,
  endIsoInput?: string,
): { startIso: string; endIso: string } | { error: string } {
  if (window === "custom") {
    if (!startIsoInput || !endIsoInput) {
      return {
        error:
          "window='custom' requires both startIso and endIso (ISO 8601 with offset).",
      };
    }
    return { startIso: startIsoInput, endIso: endIsoInput };
  }

  const now = new Date();
  const easternToday = easternDayBounds(now, 0);

  switch (window) {
    case "today":
      return easternToday;
    case "tomorrow":
      return easternDayBounds(now, 1);
    case "this_week": {
      // ET-local week boundary: today 00:00 → Sunday 23:59 of the same ET week.
      const startOfTodayLocal = easternStartOfDay(now, 0);
      const daysToSunday = 7 - localEasternDayOfWeek(now); // 0=Sun..6=Sat
      const endLocal = easternStartOfDay(now, daysToSunday + 1);
      return { startIso: startOfTodayLocal, endIso: endLocal };
    }
    case "next_week": {
      const daysToNextMon = 8 - localEasternDayOfWeek(now);
      const startLocal = easternStartOfDay(now, daysToNextMon);
      const endLocal = easternStartOfDay(now, daysToNextMon + 7);
      return { startIso: startLocal, endIso: endLocal };
    }
    case "next_24_hours":
      return {
        startIso: now.toISOString(),
        endIso: new Date(now.getTime() + 24 * 3_600_000).toISOString(),
      };
    case "next_7_days":
      return {
        startIso: now.toISOString(),
        endIso: new Date(now.getTime() + 7 * 24 * 3_600_000).toISOString(),
      };
  }
}

function easternDayBounds(now: Date, daysFromToday: number): { startIso: string; endIso: string } {
  return {
    startIso: easternStartOfDay(now, daysFromToday),
    endIso: easternStartOfDay(now, daysFromToday + 1),
  };
}

function easternStartOfDay(now: Date, daysFromToday: number): string {
  // Compute today's ET calendar date, advance by N days, then format as
  // "<date>T00:00:00<eastern-offset>". Graph accepts this and will
  // interpret it in the embedded offset's timezone.
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const year = Number(get("year"));
  const month = Number(get("month"));
  const day = Number(get("day"));
  // Compose the date in UTC then shift by daysFromToday whole days.
  const base = new Date(Date.UTC(year, month - 1, day + daysFromToday, 12, 0, 0));
  const baseEasternDate = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(base);
  const getBase = (type: string) => baseEasternDate.find((p) => p.type === type)?.value ?? "";
  const y = getBase("year");
  const m = getBase("month");
  const d = getBase("day");
  const offset = easternOffset(base);
  return `${y}-${m}-${d}T00:00:00${offset}`;
}

function easternOffset(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    timeZoneName: "shortOffset",
    hour: "2-digit",
  }).formatToParts(d);
  const value = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT-05";
  const match = value.match(/GMT([+-])(\d{1,2})(?::?(\d{2}))?/);
  if (!match) return "-05:00";
  const sign = match[1];
  const hours = match[2].padStart(2, "0");
  const minutes = (match[3] ?? "00").padStart(2, "0");
  return `${sign}${hours}:${minutes}`;
}

function localEasternDayOfWeek(d: Date): number {
  // 0 = Sunday, 6 = Saturday — in America/New_York timezone.
  const name = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
  }).format(d);
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return map[name] ?? 0;
}
