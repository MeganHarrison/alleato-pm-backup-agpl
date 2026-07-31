import { NextResponse } from "next/server";

import { requireCurrentUserExecutiveDetail } from "@/lib/executive/executive-visibility";
import {
  deliverCanonicalDailyBriefToTeams,
  type CanonicalDailyBriefTeamsDeliveryResult,
} from "@/lib/daily-briefs/canonical-teams-delivery";
import {
  completeDailyBriefRun,
  failDailyBriefRun,
  recordDeliveryAttempt,
  recordTeamsPayloadArtifact,
  startDailyBriefRun,
  type DailyBriefRunContext,
} from "@/lib/ai-ops/executive-daily-brief-ledger";
import type { SourceHealthSnapshot } from "@/lib/ai-ops/contracts";
import { loadGovernedExecutiveArtifact } from "@/lib/executive/governed-executive-artifact";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { getApiRouteUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function sourceHealthFromResult(
  result: CanonicalDailyBriefTeamsDeliveryResult,
): SourceHealthSnapshot[] {
  // `packet` is a required field on the `ok: true` member, so checking
  // `!result.ok` alone is sufficient to narrow to the `ok: false` member
  // (which has `reason`) — an `||` on `!result.packet` prevented that
  // narrowing without changing which branch actually runs.
  if (!result.ok) {
    return [
      {
        sourceFamily: "intelligence_packet",
        resourceId: "daily-executive-brief",
        resourceName: "Daily Executive Brief packet",
        status: "missing",
        checkedAt: new Date().toISOString(),
        loadedCount: 0,
        missingCount: 1,
        warning: result.reason,
        metadata: {},
      },
    ];
  }

  return [
    {
      sourceFamily: "intelligence_packet",
      resourceId: result.packet.id,
      resourceName: "Daily Executive Brief packet",
      status: "loaded",
      checkedAt: new Date().toISOString(),
      latestSourceAt: result.packet.generatedAt,
      loadedCount: result.packet.sourceCount,
      missingCount: 0,
      metadata: {
        targetSlug: "daily-executive-brief",
        businessDate: result.packet.businessDate,
        packetType: result.packet.packetType,
      },
    },
  ];
}

async function authorizeDailyBriefTeamsSend(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    return { authorizedBy: "cron_secret" };
  }

  await requireCurrentUserExecutiveDetail("executive/daily-brief/send-teams#POST");

  const user = await getApiRouteUser().catch(() => null);
  return { authorizedBy: user ? "session" : "capability" };
}

async function parseBody(request: Request): Promise<{ dryRun: boolean }> {
  try {
    const text = await request.text();
    if (!text) return { dryRun: false };
    const parsed = JSON.parse(text) as { dryRun?: unknown };
    return { dryRun: parsed.dryRun === true };
  } catch {
    return { dryRun: false };
  }
}

async function recordRecipientAttempts(input: {
  runContext: DailyBriefRunContext;
  result: Extract<CanonicalDailyBriefTeamsDeliveryResult, { ok: true }>;
  artifactId: string;
}) {
  for (const recipient of input.result.recipients) {
    await recordDeliveryAttempt(input.runContext, {
      artifactId: input.artifactId,
      channel: "teams",
      recipientId: recipient.userId,
      recipientAddress: recipient.email,
      status:
        recipient.reason === "dry_run"
          ? "dry_run"
          : recipient.sent
            ? "sent"
            : "failed",
      providerMessageId: recipient.providerMessageId ?? null,
      failureCode:
        !recipient.sent && recipient.reason !== "dry_run"
          ? "TEAMS_RECIPIENT_SEND_FAILED"
          : null,
      failureMessage:
        !recipient.sent && recipient.reason !== "dry_run"
          ? (recipient.reason ?? "Teams send failed for recipient.")
          : null,
      retryable: !recipient.sent && recipient.reason !== "dry_run",
      metadata: {
        displayName: recipient.displayName,
        reason: recipient.reason ?? null,
        providerResponse: recipient.providerResponse ?? null,
        packetId: input.result.packet.id,
      },
    });
  }
}

