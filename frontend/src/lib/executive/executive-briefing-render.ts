/**
 * Pure rendering helpers for the executive Daily Brief.
 *
 * This module has NO dependency on the `chat` Adaptive Card library, so it can
 * be imported from scripts, API routes, and the Teams text-send path. The
 * Adaptive Card builder in `executive-briefing-teams-delivery.ts` reuses these
 * helpers; the plain-text renderer (`formatExecutiveBriefingTeamsMessage`)
 * lives here and is what we send to Teams as a normal-width message.
 */
import type {
  BrandonBriefItem,
  BrandonDailyUpdatePacket,
} from "@/lib/executive/brandon-daily-update";

export const APP_BASE_URL =
  process.env.NEXT_PUBLIC_APP_URL?.trim() ||
  "https://projects.alleatogroup.com";

// Strip a leading project code so only the readable name remains:
//   "31 Uniqlo..." → "Uniqlo...", "26-103 Exol Wilmer" → "Exol Wilmer".
export function projectName(value: string | null | undefined): string {
  const s = String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (!s || /^no project linked$/i.test(s)) return "Company-wide";
  // "Multiple (8 projects)" → "Across 8 projects" (no sloppy parentheses).
  const multiple = s.match(/^multiple\s*\((\d+)\s*projects?\)$/i);
  if (multiple) return `Across ${multiple[1]} projects`;
  if (/^\d+\s+(?:[NSEW]|north|south|east|west)\b/i.test(s)) return s;
  return s.replace(/^\d[\d-]*\s+/, "").trim() || s;
}

// Clip at sentence/word boundary.
export function clip(value: string | null | undefined, max = 110): string {
  const s = String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const dot = Math.max(
    cut.lastIndexOf("."),
    cut.lastIndexOf("?"),
    cut.lastIndexOf("!"),
  );
  if (dot >= 50) return cut.slice(0, dot + 1);
  const sp = cut.lastIndexOf(" ");
  return (sp > 0 ? cut.slice(0, sp) : cut) + "…";
}

