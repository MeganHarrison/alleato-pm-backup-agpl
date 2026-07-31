/**
 * Canonical helpers for the structured v3 Daily Executive Brief, shared by the
 * compiler (`compile-daily-executive-brief.mjs`) and the learning-loop
 * projection (`../projections/daily-deep-read-consumers.mjs`).
 *
 * The structured object (`packet_json.brief`) is the source of truth. This
 * module renders it to markdown, validates it, and derives next moves — nothing
 * parses section headings.
 *
 * Schema and format contract:
 *   docs/ops/evidence/2026-07-07-manual-daily-executive-brief/BRIEF-FORMAT-SPEC.md
 * The TypeScript mirror used by the reader page is
 *   frontend/src/lib/daily-briefs/{brief-v3-types.ts,render-brief-v3.ts}
 * Keep the two renderers in sync.
 */

const HR = "---";

function sourceRefs(ids) {
  const clean = (Array.isArray(ids) ? ids : []).filter(Boolean);
  return clean.length ? ` ${clean.map((id) => `[${id}]`).join(" ")}` : "";
}

function actionSuffix(item) {
  if (item.due) return ` Due ${item.due}.`;
  if (item.urgency) return ` ${item.urgency}`;
  return "";
}

function renderActionItem(item) {
  const owner = item.ownerIsBrandon ? "You" : item.owner;
  const optional = item.optional ? " *(optional)*" : "";
  return `- **${owner}${optional} — ${item.text}**${actionSuffix(item)}${sourceRefs(item.sourceIds)}`;
}

function renderCall(call) {
  const optional = call.optional ? " *(optional)*" : "";
  return `- **${call.project}**${optional} — ${call.question}${sourceRefs(call.sourceIds)}`;
}

function renderProject(project, headingLevel) {
  const lines = [`${headingLevel} ${project.name}`, ""];
  const items = Array.isArray(project.actionItems) ? project.actionItems : [];
  if (project.resolvedToday && items.length === 0) {
    lines.push("**Action Items** — nothing, resolved today.", "");
  } else {
    lines.push("**Action Items**");
    for (const item of items) lines.push(renderActionItem(item));
    lines.push("");
  }
  if (project.context && project.context.trim()) lines.push(project.context.trim(), "");
  return lines.join("\n").trimEnd();
}

function renderSourceDefinitions(sources) {
  return Object.entries(sources || {})
    .filter(([, meta]) => Boolean(meta && meta.url))
    .sort((a, b) => Number(a[0].slice(1)) - Number(b[0].slice(1)))
    .map(([id, meta]) => `[${id}]: ${meta.url}`)
    .join("\n");
}

