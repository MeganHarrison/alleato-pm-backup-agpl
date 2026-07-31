import { Card, CardText as ChatText, Divider, Actions, LinkButton } from "chat";
import type { PostableCard, CardChild } from "chat";
import {
  type BrandonBriefItem,
  type BrandonDailyUpdatePacket,
} from "@/lib/executive/brandon-daily-update";
import {
  formatExecutiveBriefingTeamsMessage,
  getBriefHeader,
  getBullets,
  insightLine,
  linkedClaimSources,
  projectName,
} from "@/lib/executive/executive-briefing-render";

export { formatExecutiveBriefingTeamsMessage } from "@/lib/executive/executive-briefing-render";

export type ExecutiveBriefingTeamsSendResult =
  | {
      ok: true;
      status: "sent";
      draftId: string;
      recipients: Array<{ userId: string; recipientName: string | null }>;
      itemCount: number;
      refreshedAt: string;
    }
  | {
      ok: false;
      status: "blocked" | "skipped";
      reason: string;
      draftId?: string;
      workflowStatus?: string;
      userId?: string | null;
    };

export function buildExecutiveBriefingCard(
  packet: BrandonDailyUpdatePacket,
  firstName: string | null,
  options: { now?: Date } = {},
): PostableCard {
  const now = options.now ?? new Date();
  const { today, greeting } = getBriefHeader(now, firstName);

  const { needsBrandon, waitingOnOthers, importantUpdates } = packet.sections;
  const updates = importantUpdates;

  const children: CardChild[] = [];

  const renderItem = (item: BrandonBriefItem, heading: string, bulletMax: number) => {
    children.push(ChatText(heading, { style: "bold" }));
    for (const bullet of getBullets(item, bulletMax)) {
      children.push(ChatText(`• ${bullet}`));
    }
    const insight = insightLine(item);
    if (insight) {
      children.push(ChatText(`What this means: ${insight}`, { style: "muted" }));
    }
    const sources = linkedClaimSources(item);
    if (sources.length > 0) {
      children.push(
        ChatText(
          sources.map((source) => `[${source.label}](${source.href})`).join("  ·  "),
          { style: "muted" },
        ),
      );
    }
  };

  if (needsBrandon.length > 0) {
    children.push(Divider());
    children.push(ChatText(`Needs your attention (${needsBrandon.length})`, { style: "bold" }));
    needsBrandon.forEach((item, i) =>
      renderItem(item, `${i + 1}. ${projectName(item.project)}`, 4),
    );
  }

  if (waitingOnOthers.length > 0) {
    children.push(Divider());
    children.push(ChatText(`Waiting on others (${waitingOnOthers.length})`, { style: "bold" }));
    for (const item of waitingOnOthers) {
      renderItem(item, projectName(item.project), 3);
    }
  }

  if (updates.length > 0) {
    children.push(Divider());
    children.push(ChatText(`Worth knowing (${updates.length})`, { style: "bold" }));
    for (const item of updates) {
      renderItem(item, projectName(item.project), 3);
    }
  }

  const totalItems = needsBrandon.length + waitingOnOthers.length + updates.length;
  children.push(Divider());
  children.push(
    ChatText(
      totalItems > 0
        ? "Each item links to its source — open it for the full meeting, email, or thread."
        : "Nothing needs your attention today.",
      { style: "muted" },
    ),
  );

  children.push(
    Actions([
      LinkButton({ label: "Open Alleato", url: "https://projects.alleatogroup.com" }),
    ]),
  );

  const card = Card({
    title: `Daily Brief — ${today}`,
    subtitle: greeting,
    children,
  });

  return {
    card,
    fallbackText: `Daily Brief — ${today}. ${greeting} ${totalItems} item${totalItems !== 1 ? "s" : ""} require attention.`,
  };
}

export async function sendApprovedExecutiveBriefingToTeams(
  _options: { userId?: string | null } = {},
): Promise<ExecutiveBriefingTeamsSendResult> {
  throw new Error(
    "Deprecated Executive Daily Brief Teams sender is blocked. Use /api/executive/daily-brief/send-teams so the AI Operations run, delivery attempt, provider result, and artifacts are recorded.",
  );
}