function sentence(value: string): string {
  const text = value.trim();
  if (!text) return text;
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

// Strip "Label: " prefix the AI sometimes adds to bullets. Keep just the substance.
export function cleanBullet(s: string): string {
  return s
    .replace(/^[A-Z][^:]{0,40}:\s*/, "")
    .replace(/^[-•]\s*/, "")
    .trim();
}

// Return up to `max` clean bullet strings for an item.
export function getBullets(item: BrandonBriefItem, max = 3): string[] {
  const bullets = (item.bullets ?? [])
    .map(cleanBullet)
    .filter((b) => b.length > 8)
    .slice(0, max);
  if (bullets.length > 0) return bullets.map((b) => clip(b, 240));
  return [clip(item.summary ?? item.recommendedAction, 240)];
}

// Markdown bullet list ("- ...") for the plain-text renderer.
export function bulletBlock(item: BrandonBriefItem, max = 3): string {
  return getBullets(item, max)
    .map((b) => `- ${b}`)
    .join("\n");
}

function projectIdFromLabel(value: string | null | undefined): number | null {
  const match = String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .match(/^(\d{2,5})\b/);
  return match ? Number.parseInt(match[1], 10) : null;
}

// Resolve the in-app project id for routing: prefer the internal DB id the
// pipeline stored, fall back to the numeric prefix on the project label
// ("1016 GW Kokomo" → 1016).
function resolveProjectId(item: BrandonBriefItem): number | null {
  if (
    typeof item.projectInternalId === "number" &&
    item.projectInternalId > 0
  ) {
    return item.projectInternalId;
  }
  return projectIdFromLabel(item.project);
}

// Build a link that lands on the in-app detail page for the source, by type:
//   meeting → /{projectId}/meetings/{sourceId}  or  /meetings/{sourceId}
//   email / teams / document
//           → /{projectId}/intelligence/sources/{sourceId}  or
//             /intelligence/sources/{sourceId}
// Every route is keyed by document_metadata.id, which is exactly the sourceId
// the brief carries. The in-app page is ALWAYS preferred over the raw external
// URL (Outlook web for emails, the transcript .md for meetings, SharePoint for
// documents) — those external targets are precisely what owners don't want to
// land on. Both a project-scoped and a global route exist, so a source with no
// resolved project still links in-app. We only fall back to the external URL
// when there is no sourceId to build an in-app link from.
function citationHref(item: BrandonBriefItem, index: number): string | null {
  const citation = item.citations[index];
  if (!citation) return null;
  const sourceId = citation.sourceId?.trim();
  const projectId = resolveProjectId(item);

  if (sourceId) {
    const scope = projectId ? `${projectId}/` : "";
    const path =
      citation.source === "Meeting"
        ? `${scope}meetings/${encodeURIComponent(sourceId)}`
        : `${scope}intelligence/sources/${encodeURIComponent(sourceId)}`;
    return `${APP_BASE_URL}/${path}`;
  }

  if (citation.sourceUrl?.trim()) return citation.sourceUrl.trim();
  return null;
}

function citationLabel(item: BrandonBriefItem, index: number): string {
  const citation = item.citations[index];
  if (!citation) return "Source";
  const title = citation.sourceDetail?.trim();
  if (title) return clip(title, 70);
  // No title — fall back to a plain type name.
  return citation.source === "Meeting"
    ? "Meeting recording"
    : citation.source === "Email"
      ? "Email"
      : citation.source === "Teams"
        ? "Teams thread"
        : "Source";
}

export function linkedClaimSources(
  item: BrandonBriefItem,
  max = 2,
): Array<{ label: string; href: string }> {
  const links: Array<{ label: string; href: string }> = [];
  const seen = new Set<string>();
  item.citations.forEach((_, index) => {
    const href = citationHref(item, index);
    if (!href || seen.has(href)) return;
    seen.add(href);
    links.push({ label: citationLabel(item, index), href });
  });
  return links.slice(0, max);
}

// One plain insight sentence, pulled from whyItMatters. Rendered on its own
// bold line (no "What this means" label).
export function insightLine(item: BrandonBriefItem): string | null {
  const text = String(item.whyItMatters ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length < 12) return null;
  return clip(text, 280);
}

// Financial / accounting-sourced items (e.g. the change-order backlog) are
// grouped into their own section at the bottom, not mixed between projects.
export function isFinancialItem(item: BrandonBriefItem): boolean {
  const retrieval = (item.retrieval ?? "").toLowerCase();
  const sourceDetail = (item.sourceDetail ?? "").toLowerCase();
  return (
    retrieval.startsWith("financial pulse:") ||
    sourceDetail.includes("acumatica")
  );
}

export function getBriefHeader(
  now: Date,
  firstName: string | null,
): { today: string; greeting: string } {
  const today = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "America/New_York",
  }).format(now);
  const easternHour = Number(
    new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      hour12: false,
      timeZone: "America/New_York",
    }).format(now),
  );
  const daypart =
    easternHour < 12 ? "morning" : easternHour < 17 ? "afternoon" : "evening";
  const greeting = firstName
    ? `Good ${daypart}, ${firstName}.`
    : `Good ${daypart}.`;
  return { today, greeting };
}

/**
 * Render the brief as a plain, normal-width Teams markdown message — no card
 * box. Sections: Needs your attention / Waiting on others / Worth knowing. Each
 * item is a headline, 2–4 plain bullets, a "What this means" insight line, and
 * in-app source links.
 */