/** Structured brief → canonical markdown. Pure. Mirrors render-brief-v3.ts. */
export function renderBriefMarkdownV3(brief) {
  const blocks = [];
  blocks.push(`# Daily Executive Brief — ${brief.businessDate}`);

  const signal = brief.executiveSignal;
  if (signal?.headline || signal?.whyNow || signal?.focus) {
    const lines = [HR, "", "## Executive signal", ""];
    if (signal.headline) lines.push(`**Headline.** ${signal.headline}`);
    if (signal.whyNow) lines.push(`**Why it matters today.** ${signal.whyNow}`);
    if (signal.focus) lines.push(`**Your focus.** ${signal.focus}`);
    if (Array.isArray(signal.watchouts) && signal.watchouts.length) lines.push("", "**Watchouts.**", ...signal.watchouts.map((item) => `- ${item}`));
    blocks.push(lines.join("\n"));
  }

  const calls = Array.isArray(brief.callsToday) ? brief.callsToday : [];
  if (calls.length) {
    blocks.push([HR, "", "## Your calls today", "", ...calls.map(renderCall)].join("\n"));
  }

  const projects = Array.isArray(brief.projects) ? brief.projects : [];
  const ordered = [...projects].sort((a, b) => (a.urgencyRank ?? 99) - (b.urgencyRank ?? 99));
  const mainStream = ordered.filter((p) => p.hasOwnerDecision);
  const collapsed = ordered.filter((p) => !p.hasOwnerDecision);

  for (const project of mainStream) {
    blocks.push([HR, "", renderProject(project, "##")].join("\n"));
  }

  if (collapsed.length) {
    const inner = [
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

  const looseEnds = Array.isArray(brief.looseEnds) ? brief.looseEnds : [];
  if (looseEnds.length) {
    const loose = [HR, "", "## Loose ends — yours to chase", ""];
    for (const end of looseEnds) loose.push(`- **${end.text}**${sourceRefs(end.sourceIds)}`);
    blocks.push(loose.join("\n"));
  }

  const note = brief.sourceCoverage && brief.sourceCoverage.note ? String(brief.sourceCoverage.note).trim() : "";
  const defs = renderSourceDefinitions(brief.sources);
  const footer = [HR];
  if (note) footer.push("", `*${note}*`);
  if (defs) footer.push("", defs);
  if (footer.length > 1) blocks.push(footer.join("\n"));

  return `${blocks.join("\n\n")}\n`;
}

/**
 * Validate a structured brief. Throws (fail loudly) on a malformed shape so the
 * generator never writes an incomplete packet.
 */
export function validateBriefV3(brief) {
  const errors = [];
  if (!brief || typeof brief !== "object") throw new Error("brief_v3 is not an object");
  if (brief.version !== "v3") errors.push(`version must be "v3" (got ${JSON.stringify(brief.version)})`);
  if (!brief.businessDate) errors.push("businessDate is required");
  if (!Array.isArray(brief.projects) || brief.projects.length === 0) {
    errors.push("projects[] must be a non-empty array");
  }
  if (!Array.isArray(brief.callsToday)) errors.push("callsToday[] must be an array");
  if (!Array.isArray(brief.preventionFindings)) errors.push("preventionFindings[] must be an array");
  if (!brief.sources || typeof brief.sources !== "object") errors.push("sources map is required");
  const signal = brief.executiveSignal;
  if (!signal || typeof signal !== "object") errors.push("executiveSignal is required");
  for (const key of ["headline", "whyNow", "focus"]) {
    if (typeof signal?.[key] !== "string" || !signal[key].trim()) errors.push(`executiveSignal.${key} is required`);
  }
  if (!Array.isArray(signal?.watchouts) || signal.watchouts.length > 3) errors.push("executiveSignal.watchouts must be an array with at most 3 items");

  for (const [i, p] of (brief.projects || []).entries()) {
    if (!p || !p.name) errors.push(`projects[${i}] missing name`);
    if (typeof p?.hasOwnerDecision !== "boolean") errors.push(`projects[${i}] hasOwnerDecision must be boolean`);
    if (!Array.isArray(p?.actionItems)) errors.push(`projects[${i}] actionItems must be an array`);
    for (const [j, a] of (p?.actionItems || []).entries()) {
      if (!a?.text) errors.push(`projects[${i}].actionItems[${j}] missing text`);
      if (typeof a?.ownerIsBrandon !== "boolean") errors.push(`projects[${i}].actionItems[${j}] ownerIsBrandon must be boolean`);
      if (!a?.ownerIsBrandon && !a?.owner) errors.push(`projects[${i}].actionItems[${j}] non-owner item missing owner`);
    }
  }
  // Every calls-today entry must correspond to a project that has a Brandon decision.
  const decisionProjects = new Set((brief.projects || []).filter((p) => p?.hasOwnerDecision).map((p) => p.name));
  for (const [i, c] of (brief.callsToday || []).entries()) {
    if (!c?.project || !c?.question) errors.push(`callsToday[${i}] missing project or question`);
    else if (!decisionProjects.has(c.project)) {
      errors.push(`callsToday[${i}] references "${c.project}" which has no owner-decision project block`);
    }
  }
  const issueKeyPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  const allowedCategories = new Set(["change_management", "financial_controls", "procurement", "reporting", "accountability", "scheduling", "owner_relations", "safety", "other"]);
  const allowedPreventability = new Set(["preventable", "partially_preventable", "cannot_determine"]);
  for (const [i, finding] of (brief.preventionFindings || []).entries()) {
    if (!finding?.title || !issueKeyPattern.test(String(finding.issueKey || ""))) errors.push(`preventionFindings[${i}] missing valid title or issueKey`);
    if (!allowedCategories.has(finding?.category)) errors.push(`preventionFindings[${i}] has invalid category`);
    if (!allowedPreventability.has(finding?.preventability)) errors.push(`preventionFindings[${i}] has invalid preventability`);
    if (!finding?.observedCondition || !finding?.preventabilityBasis || !finding?.missingControl || !finding?.recommendedSystem) errors.push(`preventionFindings[${i}] missing required analysis fields`);
    if (!Array.isArray(finding?.sourceIds) || finding.sourceIds.length === 0) errors.push(`preventionFindings[${i}] needs cited sourceIds`);
  }
  if (brief.executiveSynthesis !== undefined) {
    const synthesisErrors = validateExecutiveSynthesis(brief.executiveSynthesis, new Set(Object.keys(brief.sources || {})));
    errors.push(...synthesisErrors.map((error) => `executiveSynthesis.${error}`));
  }
  if (errors.length) throw new Error(`Invalid brief_v3:\n- ${errors.join("\n- ")}`);
  return brief;
}

/**
 * Validate the evidence-backed synthesis contract without applying model prose
 * heuristics. Every claim has a stable id, an epistemic bucket, and at least
 * one source alias; this is what prevents uncited inference from becoming fact.
 */
export function validateExecutiveSynthesis(synthesis, knownSourceIds = null) {
  const errors = [];
  if (!synthesis || typeof synthesis !== "object") return ["must be an object"];
  const claimBuckets = ["patterns", "rootCauses", "facts", "inferences", "risks", "opportunities", "financial", "schedule", "decisions"];
  const claimId = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  const confidence = new Set(["high", "medium", "low"]);
  for (const bucket of claimBuckets) {
    if (!Array.isArray(synthesis[bucket])) {
      errors.push(`${bucket} must be an array`);
      continue;
    }
    for (const [index, claim] of synthesis[bucket].entries()) {
      if (!claim || typeof claim !== "object") {
        errors.push(`${bucket}[${index}] must be an object`);
        continue;
      }
      if (!claimId.test(String(claim.id || ""))) errors.push(`${bucket}[${index}] has invalid id`);
      if (!String(claim.statement || "").trim()) errors.push(`${bucket}[${index}] statement is required`);
      if (!Array.isArray(claim.sourceIds) || claim.sourceIds.length === 0) errors.push(`${bucket}[${index}] needs cited sourceIds`);
      else if (knownSourceIds) {
        for (const sourceId of claim.sourceIds) {
          if (!knownSourceIds.has(String(sourceId))) errors.push(`${bucket}[${index}] references unknown sourceId ${sourceId}`);
        }
      }
      if (!confidence.has(claim.confidence)) errors.push(`${bucket}[${index}] has invalid confidence`);
    }
  }
  if (!Array.isArray(synthesis.recommendations)) errors.push("recommendations must be an array");
  for (const [index, recommendation] of (synthesis.recommendations || []).entries()) {
    if (!recommendation || typeof recommendation !== "object") continue;
    if (!String(recommendation.rationale || "").trim()) errors.push(`recommendations[${index}] rationale is required`);
    if (!String(recommendation.owner || "").trim()) errors.push(`recommendations[${index}] owner is required`);
  }
  const coverage = synthesis.evidenceCoverage;
  if (!coverage || typeof coverage !== "object") errors.push("evidenceCoverage is required");
  else {
    for (const key of ["eligibleSourceCount", "citedSourceCount"]) {
      if (!Number.isInteger(coverage[key]) || coverage[key] < 0) errors.push(`evidenceCoverage.${key} must be a non-negative integer`);
    }
    if (coverage.citedSourceCount > coverage.eligibleSourceCount) errors.push("evidenceCoverage.citedSourceCount exceeds eligibleSourceCount");
    if (!Array.isArray(coverage.uncoveredSourceIds)) errors.push("evidenceCoverage.uncoveredSourceIds must be an array");
  }
  return errors;
}

/** Owner-facing next moves for the packet's recommended_next_moves column. */
export function nextMovesFromBriefV3(brief, limit = 8) {
  const moves = [];
  for (const project of brief?.projects || []) {
    for (const item of project.actionItems || []) {
      const owner = item.ownerIsBrandon ? "You" : item.owner;
      const due = item.due ? ` (due ${item.due})` : "";
      moves.push(`${owner}: ${item.text}${due}`);
    }
  }
  return moves.slice(0, limit);
}
