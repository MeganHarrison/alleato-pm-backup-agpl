/**
 * Owner Briefing Delivery — orchestrates the daily Teams send for Brandon and
 * Megan. Replaces sendApprovedExecutiveBriefingToTeams (legacy path that
 * blasted all bot users with a daily_recaps packet built from raw documents).
 *
 * Flow:
 *   1. Build the briefing data from Pipeline B (insight_cards + intelligence_packets).
 *   2. Build the Adaptive Card.
 *   3. Send to each owner via the bot framework proactive channel.
 *   4. Audit the send in `source_sync_runs`.
 */

import { createRagServiceClient } from "@/lib/supabase/service";
import type { Json } from "@/types/rag-database.types";
import {
  buildOwnerBriefingData,
  type OwnerBriefingData,
} from "./owner-briefing-builder";
import { buildOwnerBriefingCard } from "./owner-briefing-card";
import { withExecutiveDailyBriefObservation } from "@/lib/ai/executive-daily-brief-langfuse";
import {
  OWNER_BRIEFING_RECIPIENTS,
  type OwnerBriefingRecipient,
} from "./owner-briefing-recipients";

export type OwnerBriefingDeliveryResult =
  | {
      ok: true;
      status: "sent";
      sentAt: string;
      recipients: Array<{
        userId: string;
        email: string;
        displayName: string;
        sent: boolean;
        reason?: string;
        providerMessageId?: string | null;
        providerResponse?: Record<string, unknown> | null;
      }>;
      decisionsNeeded: number;
      actionsRequired: number;
      projectsShown: number;
      sourceSummary: OwnerBriefingSourceSummary;
    }
  | {
      ok: false;
      status: "blocked" | "failed";
      reason: string;
    };

export type OwnerBriefingSourceSummary = {
  generatedAt: string;
  activeProjectCount: number;
  stalePacketCount: number;
  topProjects: Array<{
    targetId: string;
    projectId: number | null;
    projectName: string;
    packetId: string | null;
    packetGeneratedAt: string | null;
    packetIsStale: boolean;
    decisionsNeeded: Array<OwnerBriefingSourceItem>;
    actionsRequired: Array<OwnerBriefingSourceItem>;
  }>;
};

export type OwnerBriefingSourceItem = {
  cardId: string;
  cardType: string;
  title: string;
  summary: string | null;
  whyItMatters: string | null;
  nextAction: string | null;
  confidence: string;
  sourceCount: number;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
};

const DELIVERY_SOURCE = "owner_briefing";

