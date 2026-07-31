import { Actions, Card, CardText, Divider, LinkButton } from "chat";
import type { CardChild, PostableCard } from "chat";

import type { OwnerBriefingRecipient } from "@/lib/executive/owner-briefing-recipients";
import { OWNER_BRIEFING_RECIPIENTS } from "@/lib/executive/owner-briefing-recipients";
import {
  loadCurrentDailyExecutiveBriefPacket,
  type CanonicalDailyBriefPacket,
} from "./canonical-packets";

export type CanonicalDailyBriefTeamsRecipientResult = {
  userId: string;
  email: string;
  displayName: string;
  sent: boolean;
  reason?: string;
  providerMessageId?: string | null;
  providerResponse?: Record<string, unknown> | null;
};

export type CanonicalDailyBriefTeamsDeliveryResult =
  | {
      ok: true;
      status: "sent" | "dry_run";
      sentAt: string;
      packet: CanonicalDailyBriefPacket;
      card: PostableCard;
      recipients: CanonicalDailyBriefTeamsRecipientResult[];
    }
  | {
      ok: false;
      status: "blocked" | "failed";
      reason: string;
      packet?: CanonicalDailyBriefPacket;
      card?: PostableCard;
    };

export type CanonicalDailyBriefTeamsPreview = {
  sourceOfTruth: "intelligence_packets";
  targetSlug: "daily-executive-brief";
  packetId: string;
  businessDate: string;
  sourceCount: number;
  card: PostableCard;
  fallbackText: string;
};

const DEFAULT_APP_BASE_URL = "https://projects.alleatogroup.com";

function appBaseUrl() {
  return (
    process.env.EXECUTIVE_DAILY_BRIEF_FRONTEND_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    DEFAULT_APP_BASE_URL
  );
}

/**
 * Deep link to the on-demand PDF render of a brief packet. The route
 * (`/api/executive/daily-brief/[briefId]/pdf`) generates a branded PDF at click
 * time, guarded by the same `view_executive_briefing` capability that gates the
 * brief page — so the "Download PDF" button is always fresh and never leaks the
 * brief to an unauthenticated visitor.
 */
export function dailyBriefPdfUrl(packetId: string, baseUrl = appBaseUrl()) {
  return `${baseUrl}/api/executive/daily-brief/${encodeURIComponent(packetId)}/pdf`;
}

function clip(value: string, maxLength: number) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(0, maxLength - 3)).trim()}...`;
}

function sectionChildren(packet: CanonicalDailyBriefPacket): CardChild[] {
  const children: CardChild[] = [];
  const sections = packet.sections.slice(0, 5);

  if (sections.length === 0) {
    children.push(
      CardText("The canonical packet did not include rendered sections.", {
        style: "muted",
      }),
    );
    return children;
  }

  for (const section of sections) {
    children.push(Divider());
    children.push(CardText(section.title, { style: "bold" }));
    children.push(CardText(clip(section.body, 900)));
  }

  return children;
}

function sourceSummary(packet: CanonicalDailyBriefPacket) {
  const countParts = Object.entries(packet.sourceCounts)
    .slice(0, 4)
    .map(([label, count]) => `${label}: ${count}`);
  const counts = countParts.length > 0 ? ` (${countParts.join(", ")})` : "";
  return `${packet.sourceCount} source${packet.sourceCount === 1 ? "" : "s"}${counts}`;
}

export function buildCanonicalDailyBriefTeamsCard(
  packet: CanonicalDailyBriefPacket,
): PostableCard {
  const children: CardChild[] = [
    CardText(`Business date: ${packet.businessDate}`),
    CardText(`Source coverage: ${sourceSummary(packet)}`, { style: "muted" }),
  ];

  if (packet.generatedAt) {
    children.push(
      CardText(`Compiled: ${packet.generatedAt}`, { style: "muted" }),
    );
  }

  children.push(...sectionChildren(packet));
  children.push(Divider());
  children.push(
    Actions([
      LinkButton({
        label: "Open brief",
        url: `${appBaseUrl()}/daily-briefs/${packet.id}`,
      }),
      LinkButton({
        label: "Download PDF",
        url: dailyBriefPdfUrl(packet.id),
      }),
      LinkButton({
        label: "Open Alleato",
        url: appBaseUrl(),
      }),
    ]),
  );

  const card = Card({
    title: `Daily Executive Brief - ${packet.businessDate}`,
    subtitle: `Canonical packet ${packet.id}`,
    children,
  });

  return {
    card,
    fallbackText: `Daily Executive Brief - ${packet.businessDate}. ${packet.sourceCount} source${packet.sourceCount === 1 ? "" : "s"}.`,
  };
}

export async function previewCanonicalDailyBriefTeamsPayload(
  packet?: CanonicalDailyBriefPacket,
): Promise<CanonicalDailyBriefTeamsPreview> {
  const resolvedPacket =
    packet ?? (await loadCurrentDailyExecutiveBriefPacket());
  const card = buildCanonicalDailyBriefTeamsCard(resolvedPacket);

  return {
    sourceOfTruth: "intelligence_packets",
    targetSlug: "daily-executive-brief",
    packetId: resolvedPacket.id,
    businessDate: resolvedPacket.businessDate,
    sourceCount: resolvedPacket.sourceCount,
    card,
    fallbackText:
      card.fallbackText ??
      `Daily Executive Brief - ${resolvedPacket.businessDate}.`,
  };
}

function normalizeProviderResponse(
  value: unknown,
): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
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

export async function deliverCanonicalDailyBriefToTeams(
  input: {
    dryRun?: boolean;
    recipients?: OwnerBriefingRecipient[];
    packet?: CanonicalDailyBriefPacket;
  } = {},
): Promise<CanonicalDailyBriefTeamsDeliveryResult> {
  const recipients = input.recipients ?? OWNER_BRIEFING_RECIPIENTS;
  if (recipients.length === 0) {
    return { ok: false, status: "blocked", reason: "no_recipients_configured" };
  }

  const packet = input.packet ?? (await loadCurrentDailyExecutiveBriefPacket());
  const card = buildCanonicalDailyBriefTeamsCard(packet);
  const sentAt = new Date().toISOString();

  if (input.dryRun) {
    return {
      ok: true,
      status: "dry_run",
      sentAt,
      packet,
      card,
      recipients: recipients.map((recipient) => ({
        userId: recipient.supabaseUserId,
        email: recipient.email,
        displayName: recipient.displayName,
        sent: false,
        reason: "dry_run",
      })),
    };
  }

  const { sendProactiveCard } = await import("@/lib/bot/teams-chat");
  const results = await Promise.all(
    recipients.map(async (recipient) => {
      try {
        const providerResponse = await sendProactiveCard(
          recipient.supabaseUserId,
          card,
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
      } catch (error) {
        return {
          userId: recipient.supabaseUserId,
          email: recipient.email,
          displayName: recipient.displayName,
          sent: false,
          reason: error instanceof Error ? error.message : String(error),
        };
      }
    }),
  );

  return {
    ok: true,
    status: "sent",
    sentAt,
    packet,
    card,
    recipients: results,
  };
}
