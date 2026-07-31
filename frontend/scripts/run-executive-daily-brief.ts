#!/usr/bin/env tsx
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as dotenv from "dotenv";
import { createAiOpsLedger } from "../src/lib/ai-ops/ledger";
import { createServiceClient } from "../src/lib/supabase/service";
import type { AiEvent, AiRun, EvidenceRef } from "../src/lib/ai-ops/contracts";
import {
  EXECUTIVE_DAILY_BRIEF_WORKFLOW_ID,
  EXECUTIVE_DAILY_BRIEF_WORKFLOW_VERSION,
} from "../src/lib/ai-ops/executive-daily-brief-workflow";
import type { Database } from "../src/types/database.types";

dotenv.config({ path: resolve(process.cwd(), "../.env") });
dotenv.config({ path: resolve(process.cwd(), ".env") });
dotenv.config({ path: resolve(process.cwd(), ".env.local") });

type RunStatus = "running" | "succeeded" | "failed" | "skipped";
type SourceSyncRunInsert =
  Database["public"]["Tables"]["source_sync_runs"]["Insert"];
type SourceSyncRunUpdate =
  Database["public"]["Tables"]["source_sync_runs"]["Update"];

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };
type JsonObject = { [key: string]: JsonValue };

type LocalScheduleDecision = {
  shouldRun: boolean;
  timezone: string | null;
  targetLocalTime: string | null;
  currentLocalTime: string | null;
  currentLocalWeekday: number | null;
};

type OwnerBriefingDeliveryResponse = {
  ok?: boolean;
  skipped?: boolean;
  status?: string;
  reason?: string;
  sentAt?: string;
  refreshedAt?: string;
  draftId?: string;
  itemCount?: number;
  decisionsNeeded?: number;
  actionsRequired?: number;
  projectsShown?: number;
  recipients?: Array<{
    userId?: string;
    displayName?: string;
    recipientName?: string | null;
    sent?: boolean;
    reason?: string;
  }>;
  sourceSummary?: {
    generatedAt?: string;
    activeProjectCount?: number;
    stalePacketCount?: number;
    topProjects?: Array<{
      targetId?: string;
      projectId?: number | null;
      projectName?: string;
      packetId?: string | null;
      packetGeneratedAt?: string | null;
      packetIsStale?: boolean;
      decisionsNeeded?: OwnerBriefingSourceItem[];
      actionsRequired?: OwnerBriefingSourceItem[];
    }>;
  };
};

type OwnerBriefingSourceItem = {
  cardId?: string;
  cardType?: string;
  title?: string;
  summary?: string | null;
  whyItMatters?: string | null;
  nextAction?: string | null;
  confidence?: string;
  sourceCount?: number;
  firstSeenAt?: string | null;
  lastSeenAt?: string | null;
};

export type DeliveryProjection = {
  runStatus: AiRun["status"];
  deliveryStatus: AiRun["deliveryStatus"];
  sourceCounts: JsonObject;
  deliveryTarget: JsonObject;
  resultSummary: string;
};

const WORKFLOW_TITLE = "Executive Daily Brief";
const WORKFLOW_ID = EXECUTIVE_DAILY_BRIEF_WORKFLOW_ID;
const WORKFLOW_VERSION = EXECUTIVE_DAILY_BRIEF_WORKFLOW_VERSION;

function ledger() {
  return createAiOpsLedger(createServiceClient());
}

function cliArg(name: string): string | null {
  const prefix = `${name}=`;
  const match = process.argv.slice(2).find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : null;
}

function csvNumbers(value: string | undefined, fallback: number[]): number[] {
  if (!value?.trim()) return fallback;
  const numbers = value
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isInteger(item));
  return numbers.length > 0 ? numbers : fallback;
}

function localParts(now: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hourCycle: "h23",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  const weekday =
    ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(get("weekday")) +
    1;
  return { time: `${get("hour")}:${get("minute")}`, weekday };
}