export async function sendOwnerBriefingToTeams(input: {
  /** Override recipient list for testing. Defaults to OWNER_BRIEFING_RECIPIENTS. */
  recipients?: OwnerBriefingRecipient[];
  /** Optional override for `now` to reproduce a specific day's brief. */
  now?: Date;
  /** Dry run — build the card and data but do not send. */
  dryRun?: boolean;
}): Promise<OwnerBriefingDeliveryResult> {
  const recipients = input.recipients ?? OWNER_BRIEFING_RECIPIENTS;
  if (recipients.length === 0) {
    return { ok: false, status: "blocked", reason: "no_recipients_configured" };
  }

  const appBaseUrl =
    process.env.EXECUTIVE_DAILY_BRIEF_FRONTEND_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "https://projects.alleatogroup.com";

  const actionToken =
    process.env.OWNER_BRIEFING_ACTION_TOKEN?.trim() ||
    process.env.CRON_SECRET?.trim() ||
    "";

  if (!actionToken) {
    return {
      ok: false,
      status: "blocked",
      reason:
        "OWNER_BRIEFING_ACTION_TOKEN (or CRON_SECRET) must be set so Acknowledge/Snooze links can authenticate.",
    };
  }

  const auditClient = createRagServiceClient();
  const runStartedAt = new Date().toISOString();
  const runMetadata = {
    recipients: recipients.map((r) => ({
      id: r.supabaseUserId,
      email: r.email,
    })),
    dryRun: Boolean(input.dryRun),
  };

  const { data: auditRow, error: auditInsertError } = await auditClient
    .from("source_sync_runs")
    .insert({
      source: DELIVERY_SOURCE,
      resource_id: "scheduled_owner_briefing",
      stage: "source_sync",
      status: "running",
      started_at: runStartedAt,
      metadata: runMetadata as unknown as Json,
    })
    .select("id")
    .single();
  if (auditInsertError || !auditRow) {
    return {
      ok: false,
      status: "failed",
      reason: `Failed to insert audit row: ${auditInsertError?.message ?? "unknown"}`,
    };
  }
  const auditId = auditRow.id;

  try {
    // Single shared briefing object — same content for both recipients. We
    // only personalize the greeting via the per-recipient firstName when
    // rebuilding the card.
    const briefing = await withExecutiveDailyBriefObservation(
      "daily-brief.owner-briefing.build-data",
      {
        type: "retriever",
        input: {
          recipientCount: recipients.length,
          dryRun: Boolean(input.dryRun),
        },
        metadata: {
          recipientCount: recipients.length,
          dryRun: Boolean(input.dryRun),
        },
      },
      () =>
        buildOwnerBriefingData({
          recipientName: recipients[0].firstName,
          now: input.now,
        }),
    );

    const sendResults = await Promise.all(
      recipients.map(
        async (
          recipient,
        ): Promise<{
          userId: string;
          email: string;
          displayName: string;
          sent: boolean;
          reason?: string;
          providerMessageId?: string | null;
          providerResponse?: Record<string, unknown> | null;
        }> => {
          const personalized: OwnerBriefingData = {
            ...briefing,
            recipientName: recipient.firstName,
            greeting: rewriteGreeting(briefing.greeting, recipient.firstName),
          };
          const card = await withExecutiveDailyBriefObservation(
            "daily-brief.teams.build-card",
            {
              type: "chain",
              input: {
                userId: recipient.supabaseUserId,
                dryRun: Boolean(input.dryRun),
              },
              metadata: {
                userId: recipient.supabaseUserId,
                dryRun: Boolean(input.dryRun),
                decisionsNeeded: briefing.portfolio.totalDecisionsNeeded,
                actionsRequired: briefing.portfolio.totalActionsRequired,
                projectsShown: briefing.topProjects.length,
              },
            },
            async () =>
              buildOwnerBriefingCard(personalized, {
                appBaseUrl,
                actionToken,
              }),
          );

          if (input.dryRun) {
            return {
              userId: recipient.supabaseUserId,
              email: recipient.email,
              displayName: recipient.displayName,
              sent: false,
              reason: "dry_run",
            };
          }

          try {
            const { sendProactiveCard } = await import("@/lib/bot/teams-chat");
            const providerResponse = await withExecutiveDailyBriefObservation(
              "daily-brief.teams.send-recipient",
              {
                type: "tool",
                input: {
                  userId: recipient.supabaseUserId,
                  displayName: recipient.displayName,
                },
                metadata: {
                  userId: recipient.supabaseUserId,
                  recipientDomain: recipient.email.split("@")[1] ?? "unknown",
                },
              },
              () => sendProactiveCard(recipient.supabaseUserId, card),
            );
            const normalizedProviderResponse =
              normalizeProviderResponse(providerResponse);
            return {
              userId: recipient.supabaseUserId,
              email: recipient.email,
              displayName: recipient.displayName,
              sent: true,
              providerMessageId: extractProviderMessageId(
                normalizedProviderResponse,
              ),
              providerResponse: normalizedProviderResponse,
            };
          } catch (err) {
            const reason = err instanceof Error ? err.message : String(err);
            console.error("[owner-briefing] send failed", {
              userId: recipient.supabaseUserId,
              email: recipient.email,
              reason,
            });
            return {
              userId: recipient.supabaseUserId,
              email: recipient.email,
              displayName: recipient.displayName,
              sent: false,
              reason,
            };
          }
        },
      ),
    );

    const finishedAt = new Date().toISOString();
    const result: OwnerBriefingDeliveryResult = {
      ok: true,
      status: "sent",
      sentAt: finishedAt,
      recipients: sendResults,
      decisionsNeeded: briefing.portfolio.totalDecisionsNeeded,
      actionsRequired: briefing.portfolio.totalActionsRequired,
      projectsShown: briefing.topProjects.length,
      sourceSummary: buildOwnerBriefingSourceSummary(briefing),
    };

    await auditClient
      .from("source_sync_runs")
      .update({
        status: sendResults.some((r) => r.sent) ? "succeeded" : "failed",
        finished_at: finishedAt,
        metadata: {
          ...runMetadata,
          decisionsNeeded: briefing.portfolio.totalDecisionsNeeded,
          actionsRequired: briefing.portfolio.totalActionsRequired,
          projectsShown: briefing.topProjects.length,
          stalePacketCount: briefing.portfolio.stalePacketCount,
          sendResults,
        } as unknown as Json,
      })
      .eq("id", auditId)
      .throwOnError();

    return result;
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    const finishedAt = new Date().toISOString();
    await auditClient
      .from("source_sync_runs")
      .update({
        status: "failed",
        finished_at: finishedAt,
        metadata: { ...runMetadata, error: reason } as unknown as Json,
      })
      .eq("id", auditId);
    return { ok: false, status: "failed", reason };
  }
}

function rewriteGreeting(greeting: string, firstName: string): string {
  // The builder always renders "Good morning, <name>." — swap the name.
  return greeting.replace(/, [^.]+\./, `, ${firstName}.`);
}

function normalizeProviderResponse(
  value: unknown,
): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function extractProviderMessageId(
  value: Record<string, unknown> | null,
): string | null {
  if (!value) return null;
  const candidates = [
    value.id,
    value.messageId,
    value.message_id,
    value.activityId,
    value.activity_id,
  ];
  const match = candidates.find(
    (candidate) => typeof candidate === "string" && candidate.trim().length > 0,
  );
  return typeof match === "string" ? match : null;
}

function buildOwnerBriefingSourceSummary(
  briefing: OwnerBriefingData,
): OwnerBriefingSourceSummary {
  return {
    generatedAt: briefing.generatedAt,
    activeProjectCount: briefing.portfolio.activeProjectCount,
    stalePacketCount: briefing.portfolio.stalePacketCount,
    topProjects: briefing.topProjects.map((project) => ({
      targetId: project.targetId,
      projectId: project.projectId,
      projectName: project.projectName,
      packetId: project.packetId,
      packetGeneratedAt: project.packetGeneratedAt,
      packetIsStale: project.packetIsStale,
      decisionsNeeded: project.decisionsNeeded.map(toSourceItem),
      actionsRequired: project.actionsRequired.map(toSourceItem),
    })),
  };
}

type OwnerBriefingProjectItem =
  OwnerBriefingData["topProjects"][number]["decisionsNeeded"][number];

function toSourceItem(item: OwnerBriefingProjectItem): OwnerBriefingSourceItem {
  return {
    cardId: item.cardId,
    cardType: item.cardType,
    title: item.title,
    summary: item.summary,
    whyItMatters: item.whyItMatters,
    nextAction: item.nextAction,
    confidence: item.confidence,
    sourceCount: item.sourceCount,
    firstSeenAt: item.firstSeenAt,
    lastSeenAt: item.lastSeenAt,
  };
}
