/**
 * Owner Briefing Card — the Adaptive-Card-rendered daily Teams message.
 *
 * Built with the `chat` package DSL (Card, CardText, Divider, Fields, Actions,
 * LinkButton) which the @chat-adapter/teams adapter converts to a native
 * Adaptive Card v1.5 payload when posted to a Teams thread.
 *
 * Design principles:
 * 1. Action-oriented: every project section ends with explicit action buttons.
 * 2. Scannable: title, why-it-matters, and next-action are visually distinct.
 * 3. Ranked by urgency — most urgent project appears first.
 * 4. Stale-aware: projects with old packets show an inline warning.
 * 5. Density-tuned: caps cards per section to fit Teams' 28KB limit.
 */

import { Card, CardText, Divider, Actions, LinkButton } from "chat";
import type { PostableCard, CardChild } from "chat";

import type {
  InsightCardType,
} from "@/lib/ai/intelligence/types";
import type {
  OwnerBriefingCardItem,
  OwnerBriefingData,
  OwnerBriefingProject,
} from "./owner-briefing-builder";

// -----------------------------------------------------------------------------
// Card-type → emoji marker. Adaptive Cards via the chat DSL don't expose the
// Fluent Icon library, so we use emoji as visual markers. Keep them tight.
// -----------------------------------------------------------------------------

const CARD_TYPE_ICON: Record<InsightCardType, string> = {
  risk: "⚠️",
  blocker: "⛔",
  financial_exposure: "💵",
  schedule_risk: "⏰",
  decision: "🟢",
  change_management: "🔁",
  open_question: "❓",
  task: "✅",
  product_need: "📦",
  process_issue: "🔧",
  project_update: "📌",
  requirement: "📋",
  sentiment: "💬",
  initiative_signal: "🧭",
};

const NEW_TAG = "🆕";

// -----------------------------------------------------------------------------
// Build the card
// -----------------------------------------------------------------------------

export type BuildOwnerBriefingCardOptions = {
  appBaseUrl: string;
  /** Token used to authenticate Acknowledge/Snooze redirects. */
  actionToken: string;
};

export function buildOwnerBriefingCard(
  data: OwnerBriefingData,
  options: BuildOwnerBriefingCardOptions,
): PostableCard {
  const children: CardChild[] = [];

  // ── Header summary — one line of urgency context ─────────────────────────
  children.push(buildHeaderSummary(data));

  // ── Portfolio strip — 4 key counts on one row ────────────────────────────
  children.push(Divider());
  children.push(buildPortfolioStrip(data));

  if (data.topProjects.length === 0) {
    children.push(Divider());
    children.push(
      CardText(
        "Nothing requires your decision right now — all active projects look clean.",
        { style: "muted" },
      ),
    );
  } else {
    // ── Per-project sections ───────────────────────────────────────────────
    for (const project of data.topProjects) {
      children.push(Divider());
      pushProjectSection(children, project, options);
    }
  }

  // ── Footer ─────────────────────────────────────────────────────────────
  children.push(Divider());
  children.push(
    Actions([
      LinkButton({
        label: "Open full briefing",
        url: `${options.appBaseUrl}/ai?intent=owner-brief`,
      }),
      LinkButton({
        label: "Open Alleato",
        url: options.appBaseUrl,
      }),
    ]),
  );

  const card = Card({
    title: `Owner Brief · ${data.dateLabel}`,
    subtitle: data.greeting,
    children,
  });

  const fallbackText = buildFallbackText(data);
  return { card, fallbackText };
}

// -----------------------------------------------------------------------------
// Sections
// -----------------------------------------------------------------------------

function buildHeaderSummary(data: OwnerBriefingData): CardChild {
  const { portfolio } = data;
  const segments: string[] = [];
  if (portfolio.totalDecisionsNeeded > 0) {
    segments.push(
      `**${portfolio.totalDecisionsNeeded}** ${pluralize("decision", portfolio.totalDecisionsNeeded)} need you`,
    );
  }
  if (portfolio.totalActionsRequired > 0) {
    segments.push(
      `**${portfolio.totalActionsRequired}** open ${pluralize("action", portfolio.totalActionsRequired)}`,
    );
  }
  if (portfolio.totalNewSinceYesterday > 0) {
    segments.push(`**${portfolio.totalNewSinceYesterday}** new since yesterday`);
  }
  if (segments.length === 0) {
    return CardText(
      `Portfolio looks clean across ${portfolio.activeProjectCount} active projects.`,
    );
  }
  return CardText(segments.join(" · "));
}

function buildPortfolioStrip(data: OwnerBriefingData): CardChild {
  const { portfolio } = data;
  // The chat DSL Fields/Field maps to FactSet in Adaptive Cards. Pack key
  // counts here for a scannable left-aligned label/value list.
  const parts: string[] = [
    `🏗 ${portfolio.activeProjectCount} active`,
    `🎯 ${portfolio.totalDecisionsNeeded} decisions`,
    `📝 ${portfolio.totalActionsRequired} actions`,
  ];
  if (portfolio.stalePacketCount > 0) {
    parts.push(`⚠️ ${portfolio.stalePacketCount} stale`);
  }
  return CardText(parts.join("  ·  "), { style: "muted" });
}