export function localScheduleDecision(now = new Date()): LocalScheduleDecision {
  const timezone =
    process.env.EXECUTIVE_DAILY_BRIEF_TARGET_TIMEZONE?.trim() || null;
  const targetLocalTime =
    process.env.EXECUTIVE_DAILY_BRIEF_TARGET_LOCAL_TIME?.trim() || null;

  if (!timezone || !targetLocalTime) {
    return {
      shouldRun: true,
      timezone,
      targetLocalTime,
      currentLocalTime: null,
      currentLocalWeekday: null,
    };
  }

  const weekdays = csvNumbers(
    process.env.EXECUTIVE_DAILY_BRIEF_TARGET_WEEKDAYS,
    [1, 2, 3, 4, 5],
  );
  const current = localParts(now, timezone);

  return {
    shouldRun:
      current.time === targetLocalTime && weekdays.includes(current.weekday),
    timezone,
    targetLocalTime,
    currentLocalTime: current.time,
    currentLocalWeekday: current.weekday,
  };
}

function supabaseRestConfig() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url)
    throw new Error("SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL is required.");
  if (!key)
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is required.",
    );
  return { restUrl: `${url.replace(/\/+$/, "")}/rest/v1`, key };
}

async function supabaseRestFetch<T>(
  path: string,
  init: RequestInit,
  timeoutMs = 30_000,
): Promise<T> {
  const { restUrl, key } = supabaseRestConfig();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${restUrl}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        apikey: key,
        authorization: `Bearer ${key}`,
        "content-type": "application/json",
        ...(init.headers ?? {}),
      },
    });
    const text = await response.text();
    if (!response.ok)
      throw new Error(
        `Supabase REST ${response.status}: ${text.slice(0, 1000)}`,
      );
    return (text ? JSON.parse(text) : null) as T;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(
        `Supabase REST request timed out after ${timeoutMs}ms: ${path}`,
      );
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function triggerName(): string {
  return (
    cliArg("--trigger") ??
    process.env.EXECUTIVE_DAILY_BRIEF_TRIGGER ??
    "render_cron"
  );
}

function scheduleMetadata(schedule: LocalScheduleDecision): JsonObject {
  return {
    trigger: triggerName(),
    schedule: process.env.EXECUTIVE_DAILY_BRIEF_SCHEDULE ?? null,
    targetTimezone: schedule.timezone,
    targetLocalTime: schedule.targetLocalTime,
    currentLocalTime: schedule.currentLocalTime,
    currentLocalWeekday: schedule.currentLocalWeekday,
  };
}

function idempotencyKey(startedAt: string, suffix: string): string {
  return `${WORKFLOW_ID}:${triggerName()}:${startedAt}:${suffix}`;
}

async function createOperationEvent(params: {
  startedAt: string;
  schedule: LocalScheduleDecision;
  status: AiEvent["status"];
  eventType: AiEvent["eventType"];
  reason?: string;
}): Promise<{ id?: string }> {
  const payload: AiEvent = {
    eventSource: WORKFLOW_ID,
    eventType: params.eventType,
    status: params.status,
    idempotencyKey: idempotencyKey(params.startedAt, params.eventType),
    deliveryContext: {
      channel: "teams",
      endpoint: "/api/executive/daily-brief/send-teams",
    },
    permissionContext: {
      actor: "system",
      permissionMode: "service",
      requiresCronSecret: true,
    },
    payload: {
      workflowId: WORKFLOW_ID,
      schedule: scheduleMetadata(params.schedule),
      reason: params.reason ?? null,
    },
    metadata: {
      createdBy: "frontend/scripts/run-executive-daily-brief.ts",
      startedAt: params.startedAt,
    },
  };

  return ledger().createEvent(payload);
}

async function updateOperationEvent(
  eventId: string | undefined,
  payload: Pick<
    Partial<AiEvent>,
    "status" | "metadata" | "failureCode" | "failureMessage"
  >,
) {
  if (!eventId) return;
  await ledger().updateEvent(eventId, payload);
}

async function createWorkRun(payload: AiRun): Promise<{ id?: string }> {
  return ledger().createRun(payload);
}

async function updateWorkRun(
  workRunId: string | undefined,
  payload: Pick<
    Partial<AiRun>,
    | "status"
    | "sourceCounts"
    | "resultSummary"
    | "deliveryStatus"
    | "deliveryTarget"
    | "failureCode"
    | "failureMessage"
    | "completedAt"
    | "metadata"
  >,
) {
  if (!workRunId) return;
  await ledger().updateRun(workRunId, payload);
}

async function insertWorkRunSources(
  workRunId: string | undefined,
  refs: EvidenceRef[],
) {
  if (!workRunId || refs.length === 0) return;
  await ledger().insertEvidenceRefs(workRunId, refs);
}

