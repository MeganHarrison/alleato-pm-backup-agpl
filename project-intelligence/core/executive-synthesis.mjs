import { validateBriefV3 } from "./brief-v3.mjs";
import { BRIEF_V3_RESPONSE_FORMAT } from "./brief-v3-response-schema.mjs";
import { chunkSourcesForModel, packSourceChunks } from "../ingestion/daily-source-corpus.mjs";
import { assertBriefProjectCoverage } from "./project-records.mjs";

const LANES = ["meetings", "emails", "teams", "documents"];
const LANE_TO_TYPE = { meetings: "meeting", emails: "email", teams: "teams", documents: "document" };

export const BRIEF_V3_SYSTEM_PROMPT = [
  "You are the strategic advisor to Brandon Clymer, CEO of Alleato Group, a construction general contractor.",
  "From the day's source notes, produce his Daily Executive Brief as STRUCTURED JSON. Write to him in the second person ('you').",
  "Return ONLY one JSON object containing: executiveSignal, callsToday, one projects entry for every activeProjectNames item, looseEnds, preventionFindings, executiveSynthesis, and sourceCoverage.",
  "executiveSignal must contain headline, whyNow, focus, and watchouts.",
  "Each project must contain name, urgencyRank, hasOwnerDecision, resolvedToday, actionItems, and context.",
  "Each action item must contain ownerIsBrandon, owner, text, due, dueIso, urgency, optional, and sourceIds.",
  "Each prevention finding must contain issueKey, title, category, severity, observedCondition, preventability, preventabilityBasis, missingControl, recommendedSystem, accountableRole, leadingIndicator, confidence, and sourceIds.",
  "executiveSynthesis must contain patterns, rootCauses, facts, inferences, recommendations, risks, opportunities, financial, schedule, decisions, and evidenceCoverage.",
  "Rules:",
  "- Make the portfolio signal specific to today's evidence. State conflicts, uncertainty, or thin evidence plainly.",
  "- Emit exactly one project block for every activeProjectNames item. Never omit quiet or on-track projects.",
  "- callsToday contains only Brandon's own decisions, phrased as questions. Do not repeat those decisions as tasks.",
  "- Tasks must be concrete, checkable, consolidated, named-owner work. Never emit observations, ongoing job responsibilities, monitoring filler, or near-duplicates. Keep at most three per project.",
  "- Never invent due dates, commitments, facts, or source aliases.",
  "- Every factual claim must carry exact source aliases in sourceIds and project prose must cite aliases inline as [S12].",
  "- Always use project names, never numeric project identifiers.",
  "- Source project labels are evidence-resolved identities. Never replace an unresolved or unregistered label with a similar registered project.",
  "- A project-scoped claim may cite only sources whose sourceProjectIndex label exactly matches that project. Never merge project headings or identities.",
  "- Facts are directly observed. Inferences and root causes must be explicitly labeled as inference or likely and carry confidence.",
  "- Recommendations must be specific actions with owner, rationale, confidence, and claim-to-source references.",
  "- Populate every executiveSynthesis bucket, using [] when no supported claim exists.",
  "- preventionFindings are review-gated system observations, not blame. Use cannot_determine and low confidence when evidence is insufficient.",
  "- preventionFinding category must be one of change_management, financial_controls, procurement, reporting, accountability, scheduling, owner_relations, safety, other.",
].join("\n");

