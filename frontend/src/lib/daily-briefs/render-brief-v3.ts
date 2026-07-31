/**
 * Renders a structured {@link BriefV3} into the canonical markdown brief
 * (the format locked in BRIEF-FORMAT-SPEC.md; golden sample brief-richer-0708.md).
 *
 * The structured object is the source of truth; this is one of its views. The
 * reader page renders from the structure directly — this markdown is for
 * storage, export, and plain-text consumers.
 */
import type {
  BriefV3,
  BriefV3ActionItem,
  BriefV3Call,
  BriefV3Project,
  BriefV3Source,
} from "./brief-v3-types";

const HR = "---";

/** " [S247] [S54]" — reference-style aliases; definitions are emitted at the foot. */
function sourceRefs(ids: string[]): string {
  const clean = ids.filter(Boolean);
  return clean.length ? ` ${clean.map((id) => `[${id}]`).join(" ")}` : "";
}

/** The tail of an action item: due date if real, else honest urgency. */
function actionSuffix(item: BriefV3ActionItem): string {
  if (item.due) return ` Due ${item.due}.`;
  if (item.urgency) return ` ${item.urgency}`;
  return "";
}

function renderActionItem(item: BriefV3ActionItem): string {
  const owner = item.ownerIsBrandon ? "You" : item.owner;
  const optional = item.optional ? " *(optional)*" : "";
  // Owner + text are bold so the scannable action reads from the top line alone.
  return `- **${owner}${optional} — ${item.text}**${actionSuffix(item)}${sourceRefs(item.sourceIds)}`;
}

function renderCall(call: BriefV3Call): string {
  const optional = call.optional ? " *(optional)*" : "";
  return `- **${call.project}**${optional} — ${call.question}${sourceRefs(call.sourceIds)}`;
}

function renderProject(project: BriefV3Project, headingLevel: "##" | "###"): string {
  const lines: string[] = [`${headingLevel} ${project.name}`, ""];

  if (project.resolvedToday && project.actionItems.length === 0) {
    lines.push("**Action Items** — nothing, resolved today.", "");
  } else {
    lines.push("**Action Items**");
    for (const item of project.actionItems) lines.push(renderActionItem(item));
    lines.push("");
  }

  if (project.context.trim()) lines.push(project.context.trim(), "");
  return lines.join("\n").trimEnd();
}

function renderSourceDefinitions(sources: Record<string, BriefV3Source>): string {
  return Object.entries(sources)
    .filter(([, meta]) => Boolean(meta.url))
    .sort((a, b) => Number(a[0].slice(1)) - Number(b[0].slice(1)))
    .map(([id, meta]) => `[${id}]: ${meta.url}`)
    .join("\n");
}

function renderSourceNote(brief: BriefV3): string {
  const note = brief.sourceCoverage.note?.trim();
  return note ? `*${note}*` : "";
}

/** Structured brief → canonical markdown. Pure; no I/O. */
export function renderBriefMarkdownV3(brief: BriefV3): string {
  const blocks: string[] = [];

  // Title only — NO how-to-read / format-explainer line (spec ruling).
  blocks.push(`# Daily Executive Brief — ${brief.businessDate}`);

  const signal = brief.executiveSignal;
  if (signal?.headline || signal?.whyNow || signal?.focus) {
    const lines = [HR, "", "## Executive signal", ""];
    if (signal.headline) lines.push(`**Headline.** ${signal.headline}`);
    if (signal.whyNow) lines.push(`**Why it matters today.** ${signal.whyNow}`);
    if (signal.focus) lines.push(`**Your focus.** ${signal.focus}`);
    if (signal.watchouts?.length) lines.push("", "**Watchouts.**", ...signal.watchouts.map((item) => `- ${item}`));
    blocks.push(lines.join("\n"));
  }

  // Your calls today — decision index, decisions only.
  if (brief.callsToday.length) {
    blocks.push([HR, "", "## Your calls today", "", ...brief.callsToday.map(renderCall)].join("\n"));
  }

  // Main stream: projects with a Brandon decision, most urgent first.
  const ordered = [...brief.projects].sort((a, b) => a.urgencyRank - b.urgencyRank);
  const mainStream = ordered.filter((p) => p.hasOwnerDecision);
  const collapsed = ordered.filter((p) => !p.hasOwnerDecision);

  for (const project of mainStream) {
    blocks.push([HR, "", renderProject(project, "##")].join("\n"));
  }

  // Collapsed group: no-decision projects.
  if (collapsed.length) {
    const inner: string[] = [
      HR,
      "",
      "## Also moving — nothing needed from you",
      "",
      "<details>",
      `<summary><strong>Show ${collapsed.length} project${collapsed.length === 1 ? "" : "s"} on track</strong></summary>`,
      "",
    ];
    inner.push(collapsed.map((p) => renderProject(p, "###")).join(`\n\n${HR}\n\n`));
    inner.push("", "</details>");
    blocks.push(inner.join("\n"));
  }

  // Loose ends — non-project items.
  if (brief.looseEnds.length) {
    const loose = [HR, "", "## Loose ends — yours to chase", ""];
    for (const end of brief.looseEnds) loose.push(`- **${end.text}**${sourceRefs(end.sourceIds)}`);
    blocks.push(loose.join("\n"));
  }

  // Source note + link definitions.
  const note = renderSourceNote(brief);
  const defs = renderSourceDefinitions(brief.sources);
  const footer = [HR];
  if (note) footer.push("", note);
  if (defs) footer.push("", defs);
  if (footer.length > 1) blocks.push(footer.join("\n"));

  return `${blocks.join("\n\n")}\n`;
}