export const POST = withApiGuardrails(
  "executive/daily-brief/send-teams#POST",
  async ({ request }): Promise<Response> => {
    const auth = await authorizeDailyBriefTeamsSend(request);
    const body = await parseBody(request);
    const enabled =
      (process.env.EXECUTIVE_DAILY_BRIEF_ENABLED ?? "false").toLowerCase() ===
      "true";

    const runContext = await startDailyBriefRun({
      eventType: "teams_event",
      triggerType: body.dryRun
        ? "manual_teams_dry_run"
        : enabled
          ? "manual_teams_send"
          : "teams_delivery_disabled",
      surface: "executive_daily_brief_send_teams",
      title: "Executive Daily Brief Teams delivery",
      userGoal: "Deliver the canonical Daily Executive Brief to Teams.",
      normalizedGoal:
        "Send or dry-run the canonical intelligence_packets/daily-executive-brief packet and record delivery evidence.",
      deliveryTarget: {
        channel: "teams",
        dryRun: body.dryRun,
        deliveryEnabled: enabled,
      },
      payload: {
        dryRun: body.dryRun,
        sourceOfTruth: "intelligence_packets",
        targetSlug: "daily-executive-brief",
      },
      metadata: auth,
    });

    if (!enabled && !body.dryRun) {
      await recordDeliveryAttempt(runContext, {
        channel: "teams",
        status: "disabled",
        failureCode: "EXECUTIVE_DAILY_BRIEF_DISABLED",
        failureMessage:
          "Executive Daily Brief Teams delivery is disabled by configuration.",
        metadata: {
          reason: "executive_daily_brief_disabled",
          sourceOfTruth: "intelligence_packets",
          targetSlug: "daily-executive-brief",
        },
      });
      await completeDailyBriefRun(runContext, {
        status: "skipped",
        deliveryStatus: "disabled",
        resultSummary: "Executive Daily Brief Teams delivery is disabled.",
        deliveryTarget: {
          channel: "teams",
          deliveryEnabled: false,
        },
        sourceCounts: {},
        sourceHealth: [],
        metadata: {
          reason: "executive_daily_brief_disabled",
          sourceOfTruth: "intelligence_packets",
          targetSlug: "daily-executive-brief",
        },
      });

      return NextResponse.json({
        ok: true,
        skipped: true,
        status: "disabled",
        reason: "executive_daily_brief_disabled",
        runId: runContext.runId,
        sourceOfTruth: "intelligence_packets",
      });
    }

    try {
      const governedArtifact = await loadGovernedExecutiveArtifact("daily");
      if (governedArtifact.integrity !== "ready") {
        const reason = `${governedArtifact.integrity === "blocked" ? "Executive artifact integrity failure" : "Executive artifact is limited"}: ${governedArtifact.failures.join(" ")}`;
        await recordDeliveryAttempt(runContext, {
          channel: "teams",
          status: "blocked",
          failureCode: "EXECUTIVE_ARTIFACT_INTEGRITY_BLOCKED",
          failureMessage: reason,
          metadata: { governedArtifactVersionId: governedArtifact.id, packetId: governedArtifact.packet.id },
        });
        await completeDailyBriefRun(runContext, {
          status: "partial_success",
          deliveryStatus: "blocked",
          resultSummary: reason,
          deliveryTarget: { channel: "teams", dryRun: body.dryRun },
          sourceHealth: sourceHealthFromResult({ ok: false, status: "blocked", reason }),
          metadata: { governedArtifactVersionId: governedArtifact.id, packetId: governedArtifact.packet.id, integrity: governedArtifact.integrity },
        });
        return NextResponse.json({ ok: false, status: "blocked", reason, governedArtifactVersionId: governedArtifact.id }, { status: 409 });
      }
      const result = await deliverCanonicalDailyBriefToTeams({
        dryRun: body.dryRun,
        packet: governedArtifact.packet,
      });

      if (!result.ok) {
        await recordDeliveryAttempt(runContext, {
          channel: "teams",
          status: result.status,
          failureCode:
            result.status === "blocked"
              ? "TEAMS_DELIVERY_BLOCKED"
              : "TEAMS_DELIVERY_FAILED",
          failureMessage: result.reason,
          retryable: result.status === "failed",
          metadata: {
            reason: result.reason,
            sourceOfTruth: "intelligence_packets",
          },
        });
        await completeDailyBriefRun(runContext, {
          status:
            result.status === "blocked"
              ? "partial_success"
              : "failed_permanent",
          deliveryStatus: result.status === "blocked" ? "blocked" : "failed",
          resultSummary: result.reason,
          deliveryTarget: { channel: "teams", dryRun: body.dryRun },
          sourceHealth: sourceHealthFromResult(result),
          metadata: { reason: result.reason },
        });
        return NextResponse.json(
          {
            ...result,
            runId: runContext.runId,
            sourceOfTruth: "intelligence_packets",
          },
          { status: result.status === "blocked" ? 400 : 500 },
        );
      }

      const artifact = await recordTeamsPayloadArtifact(runContext, {
        title: body.dryRun
          ? "Daily Executive Brief Teams dry-run payload"
          : "Daily Executive Brief Teams delivery payload",
        contentType: "application/vnd.microsoft.teams.card+json",
        storageTable: "intelligence_packets",
        storageId: result.packet.id,
        metadata: {
          packetId: result.packet.id,
          businessDate: result.packet.businessDate,
          sourceCount: result.packet.sourceCount,
          dryRun: body.dryRun,
          recipientCount: result.recipients.length,
          sourceOfTruth: "intelligence_packets",
          targetSlug: "daily-executive-brief",
          governedArtifactVersionId: governedArtifact.id,
          integrity: governedArtifact.integrity,
        },
      });
      await recordRecipientAttempts({
        runContext,
        result,
        artifactId: artifact.id,
      });

      const sentCount = result.recipients.filter(
        (recipient) => recipient.sent,
      ).length;
      const failedRecipientCount = result.recipients.filter(
        (recipient) => !recipient.sent && recipient.reason !== "dry_run",
      ).length;
      const deliveryStatus = body.dryRun
        ? "dry_run"
        : failedRecipientCount > 0 && sentCount === 0
          ? "failed"
          : "sent";

      await completeDailyBriefRun(runContext, {
        status: body.dryRun
          ? "succeeded"
          : failedRecipientCount === 0
            ? "succeeded"
            : sentCount > 0
              ? "partial_success"
              : "failed_permanent",
        deliveryStatus,
        resultSummary: body.dryRun
          ? `Built Teams dry-run for canonical packet ${result.packet.id}.`
          : `Sent canonical Daily Executive Brief to ${sentCount}/${result.recipients.length} Teams recipient(s).`,
        deliveryTarget: {
          channel: "teams",
          dryRun: body.dryRun,
          recipientCount: result.recipients.length,
          sentCount,
          failedRecipientCount,
        },
        sourceCounts: {
          sourceCount: result.packet.sourceCount,
          sectionCount: result.packet.sections.length,
          recipientCount: result.recipients.length,
          sentCount,
          failedRecipientCount,
        },
        sourceHealth: sourceHealthFromResult(result),
        metadata: {
          packetId: result.packet.id,
          businessDate: result.packet.businessDate,
          sourceOfTruth: "intelligence_packets",
          targetSlug: "daily-executive-brief",
        },
      });

      return NextResponse.json({
        ...result,
        card: undefined,
        runId: runContext.runId,
        sourceOfTruth: "intelligence_packets",
      });
    } catch (error) {
      await failDailyBriefRun(
        runContext,
        error,
        "EXECUTIVE_DAILY_BRIEF_TEAMS_SEND_FAILED",
      );
      throw error;
    }
  },
);