export const DETAILED_EXECUTIVE_REPORT_PROMPT = [
  "You are the strategic advisor to Brandon Clymer, CEO of Alleato Group, a construction general contractor.",
  "Write the authoritative Detailed Executive Report for one completed business day. This is not a dashboard, meeting recap, task list, or expanded set of bullets.",
  "Synthesize the supplied source notes into rigorous executive analysis: explain what happened, why it matters, what is changing, causal links across projects or teams, risks, opportunities, decisions, ownership, timing, and consequences of inaction.",
  "Write in clear executive prose addressed to Brandon as 'you'. Preserve materially relevant meeting, email, message, and document context.",
  "Every factual assertion must carry one or more exact source aliases inline, e.g. [S12]. Distinguish evidence from inference and state uncertainty or contradictory evidence plainly.",
  "Use sourceProjectIndex as the binding source-to-project contract. In Project-by-project analysis, use exactly one evidence-resolved project label per H3 and cite only sources carrying that same label. Never merge project headings or identities.",
  "Return Markdown only, with exactly these H2 sections in this order:",
  "## Executive assessment",
  "## What changed today",
  "## Cross-portfolio patterns and implications",
  "## Project-by-project analysis",
  "## Decisions and commitments",
  "## Risks and early warnings",
  "## Preventable failures and system improvements",
  "## Opportunities and leverage",
  "## Recommended executive actions",
  "## Evidence gaps and unresolved questions",
  "## Source coverage",
  "Within Project-by-project analysis, create an H3 for every project with material evidence and explain its context, change, implication, owner/next action, and risk trajectory.",
  "Within Preventable failures and system improvements, analyze the three to six highest-leverage issues, missing controls, durable prevention system, accountable role, and leading indicator. Never assign blame or assert preventability without evidence.",
  "Do not produce generic process language, fabricated facts, or a source-by-source dump.",
].join("\n");

export function groupSourcesByLane(sources) {
  const grouped = { meetings: [], emails: [], teams: [], documents: [] };
  for (const source of sources) grouped[source.lane]?.push(source);
  return grouped;
}