function pushProjectSection(
  children: CardChild[],
  project: OwnerBriefingProject,
  options: BuildOwnerBriefingCardOptions,
): void {
  // Project header — name + freshness signal.
  const freshnessNote = project.packetIsStale
    ? buildStaleNote(project)
    : project.packetAgeHours !== null
      ? `Packet refreshed ${formatAgeHours(project.packetAgeHours)} ago`
      : null;

  children.push(
    CardText(
      `**${cleanProjectName(project.projectName)}** · ${sectionCountLabel(project)}`,
      { style: "bold" },
    ),
  );
  if (freshnessNote) {
    children.push(CardText(freshnessNote, { style: "muted" }));
  }

  // ── Decisions ─────────────────────────────────────────────────────
  if (project.decisionsNeeded.length > 0) {
    children.push(CardText("Decisions Needed", { style: "bold" }));
    for (const item of project.decisionsNeeded) {
      pushCardItem(children, item, project, options);
    }
  }

  // ── Actions ───────────────────────────────────────────────────────
  if (project.actionsRequired.length > 0) {
    children.push(CardText("Open Actions", { style: "bold" }));
    for (const item of project.actionsRequired) {
      pushCardItem(children, item, project, options);
    }
  }
}

function pushCardItem(
  children: CardChild[],
  item: OwnerBriefingCardItem,
  project: OwnerBriefingProject,
  options: BuildOwnerBriefingCardOptions,
): void {
  const icon = CARD_TYPE_ICON[item.cardType] ?? "•";
  const newMarker = item.isNewSinceYesterday ? ` ${NEW_TAG}` : "";

  // Title line — icon + title + new tag.
  children.push(CardText(`${icon} **${clip(item.title, 100)}**${newMarker}`));

  // Why it matters — italicized, subtle.
  if (item.whyItMatters && item.whyItMatters.trim().length > 0) {
    children.push(
      CardText(`_Why:_ ${clip(item.whyItMatters, 160)}`, { style: "muted" }),
    );
  }

  // Next action — what to do.
  if (item.nextAction && item.nextAction.trim().length > 0) {
    children.push(CardText(`**Next:** ${clip(item.nextAction, 160)}`));
  }

  // Action buttons — Acknowledge + Open. Snooze is in the app detail view.
  children.push(
    Actions([
      LinkButton({
        label: "Acknowledge",
        url: buildCardActionUrl({
          base: options.appBaseUrl,
          cardId: item.cardId,
          action: "acknowledge",
          token: options.actionToken,
        }),
      }),
      LinkButton({
        label: "Snooze 24h",
        url: buildCardActionUrl({
          base: options.appBaseUrl,
          cardId: item.cardId,
          action: "snooze",
          token: options.actionToken,
        }),
      }),
      LinkButton({
        label: "Open",
        url: buildCardOpenUrl({
          base: options.appBaseUrl,
          projectId: project.projectId,
          cardId: item.cardId,
        }),
      }),
    ]),
  );
}

// -----------------------------------------------------------------------------
// Small helpers
// -----------------------------------------------------------------------------

function sectionCountLabel(project: OwnerBriefingProject): string {
  const parts: string[] = [];
  if (project.decisionsNeeded.length > 0) {
    parts.push(`${project.decisionsNeeded.length} ${pluralize("decision", project.decisionsNeeded.length)}`);
  }
  if (project.actionsRequired.length > 0) {
    parts.push(`${project.actionsRequired.length} ${pluralize("action", project.actionsRequired.length)}`);
  }
  return parts.join(" · ");
}

function buildStaleNote(project: OwnerBriefingProject): string {
  if (project.packetAgeHours === null) {
    return "⚠️ Packet missing — compiler may be stalled for this target";
  }
  return `⚠️ Packet last refreshed ${formatAgeHours(project.packetAgeHours)} ago — data may be out of date`;
}

function formatAgeHours(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  if (hours < 24) return `${Math.round(hours)}h`;
  return `${Math.round(hours / 24)}d`;
}

function cleanProjectName(name: string): string {
  return name.replace(/^\d+[\s\-:]+/, "").trim() || name;
}

function clip(value: string | null | undefined, max: number): string {
  const s = String(value ?? "").replace(/\s+/g, " ").trim();
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const stop = Math.max(cut.lastIndexOf("."), cut.lastIndexOf("?"), cut.lastIndexOf("!"));
  if (stop >= max * 0.5) return cut.slice(0, stop + 1);
  const sp = cut.lastIndexOf(" ");
  return (sp > 0 ? cut.slice(0, sp) : cut) + "…";
}

function pluralize(word: string, count: number): string {
  return count === 1 ? word : `${word}s`;
}

function buildCardActionUrl(params: {
  base: string;
  cardId: string;
  action: "acknowledge" | "snooze";
  token: string;
}): string {
  const search = new URLSearchParams({
    token: params.token,
    return: `${params.base}/ai?intent=owner-brief`,
  });
  return `${params.base}/api/insight-cards/${params.cardId}/${params.action}?${search.toString()}`;
}

function buildCardOpenUrl(params: {
  base: string;
  projectId: number | null;
  cardId: string;
}): string {
  if (params.projectId) {
    return `${params.base}/${params.projectId}?card=${encodeURIComponent(params.cardId)}`;
  }
  return `${params.base}/ai?card=${encodeURIComponent(params.cardId)}`;
}

function buildFallbackText(data: OwnerBriefingData): string {
  const counts = `${data.portfolio.totalDecisionsNeeded} decisions, ${data.portfolio.totalActionsRequired} actions`;
  return `Owner Brief · ${data.dateLabel}. ${data.greeting} ${counts}.`;
}
