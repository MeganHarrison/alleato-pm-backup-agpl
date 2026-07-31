import { NextResponse } from "next/server";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { listOutlookInboxMessages } from "@/lib/microsoft-graph/mail";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import {
  createOutlookIntakeServiceClient,
  createServiceClient,
} from "@/lib/supabase/service";
import { serviceDb } from "@/lib/supabase/service-db";

type MailboxStatsDay = {
  dateKey: string;
  label: string;
  liveCount: number | null;
  syncedCount: number;
  reviewedCount: number;
};

type AssistantReviewRow = {
  intake_email_id: number;
};

type IntakeRow = {
  id: number;
  received_at: string | null;
};

function formatDateKey(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

function parseShortOffsetMinutes(value: string): number {
  const match = value.match(/GMT([+-])(\d{1,2})(?::?(\d{2}))?/i);
  if (!match) return 0;
  const sign = match[1] === "-" ? -1 : 1;
  const hours = Number(match[2] ?? "0");
  const minutes = Number(match[3] ?? "0");
  return sign * (hours * 60 + minutes);
}

function timezoneOffsetMinutes(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "shortOffset",
    hour: "2-digit",
  }).formatToParts(date);
  const offset = parts.find((part) => part.type === "timeZoneName")?.value ?? "GMT+0";
  return parseShortOffsetMinutes(offset);
}

function zonedStartOfDay(dateKey: string, timeZone: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  const utcMidnight = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
  const offsetMinutes = timezoneOffsetMinutes(utcMidnight, timeZone);
  return new Date(utcMidnight.getTime() - offsetMinutes * 60_000);
}

function dayLabel(dateKey: string, todayKey: string, yesterdayKey: string): string {
  if (dateKey === todayKey) return "Today";
  if (dateKey === yesterdayKey) return "Yesterday";
  return dateKey;
}

export const GET = withApiGuardrails(
  "outlook-draft-feedback/mailbox-stats#GET",
  async ({ request }) => {
    const supabase = await createClient();
    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "outlook-draft-feedback/mailbox-stats#GET",
        message: "Authentication required.",
        status: 401,
      });
    }

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("is_admin")
      .eq("id", user.id)
      .maybeSingle();

    const isAdmin = profile?.is_admin === true;
    const { searchParams } = new URL(request.url);
    const mailboxUserId = searchParams.get("mailboxUserId")?.trim().toLowerCase() ?? "";
    const timeZone = searchParams.get("timeZone")?.trim() || "America/New_York";

    if (!mailboxUserId || !mailboxUserId.includes("@")) {
      throw new GuardrailError({
        code: "INVALID_PAYLOAD",
        where: "outlook-draft-feedback/mailbox-stats#GET",
        message: "mailboxUserId is required.",
        status: 400,
      });
    }

    if (!isAdmin && user.email?.toLowerCase() !== mailboxUserId) {
      throw new GuardrailError({
        code: "FORBIDDEN",
        where: "outlook-draft-feedback/mailbox-stats#GET",
        message: "Not authorized to read this mailbox coverage.",
        status: 403,
      });
    }

    const todayKey = formatDateKey(new Date(), timeZone);
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayKey = formatDateKey(yesterday, timeZone);
    const dayKeys = [todayKey, yesterdayKey];
    const sinceIso = zonedStartOfDay(yesterdayKey, timeZone).toISOString();

    const intakeService = createOutlookIntakeServiceClient();
    const appService = createServiceClient();

    const { data: intakeRows, error: intakeError } = await intakeService
      .from("outlook_email_intake")
      .select("id,received_at")
      .eq("mailbox_user_id", mailboxUserId)
      .gte("received_at", sinceIso)
      .order("received_at", { ascending: false })
      .limit(500);

    if (intakeError) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where: "outlook-draft-feedback/mailbox-stats#GET",
        message: intakeError.message,
      });
    }

    const intakeByDay = new Map<string, IntakeRow[]>();
    for (const row of (intakeRows ?? []) as IntakeRow[]) {
      if (!row.received_at) continue;
      const key = formatDateKey(new Date(row.received_at), timeZone);
      if (!dayKeys.includes(key)) continue;
      const existing = intakeByDay.get(key) ?? [];
      existing.push(row);
      intakeByDay.set(key, existing);
    }

    const intakeIds = (intakeRows ?? []).map((row) => row.id);
    const latestReviewByIntakeId = new Map<number, AssistantReviewRow>();
    if (intakeIds.length > 0) {
      const { data: reviewRows, error: reviewError } = await serviceDb.from("outlook_email_assistant_reviews")
        .select("intake_email_id")
        .eq("mailbox_user_id", mailboxUserId)
        .in("intake_email_id", intakeIds)
        .order("created_at", { ascending: false });

      if (reviewError) {
        throw new GuardrailError({
          code: "INTERNAL_ERROR",
          where: "outlook-draft-feedback/mailbox-stats#GET",
          message: reviewError.message,
        });
      }

      for (const row of (reviewRows ?? []) as AssistantReviewRow[]) {
        if (!latestReviewByIntakeId.has(row.intake_email_id)) {
          latestReviewByIntakeId.set(row.intake_email_id, row);
        }
      }
    }

    const liveInbox = await listOutlookInboxMessages({
      mailboxUserId,
      sinceIso,
      limit: 100,
    });

    const liveCounts = new Map<string, number>();
    let liveTruncated = false;
    let liveFetchedAt: string | null = null;
    let liveError: string | null = null;

    if (liveInbox.ok) {
      liveTruncated = liveInbox.truncated;
      liveFetchedAt = liveInbox.fetchedAt;
      for (const message of liveInbox.messages) {
        const key = formatDateKey(new Date(message.receivedAt), timeZone);
        if (!dayKeys.includes(key)) continue;
        liveCounts.set(key, (liveCounts.get(key) ?? 0) + 1);
      }
    } else {
      liveError = liveInbox.error;
    }

    const days: MailboxStatsDay[] = dayKeys.map((dateKey) => {
      const intakeRowsForDay = intakeByDay.get(dateKey) ?? [];
      return {
        dateKey,
        label: dayLabel(dateKey, todayKey, yesterdayKey),
        liveCount: liveError ? null : liveCounts.get(dateKey) ?? 0,
        syncedCount: intakeRowsForDay.length,
        reviewedCount: intakeRowsForDay.filter((row) =>
          latestReviewByIntakeId.has(row.id),
        ).length,
      };
    });

    return NextResponse.json({
      mailboxUserId,
      timeZone,
      days,
      liveFetchedAt,
      liveTruncated,
      liveError,
    });
  },
);