async function createRun(
  startedAt: string,
  schedule: LocalScheduleDecision,
): Promise<{ id?: string }> {
  const payload = {
    source: WORKFLOW_ID,
    resource_id:
      process.env.EXECUTIVE_DAILY_BRIEF_RESOURCE_ID ??
      "scheduled_executive_daily_brief",
    resource_name: WORKFLOW_TITLE,
    stage: "generate_and_send",
    status: "running" satisfies RunStatus,
    started_at: startedAt,
    items_seen: 0,
    items_synced: 0,
    items_created: 0,
    items_updated: 0,
    items_skipped: 0,
    items_failed: 0,
    metadata: scheduleMetadata(schedule),
  } satisfies SourceSyncRunInsert;

  const rows = await supabaseRestFetch<Array<{ id?: string }>>(
    "/source_sync_runs?select=id",
    {
      method: "POST",
      headers: { prefer: "return=representation" },
      body: JSON.stringify(payload),
    },
  );
  return rows[0] ?? {};
}

async function updateRun(
  runId: string | undefined,
  payload: SourceSyncRunUpdate,
) {
  if (!runId) return;
  try {
    await supabaseRestFetch<unknown>(
      `/source_sync_runs?id=eq.${encodeURIComponent(runId)}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          ...payload,
          finished_at: new Date().toISOString(),
        }),
      },
    );
  } catch (error) {
    console.warn("[executive-daily-brief] Failed to update run row", {
      runId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

function frontendBaseUrl(): string {
  const configured =
    process.env.EXECUTIVE_DAILY_BRIEF_FRONTEND_BASE_URL ??
    process.env.NEXT_PUBLIC_APP_URL;
  if (!configured)
    throw new Error("EXECUTIVE_DAILY_BRIEF_FRONTEND_BASE_URL is required.");
  return configured.replace(/\/+$/, "");
}

async function deliverBriefing(): Promise<unknown> {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) throw new Error("CRON_SECRET is required.");

  const response = await fetch(
    `${frontendBaseUrl()}/api/executive/daily-brief/send-teams`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${cronSecret}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({}),
    },
  );
  const text = await response.text();
  let parsed: unknown = text;
  try {
    if (text) parsed = JSON.parse(text);
  } catch {
    /* keep raw */
  }
  if (!response.ok) {
    throw new Error(
      `Delivery failed ${response.status}: ${
        typeof parsed === "string"
          ? parsed.slice(0, 1000)
          : JSON.stringify(parsed)
      }`,
    );
  }
  return parsed;
}

function asDeliveryResponse(value: unknown): OwnerBriefingDeliveryResponse {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as OwnerBriefingDeliveryResponse;
}

export function summarizeDeliveryResult(result: unknown): DeliveryProjection {
  const delivery = asDeliveryResponse(result);
  const recipientCount = delivery.recipients?.length ?? 0;
  const sentCount =
    delivery.recipients?.filter((recipient) => recipient.sent).length ?? 0;
  const failedRecipientCount =
    delivery.recipients?.filter(
      (recipient) => recipient.sent === false && recipient.reason !== "dry_run",
    ).length ?? 0;

  if (delivery.skipped || delivery.status === "disabled") {
    return {
      runStatus: "skipped",
      deliveryStatus: "disabled",
      sourceCounts: { recipientCount, sentCount, failedRecipientCount },
      deliveryTarget: {
        channel: "teams",
        recipientCount,
        sentCount,
        failedRecipientCount,
      },
      resultSummary:
        delivery.reason ?? "Executive Daily Brief delivery is disabled.",
    };
  }

  if (delivery.ok === true && delivery.status === "sent") {
    return {
      runStatus: failedRecipientCount > 0 ? "partial_success" : "succeeded",
      deliveryStatus: "sent",
      sourceCounts: {
        decisionsNeeded: delivery.decisionsNeeded ?? 0,
        actionsRequired: delivery.actionsRequired ?? 0,
        projectsShown: delivery.projectsShown ?? 0,
        activeProjectCount: delivery.sourceSummary?.activeProjectCount ?? 0,
        stalePacketCount: delivery.sourceSummary?.stalePacketCount ?? 0,
        recipientCount,
        sentCount,
        failedRecipientCount,
      },
      deliveryTarget: {
        channel: "teams",
        recipientCount,
        sentCount,
        failedRecipientCount,
      },
      resultSummary:
        `Sent Executive Daily Brief to ${sentCount}/${recipientCount} Teams recipients; ` +
        `${delivery.decisionsNeeded ?? 0} decisions and ${delivery.actionsRequired ?? 0} actions surfaced.`,
    };
  }

  return {
    runStatus:
      delivery.status === "blocked" ? "partial_success" : "failed_permanent",
    deliveryStatus: delivery.status === "blocked" ? "blocked" : "failed",
    sourceCounts: { recipientCount, sentCount, failedRecipientCount },
    deliveryTarget: {
      channel: "teams",
      recipientCount,
      sentCount,
      failedRecipientCount,
    },
    resultSummary: delivery.reason ?? "Executive Daily Brief delivery failed.",
  };
}

export function buildWorkRunSourceRefs(params: {
  result: unknown;
}): EvidenceRef[] {
  const delivery = asDeliveryResponse(params.result);
  const refs: EvidenceRef[] = [];

  for (const project of delivery.sourceSummary?.topProjects ?? []) {
    if (project.packetId) {
      refs.push({
        sourceFamily: "intelligence_packet",
        sourceId: project.packetId,
        sourceTitle: project.projectName ?? "Project intelligence packet",
        occurredAt: project.packetGeneratedAt ?? null,
        excerpt: project.packetIsStale
          ? "Packet was stale when selected for the owner briefing."
          : "Packet was current when selected for the owner briefing.",
        confidence: "unknown",
        projectId: project.projectId ?? null,
        projectLabel: project.projectName ?? null,
        metadata: {
          targetId: project.targetId ?? null,
          packetIsStale: project.packetIsStale ?? null,
        },
      });
    }

    for (const item of [
      ...(project.decisionsNeeded ?? []),
      ...(project.actionsRequired ?? []),
    ]) {
      refs.push({
        sourceFamily: "insight_card",
        sourceId:
          item.cardId ??
          `${project.targetId ?? "project"}:${item.title ?? "insight"}`,
        sourceTitle: item.title ?? "Insight card",
        occurredAt: item.lastSeenAt ?? item.firstSeenAt ?? null,
        excerpt:
          item.summary ??
          item.whyItMatters ??
          item.nextAction ??
          "Insight card selected.",
        confidence: normalizeConfidence(item.confidence) ?? "unknown",
        projectId: project.projectId ?? null,
        projectLabel: project.projectName ?? null,
        metadata: {
          targetId: project.targetId ?? null,
          cardType: item.cardType ?? null,
          sourceCount: item.sourceCount ?? null,
          firstSeenAt: item.firstSeenAt ?? null,
          lastSeenAt: item.lastSeenAt ?? null,
        },
      });
    }
  }

  delivery.recipients?.forEach((recipient, index) => {
    refs.push({
      sourceFamily: "teams_recipient",
      sourceId:
        recipient.userId ??
        recipient.recipientName ??
        `teams-recipient-${index + 1}`,
      sourceTitle:
        recipient.displayName ?? recipient.recipientName ?? "Teams recipient",
      excerpt: recipient.sent
        ? "Teams delivery accepted for this recipient."
        : (recipient.reason ??
          "Teams delivery did not complete for this recipient."),
      confidence: "unknown",
      metadata: {
        sent: recipient.sent ?? null,
        reason: recipient.reason ?? null,
      },
    });
  });

  if (delivery.draftId) {
    refs.push({
      sourceFamily: "daily_recap",
      sourceId: delivery.draftId,
      sourceTitle: "Approved executive briefing draft",
      occurredAt: delivery.refreshedAt ?? delivery.sentAt ?? null,
      excerpt: "Approved daily recap draft selected for Teams delivery.",
      confidence: "unknown",
      metadata: { itemCount: delivery.itemCount ?? null },
    });
  }

  return refs;
}

function normalizeConfidence(
  value: string | undefined,
): "high" | "medium" | "low" | null {
  if (value === "high" || value === "medium" || value === "low") return value;
  return null;
}

function safeDeliveryMetadata(result: unknown): JsonObject {
  const delivery = asDeliveryResponse(result);
  return {
    ok: delivery.ok ?? null,
    status: delivery.status ?? null,
    skipped: delivery.skipped ?? null,
    reason: delivery.reason ?? null,
    sentAt: delivery.sentAt ?? delivery.refreshedAt ?? null,
    draftId: delivery.draftId ?? null,
    decisionsNeeded: delivery.decisionsNeeded ?? delivery.itemCount ?? null,
    actionsRequired: delivery.actionsRequired ?? null,
    projectsShown: delivery.projectsShown ?? null,
    activeProjectCount: delivery.sourceSummary?.activeProjectCount ?? null,
    stalePacketCount: delivery.sourceSummary?.stalePacketCount ?? null,
  };
}

function baseWorkRunPayload(params: {
  eventId?: string;
  sourceRunId?: string;
  startedAt: string;
  schedule: LocalScheduleDecision;
  status: AiRun["status"];
  completedAt?: string | null;
  reason?: string | null;
}): AiRun {
  const checkedAt = new Date().toISOString();
  return {
    eventId: params.eventId ?? null,
    sourceSyncRunId: params.sourceRunId ?? null,
    workflowId: WORKFLOW_ID,
    workflowVersion: WORKFLOW_VERSION,
    triggerType: triggerName(),
    surface: "executive_daily_brief",
    title: WORKFLOW_TITLE,
    userGoal: "Generate and deliver the Executive Daily Brief.",
    normalizedGoal:
      "Use curated intelligence sources to send an evidence-linked owner briefing to Teams.",
    status: params.status,
    priority: "high",
    permissionMode: "service",
    modelPolicy: { route: "owner-briefing-builder" },
    runtimeBudget: { scheduleWindow: params.schedule.targetLocalTime ?? null },
    toolScope: {
      sourceAdapters: [
        "intelligence_targets",
        "intelligence_packets",
        "insight_cards",
      ],
      deliveryAdapters: ["teams"],
      auditAdapters: ["source_sync_runs", "ai_work_runs"],
    },
    sourcePolicy: {
      requireAttributedCards: true,
      requireActiveCards: true,
      maxProjectsInCard: 5,
    },
    sourceHealth: [
      {
        sourceFamily: "project_intelligence",
        resourceId: "owner_briefing_delivery_sources",
        resourceName: "Owner briefing delivery source summary",
        status: params.status === "skipped" ? "skipped" : "unknown",
        checkedAt,
        loadedCount: 0,
        missingCount: 0,
        metadata: { schedule: scheduleMetadata(params.schedule) },
      },
    ],
    sourceCounts: {},
    artifacts: [],
    resultSummary: params.reason ?? null,
    deliveryStatus: params.status === "skipped" ? "skipped" : null,
    deliveryTarget: { channel: "teams" },
    retryable: params.status === "failed_retryable",
    startedAt: params.startedAt,
    completedAt: params.completedAt ?? null,
    metadata: { schedule: scheduleMetadata(params.schedule) },
  };
}

async function main() {
  // Kill switch: deactivated 2026-05-18 at user request. Default OFF.
  // Set EXECUTIVE_DAILY_BRIEF_ENABLED=true on the runtime to re-enable.
  const enabled =
    (process.env.EXECUTIVE_DAILY_BRIEF_ENABLED ?? "false").toLowerCase() ===
    "true";
  if (!enabled) {
    console.log(
      JSON.stringify(
        { ok: true, skipped: true, reason: "executive_daily_brief_disabled" },
        null,
        2,
      ),
    );
    return;
  }

  const nowArg = cliArg("--now");
  const schedule = localScheduleDecision(
    nowArg ? new Date(nowArg) : new Date(),
  );
  const startedAt = new Date().toISOString();

  if (!schedule.shouldRun) {
    const event = await createOperationEvent({
      startedAt,
      schedule,
      status: "ignored",
      eventType: "scheduled_check",
      reason: "outside_target_local_schedule",
    });
    const workRun = await createWorkRun(
      baseWorkRunPayload({
        eventId: event.id,
        startedAt,
        schedule,
        status: "skipped",
        completedAt: new Date().toISOString(),
        reason: "Outside target local schedule.",
      }),
    );
    console.log(
      JSON.stringify(
        {
          ok: true,
          skipped: true,
          reason: "outside_target_local_schedule",
          schedule,
          eventId: event.id ?? null,
          workRunId: workRun.id ?? null,
        },
        null,
        2,
      ),
    );
    return;
  }

  const event = await createOperationEvent({
    startedAt,
    schedule,
    status: "accepted",
    eventType: "scheduled_run",
  });
  const run = await createRun(startedAt, schedule);
  const workRun = await createWorkRun(
    baseWorkRunPayload({
      eventId: event.id,
      sourceRunId: run.id,
      startedAt,
      schedule,
      status: "running",
    }),
  );
  const startMs = Date.now();

  try {
    const result = await deliverBriefing();
    const projection = summarizeDeliveryResult(result);
    const completedAt = new Date().toISOString();
    const sourceRefs = buildWorkRunSourceRefs({ result });

    await insertWorkRunSources(workRun.id, sourceRefs);
    await updateOperationEvent(event.id, {
      status: "converted_to_run",
      metadata: {
        completedAt,
        durationMs: Date.now() - startMs,
        delivery: safeDeliveryMetadata(result),
      },
    });
    await updateWorkRun(workRun.id, {
      status: projection.runStatus,
      sourceCounts: projection.sourceCounts,
      resultSummary: projection.resultSummary,
      deliveryStatus: projection.deliveryStatus,
      deliveryTarget: projection.deliveryTarget,
      completedAt: completedAt,
      metadata: {
        schedule: scheduleMetadata(schedule),
        durationMs: Date.now() - startMs,
        delivery: safeDeliveryMetadata(result),
      },
    });
    await updateRun(run.id, {
      status:
        projection.runStatus === "failed_permanent" ? "failed" : "succeeded",
      items_seen: Number(projection.sourceCounts.activeProjectCount ?? 0),
      items_synced: projection.deliveryStatus === "sent" ? 1 : 0,
      items_updated: projection.deliveryStatus === "sent" ? 1 : 0,
      items_skipped: projection.deliveryStatus === "disabled" ? 1 : 0,
      metadata: {
        schedule: scheduleMetadata(schedule),
        delivery: safeDeliveryMetadata(result),
        aiOperationEventId: event.id ?? null,
        aiWorkRunId: workRun.id ?? null,
        durationMs: Date.now() - startMs,
      },
    });

    console.log(
      JSON.stringify(
        {
          ok: true,
          result,
          eventId: event.id ?? null,
          workRunId: workRun.id ?? null,
          sourceRows: sourceRefs.length,
          durationMs: Date.now() - startMs,
        },
        null,
        2,
      ),
    );
  } catch (error) {
    const message = (error instanceof Error ? error.message : String(error))
      .replace(/\s+/g, " ")
      .slice(0, 1800);
    const completedAt = new Date().toISOString();
    await updateOperationEvent(event.id, {
      status: "failed",
      failureCode: "EXECUTIVE_DAILY_BRIEF_FAILED",
      failureMessage: message,
      metadata: { completedAt, durationMs: Date.now() - startMs },
    }).catch((updateError) => {
      console.warn("[executive-daily-brief] Failed to update operation event", {
        error:
          updateError instanceof Error
            ? updateError.message
            : String(updateError),
      });
    });
    await updateWorkRun(workRun.id, {
      status: "failed_permanent",
      failureCode: "EXECUTIVE_DAILY_BRIEF_FAILED",
      failureMessage: message,
      deliveryStatus: "failed",
      completedAt: completedAt,
      metadata: {
        schedule: scheduleMetadata(schedule),
        durationMs: Date.now() - startMs,
      },
    }).catch((updateError) => {
      console.warn("[executive-daily-brief] Failed to update work run", {
        error:
          updateError instanceof Error
            ? updateError.message
            : String(updateError),
      });
    });
    await updateRun(run.id, {
      status: "failed" satisfies RunStatus,
      items_failed: 1,
      error_code: "EXECUTIVE_DAILY_BRIEF_FAILED",
      error_message: message,
      metadata: {
        schedule: scheduleMetadata(schedule),
        aiOperationEventId: event.id ?? null,
        aiWorkRunId: workRun.id ?? null,
        durationMs: Date.now() - startMs,
      },
    });
    console.error("[executive-daily-brief] failed:", message);
    process.exit(1);
  }
}

const isDirectRun = process.argv[1]
  ? resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  : false;

if (isDirectRun) {
  main();
}