export function parseModelJson(text) {
  const cleaned = String(text || "").replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

export function modelRepairTurn(candidate, instruction) {
  return [
    { role: "assistant", content: String(candidate ?? "") },
    { role: "system", content: String(instruction ?? "") },
  ];
}

export function collectCitedAliases(structured) {
  const cited = new Set();
  const add = (ids) => {
    for (const id of ids || []) if (id) cited.add(String(id).trim());
  };
  for (const call of structured.callsToday || []) add(call.sourceIds);
  for (const end of structured.looseEnds || []) add(end.sourceIds);
  for (const finding of structured.preventionFindings || []) add(finding.sourceIds);
  for (const project of structured.projects || []) {
    for (const item of project.actionItems || []) add(item.sourceIds);
    for (const tag of String(project.context || "").match(/\[(S\d+)\]/g) || []) cited.add(tag.slice(1, -1));
  }
  const synthesis = structured.executiveSynthesis || {};
  for (const bucket of ["patterns", "rootCauses", "facts", "inferences", "recommendations", "risks", "opportunities", "financial", "schedule", "decisions"]) {
    for (const claim of synthesis[bucket] || []) add(claim.sourceIds);
  }
  return cited;
}

export function buildSourcesMap(sources, citedAliases) {
  const map = {};
  for (const source of sources) {
    if (!citedAliases.has(source.alias)) continue;
    map[source.alias] = {
      title: source.title,
      type: LANE_TO_TYPE[source.lane] ?? "document",
      url: source.canonicalSourceUrl || source.url || null,
      sourceId: source.canonicalSourceId || String(source.id),
      project: source.attributionLabel ?? source.projectName ?? null,
    };
  }
  return map;
}

function normalizedProjectLabel(value) {
  return String(value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

export function buildSourceProjectIndex(sources) {
  return Object.fromEntries(sources.map((source) => [
    source.alias,
    {
      project: source.attributionLabel ?? source.projectName ?? null,
      mentionedProjects: source.mentionedProjectLabels ?? [],
      attributionStatus: source.attributionStatus ?? "not_evaluated",
      title: source.title,
    },
  ]));
}

function textNamesProject(value, projectName) {
  const text = ` ${normalizedProjectLabel(value)} `;
  const project = normalizedProjectLabel(projectName);
  return project.length >= 5 && text.includes(` ${project} `);
}

function titleCompactlyNamesProject(title, projectName) {
  const titleTokens = normalizedProjectLabel(title).split(" ").filter(Boolean);
  const compactProject = normalizedProjectLabel(projectName).replace(/\s+/g, "");
  if (compactProject.length < 8) return false;
  for (let start = 0; start < titleTokens.length; start += 1) {
    let candidate = "";
    for (let end = start; end < Math.min(titleTokens.length, start + 5); end += 1) {
      candidate += titleTokens[end];
      if (candidate === compactProject) return true;
      if (candidate.length >= compactProject.length) break;
    }
  }
  return false;
}

export function annotateSourceProjectMentions(sources) {
  const labels = [...new Set(sources.map((source) => source.attributionLabel ?? source.projectName).filter(Boolean))];
  for (const source of sources) {
    const resolvedLabel = source.attributionLabel ?? source.projectName ?? null;
    if (resolvedLabel) {
      source.mentionedProjectLabels = [resolvedLabel];
      continue;
    }
    const fullText = `${source.title ?? ""}\n${source.text ?? ""}`;
    source.mentionedProjectLabels = labels.filter((label) =>
      textNamesProject(fullText, label) ||
      titleCompactlyNamesProject(source.title, label),
    );
  }
  return sources;
}

function citedAliasesInText(value) {
  return [...String(value ?? "").matchAll(/\[(S\d+)\]/g)].map((match) => match[1]);
}

function assertAliasesMatchProject({ aliases, projectName, sourceByAlias, path }) {
  const expected = normalizedProjectLabel(projectName);
  if (!expected || aliases.length === 0) return [];
  const violations = [];
  for (const alias of aliases) {
    const source = sourceByAlias.get(alias);
    const actualName = source?.attributionLabel ?? source?.projectName ?? null;
    const actual = normalizedProjectLabel(actualName);
    const explicitlyMentioned = (source?.mentionedProjectLabels ?? [])
      .some((label) => normalizedProjectLabel(label) === expected);
    const allowedUnassignedMention = source && !actual && explicitlyMentioned;
    if (!source || (actual !== expected && !allowedUnassignedMention)) {
      violations.push(`${path} project=${projectName} cites ${alias} project=${actualName ?? "unassigned"}`);
    }
  }
  return violations;
}

export function assertStructuredProjectAttribution(structured, sources) {
  const sourceByAlias = new Map(sources.map((source) => [source.alias, source]));
  const violations = [];
  for (const [index, project] of (structured.projects ?? []).entries()) {
    const aliases = new Set(citedAliasesInText(project.context));
    for (const item of project.actionItems ?? []) {
      for (const alias of item.sourceIds ?? []) aliases.add(String(alias));
    }
    violations.push(...assertAliasesMatchProject({
      aliases: [...aliases],
      projectName: project.name,
      sourceByAlias,
      path: `projects[${index}]`,
    }));
  }
  for (const [collectionName, collection] of [["callsToday", structured.callsToday], ["looseEnds", structured.looseEnds]]) {
    for (const [index, claim] of (collection ?? []).entries()) {
      const projectName = claim.projectName ?? claim.project ?? null;
      if (!projectName) continue;
      violations.push(...assertAliasesMatchProject({
        aliases: (claim.sourceIds ?? []).map(String),
        projectName,
        sourceByAlias,
        path: `${collectionName}[${index}]`,
      }));
    }
  }
  if (violations.length) {
    throw new Error(`Project attribution synthesis gate failed: ${violations.join("; ")}`);
  }
}

export function assertDetailedReportProjectAttribution(report, sources) {
  const blocks = [];
  let inProjectSection = false;
  let current = null;
  for (const line of String(report).split(/\r?\n/)) {
    if (/^##\s+Project-by-project analysis\s*$/i.test(line)) {
      inProjectSection = true;
      continue;
    }
    if (inProjectSection && /^##\s+/.test(line)) break;
    if (!inProjectSection) continue;
    const heading = line.match(/^###\s+(.+?)\s*$/)?.[1];
    if (heading) {
      if (current) blocks.push(current);
      current = { heading, lines: [] };
    } else if (current) {
      current.lines.push(line);
    }
  }
  if (current) blocks.push(current);
  const sourceByAlias = new Map(sources.map((source) => [source.alias, source]));
  const labels = [...new Set(sources.map((source) => source.attributionLabel ?? source.projectName).filter(Boolean))];
  const violations = [];
  const resolvedHeadings = new Set();
  for (const { heading, lines } of blocks) {
    const body = lines.join("\n");
    const normalizedHeading = normalizedProjectLabel(heading);
    const headingLabels = labels.filter((label) => {
      const normalized = normalizedProjectLabel(label);
      return normalized && normalizedHeading === normalized;
    });
    if (headingLabels.length === 0) {
      if (/[\/,]|\band\b/i.test(heading)) {
        violations.push(`heading '${heading}' resolves to 0 project labels and contains a merge separator`);
        continue;
      }
      const aliases = citedAliasesInText(body);
      if (aliases.length === 0) {
        violations.push(`unregistered heading '${heading}' has no source citations`);
        continue;
      }
      for (const alias of aliases) {
        const source = sourceByAlias.get(alias);
        const actualName = source?.attributionLabel ?? source?.projectName ?? null;
        const sourceText = `${source?.title ?? ""}\n${source?.text ?? ""}`;
        const persistedMention = (source?.mentionedProjectLabels ?? [])
          .some((label) => normalizedProjectLabel(label) === normalizedHeading);
        const explicitMention = persistedMention ||
          textNamesProject(sourceText, heading) ||
          titleCompactlyNamesProject(source?.title, heading);
        if (!source || actualName || !explicitMention) {
          violations.push(`unregistered heading '${heading}' cites ${alias} project=${actualName ?? "unassigned"} without an explicit source mention`);
        } else if (!persistedMention) {
          source.mentionedProjectLabels = [...new Set([...(source.mentionedProjectLabels ?? []), heading])];
        }
      }
      continue;
    }
    if (headingLabels.length !== 1) {
      violations.push(`heading '${heading}' resolves to ${headingLabels.length} project labels`);
      continue;
    }
    resolvedHeadings.add(normalizedProjectLabel(headingLabels[0]));
    violations.push(...assertAliasesMatchProject({
      aliases: citedAliasesInText(body),
      projectName: headingLabels[0],
      sourceByAlias,
      path: `heading '${heading}'`,
    }));
  }
  for (const label of labels) {
    if (!resolvedHeadings.has(normalizedProjectLabel(label))) {
      violations.push(`missing project heading '${label}'`);
    }
  }
  if (violations.length) {
    throw new Error(`Detailed report attribution gate failed: ${violations.join("; ")}`);
  }
}

export function assertDetailedExecutiveReport(report, sources) {
  const requiredHeadings = [
    "Executive assessment", "What changed today", "Cross-portfolio patterns and implications",
    "Project-by-project analysis", "Decisions and commitments", "Risks and early warnings",
    "Preventable failures and system improvements", "Opportunities and leverage",
    "Recommended executive actions", "Evidence gaps and unresolved questions", "Source coverage",
  ];
  const missing = requiredHeadings.filter((heading) => !new RegExp(`^## ${heading}$`, "mi").test(report));
  const citations = report.match(/\[S\d+\]/g) ?? [];
  const minimumLength = Math.max(3_000, Math.min(9_000, sources.length * 40));
  const minimumCitations = Math.min(12, Math.max(3, Math.ceil(sources.length / 8)));
  if (missing.length || report.length < minimumLength || citations.length < minimumCitations) {
    throw new Error(
      `Detailed Executive Report quality gate failed: missing sections=${missing.join(", ") || "none"}; ` +
      `characters=${report.length}/${minimumLength}; citations=${citations.length}/${minimumCitations}.`,
    );
  }
}

export async function summarizeLane({ lane, items, businessDate, modelCall }) {
  if (!items.length) {
    return {
      notes: `No ${lane} sources were found for ${businessDate}.`,
      receipt: { status: "complete", sources: 0, sourceCharacters: 0, modelInputCharacters: 0, chunkCount: 0, truncatedSources: 0, modelBatchCount: 0 },
    };
  }
  const { chunks: sourceChunks, receipt } = chunkSourcesForModel(items);
  const batches = packSourceChunks(sourceChunks);
  const notes = new Array(batches.length);
  const concurrency = Math.min(4, batches.length);
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < batches.length) {
      const index = nextIndex++;
      notes[index] = await modelCall(
        [
          {
            role: "system",
            content: "Read every supplied source part completely. Extract concrete decisions, risks, money, schedule movement, commitments, blockers, causal patterns, and owner-relevant context. Cite each fact with its exact short id such as `S12`. Never alter or invent a tag. Use project names, never numeric ids. Do not produce generic summaries.",
          },
          { role: "user", content: JSON.stringify({ businessDate, lane, sources: batches[index] }, null, 2) },
        ],
        1800,
      );
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return { notes: notes.join("\n\n"), receipt: { ...receipt, modelBatchCount: batches.length } };
}

export async function draftDetailedExecutiveReport({ sources, laneNotes, businessDate, modelCall }) {
  const messages = [
    { role: "system", content: DETAILED_EXECUTIVE_REPORT_PROMPT },
    {
      role: "user",
      content: JSON.stringify({
        businessDate,
        sourceCounts: Object.fromEntries(Object.entries(groupSourcesByLane(sources)).map(([key, value]) => [key, value.length])),
        sourceProjectIndex: buildSourceProjectIndex(sources),
        sourceNotes: laneNotes,
      }, null, 2),
    },
  ];
  let lastError = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const report = await modelCall(messages, 18_000);
    try {
      assertDetailedExecutiveReport(report, sources);
      assertDetailedReportProjectAttribution(report, sources);
      return `# Detailed Executive Report — ${businessDate}\n\n${report.trim()}\n`;
    } catch (error) {
      lastError = error;
      if (attempt < 3) {
        messages.push(...modelRepairTurn(
          report,
          (
            `Rewrite the complete report to repair this exact gate failure: ${error.message} ` +
            "Preserve every required section, use exactly one sourceProjectIndex label per project H3, cite only same-project aliases within that H3, and add exact square-bracket source aliases to every factual assertion. Remove unsupported project placement instead of guessing. Never invent an alias."
          ),
        ));
      }
    }
  }
  throw lastError;
}

export async function draftExecutiveBrief({ sources, corpusLaneReceipts = null, businessDate, modelCall }) {
  const grouped = groupSourcesByLane(sources);
  const laneNotes = {};
  const laneReadReceipts = {};
  for (const lane of LANES) {
    const result = await summarizeLane({ lane, items: grouped[lane], businessDate, modelCall });
    laneNotes[lane] = result.notes;
    laneReadReceipts[lane] = result.receipt;
  }
  const sourceCharacters = Object.values(laneReadReceipts).reduce((total, receipt) => total + receipt.sourceCharacters, 0);
  const modelInputCharacters = Object.values(laneReadReceipts).reduce((total, receipt) => total + receipt.modelInputCharacters, 0);
  if (sourceCharacters !== modelInputCharacters) {
    throw new Error(`Executive Intelligence Run did not read the full corpus: sourceCharacters=${sourceCharacters}, modelInputCharacters=${modelInputCharacters}.`);
  }

  const detailedReport = await draftDetailedExecutiveReport({ sources, laneNotes, businessDate, modelCall });
  const userMessage = {
    role: "user",
    content: JSON.stringify({
      businessDate,
      sourceCounts: Object.fromEntries(Object.entries(grouped).map(([key, value]) => [key, value.length])),
      activeProjectNames: [
        ...new Set(sources.map((source) => source.attributionLabel ?? source.projectName).filter(Boolean)),
      ].sort(),
      sourceProjectIndex: buildSourceProjectIndex(sources),
      detailedExecutiveReport: detailedReport,
    }, null, 2),
  };

  let structured = null;
  let lastValidationError = null;
  let correction = null;
  let previousCandidate = null;
  for (let attempt = 1; attempt <= 5 && !structured; attempt += 1) {
    const messages = [{ role: "system", content: BRIEF_V3_SYSTEM_PROMPT }, userMessage];
    if (attempt > 1) {
      messages.push(...modelRepairTurn(
        previousCandidate,
        `Return only a corrected JSON object. Repair this exact validation failure: ${correction || "unknown validation failure"}`,
      ));
    }
    const response = await modelCall(messages, 9000, {
      responseFormat: BRIEF_V3_RESPONSE_FORMAT,
      returnMetadata: true,
    });
    const rawCandidate = typeof response === "string" ? response : response.content;
    previousCandidate = rawCandidate;
    const responseMetadata = typeof response === "string"
      ? { provider: "unknown", finishReason: "unknown" }
      : response;
    const candidate = parseModelJson(rawCandidate);
    if (!candidate || typeof candidate !== "object") {
      lastValidationError = new Error(
        `Structured brief attempt ${attempt} returned non-JSON model content ` +
        `(provider=${responseMetadata.provider}; finishReason=${responseMetadata.finishReason}; characters=${rawCandidate.length}).`,
      );
      correction = lastValidationError.message;
      continue;
    }
    if (!candidate.executiveSynthesis || typeof candidate.executiveSynthesis !== "object") {
      lastValidationError = new Error("Invalid brief_v3: executiveSynthesis is required for evidence-backed output.");
      correction = lastValidationError.message;
      continue;
    }
    const citedAliases = collectCitedAliases(candidate);
    const candidateStructured = {
      version: "v3",
      businessDate,
      executiveSignal: candidate.executiveSignal,
      callsToday: Array.isArray(candidate.callsToday) ? candidate.callsToday : [],
      projects: Array.isArray(candidate.projects) ? candidate.projects : [],
      looseEnds: Array.isArray(candidate.looseEnds) ? candidate.looseEnds : [],
      preventionFindings: Array.isArray(candidate.preventionFindings) ? candidate.preventionFindings : [],
      executiveSynthesis: {
        ...candidate.executiveSynthesis,
        evidenceCoverage: {
          ...(candidate.executiveSynthesis.evidenceCoverage || {}),
          eligibleSourceCount: sources.length,
          citedSourceCount: citedAliases.size,
          uncoveredSourceIds: sources.map((source) => source.alias).filter((alias) => !citedAliases.has(alias)),
        },
      },
      sourceCoverage: {
        ...Object.fromEntries(Object.entries(grouped).map(([key, value]) => [key, value.length])),
        thinLanes: Array.isArray(candidate.sourceCoverage?.thinLanes) ? candidate.sourceCoverage.thinLanes : [],
        note: candidate.sourceCoverage?.note ? String(candidate.sourceCoverage.note) : null,
      },
      sources: buildSourcesMap(sources, citedAliases),
    };
    try {
      validateBriefV3(candidateStructured);
      assertBriefProjectCoverage(sources, candidateStructured);
      assertStructuredProjectAttribution(candidateStructured, sources);
      structured = candidateStructured;
    } catch (error) {
      lastValidationError = new Error(
        `Structured brief attempt ${attempt} failed validation ` +
        `(provider=${responseMetadata.provider}; finishReason=${responseMetadata.finishReason}; characters=${rawCandidate.length}): ${error.message}`,
      );
      correction = error.message;
    }
  }
  if (!structured) throw lastValidationError ?? new Error("Brief model did not return a valid structured brief after 5 attempts.");

  return {
    structured,
    laneNotes,
    detailedReport,
    sourceReadReceipt: {
      status: "complete",
      sourceCount: sources.length,
      sourceCharacters,
      modelInputCharacters,
      truncatedSources: 0,
      lanes: Object.fromEntries(Object.entries(laneReadReceipts).map(([lane, receipt]) => [
        lane,
        { ...(corpusLaneReceipts?.[lane] || {}), ...receipt, status: corpusLaneReceipts?.[lane]?.status || receipt.status },
      ])),
    },
  };
}

export { LANES, LANE_TO_TYPE };