export function formatExecutiveBriefingTeamsMessage(
  packet: BrandonDailyUpdatePacket,
  firstName: string | null,
  options: { now?: Date } = {},
): string {
  const now = options.now ?? new Date();
  const { today, greeting } = getBriefHeader(now, firstName);

  const { needsBrandon, waitingOnOthers, importantUpdates } = packet.sections;

  // Group items: priorities, then ordinary project updates, then financial
  // (kept together at the bottom instead of mixed between projects).
  const financial = [...waitingOnOthers, ...importantUpdates].filter(
    isFinancialItem,
  );
  const projectUpdates = [...waitingOnOthers, ...importantUpdates].filter(
    (item) => !isFinancialItem(item),
  );
  const priorities = needsBrandon.filter((item) => !isFinancialItem(item));
  const financialFromPriorities = needsBrandon.filter(isFinancialItem);
  const financialAll = [...financialFromPriorities, ...financial];

  // Teams' message renderer strips single newlines entirely (text on adjacent
  // lines gets glued together with no space). The ONLY reliable separator is a
  // blank line, so we build discrete blocks and join them with "\n\n". Bullet
  // lists keep their internal single newlines — markdown list parsing handles
  // those even though standalone newlines are stripped.
  const blocks: string[] = [
    `**Daily Brief — ${today}**`,
    `${greeting} Here's your daily brief — a quick read on what's moved across your projects over the last few business days.`,
  ];

  // Teams collapses the blank line between two consecutive bold lines, so a
  // section header (or a prior item's bold insight line) glues directly onto
  // the next project name. A non-breaking-space block survives that collapse
  // and renders as a real blank line, giving every project name white space
  // above it.
  const SECTION_SPACER = " ";

  const pushItem = (item: BrandonBriefItem, bulletMax: number) => {
    blocks.push(SECTION_SPACER);
    blocks.push(`**${projectName(item.project)}**`);
    blocks.push(bulletBlock(item, bulletMax));
    const insight = insightLine(item);
    if (insight) blocks.push(`**${insight}**`);
    for (const source of linkedClaimSources(item)) {
      blocks.push(`[${source.label}](${source.href})`);
    }
  };

  const operatingBrief = packet.operatingBrief;
  const pushPlainSection = (title: string, lines: string[]) => {
    const visible = lines.map((line) => clip(line, 260)).filter(Boolean);
    if (visible.length === 0) return;
    blocks.push(`**${title}**`);
    visible.forEach((line) => blocks.push(`- ${line}`));
  };

  if (operatingBrief) {
    pushPlainSection("Start here", operatingBrief.startHere.slice(0, 3));
    pushPlainSection(
      "Business health",
      (operatingBrief.businessHealth ?? []).map(
        (item) => `${item.area} (${item.status}): ${item.summary}`,
      ),
    );
    pushPlainSection(
      "Emerging patterns",
      (operatingBrief.emergingPatterns ?? []).map(
        (pattern) => `${pattern.title}: ${pattern.significance}`,
      ),
    );
    pushPlainSection(
      "Strategic risks",
      (operatingBrief.strategicRisks ?? [])
        .slice(0, 5)
        .map(
          (risk) =>
            `${risk.title} (${risk.likelihood}, ${risk.trend}): ${sentence(risk.impact)} Next: ${risk.nextAction}`,
        ),
    );
    pushPlainSection("Opportunities", operatingBrief.opportunities ?? []);
    pushPlainSection(
      "Leadership watchlist",
      operatingBrief.leadershipWatchlist ?? [],
    );
    pushPlainSection(
      "AI Chief of Staff insights",
      operatingBrief.chiefOfStaffInsights ?? [],
    );
  }

  if (priorities.length > 0) {
    blocks.push(`**Needs your attention**`);
    priorities.forEach((item) => pushItem(item, 4));
  }

  if (projectUpdates.length > 0) {
    blocks.push(`**Project updates**`);
    projectUpdates.forEach((item) => pushItem(item, 3));
  }

  if (financialAll.length > 0) {
    blocks.push(`**Financial insights**`);
    financialAll.forEach((item) => pushItem(item, 3));
  }

  // A short closing that points Brandon at where to start — never promises an
  // action the assistant cannot actually perform.
  const firstItem = priorities[0] ?? projectUpdates[0] ?? financialAll[0];
  blocks.push(
    firstItem
      ? `If you only have a minute, ${projectName(firstItem.project)} is the one I'd look at first today. The source links above open the full meeting or thread whenever you want the detail.`
      : "Nothing needs your attention across your projects today. Enjoy the quiet one.",
  );

  return blocks.join("\n\n");
}
