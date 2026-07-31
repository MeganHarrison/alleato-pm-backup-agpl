// frontend/src/lib/ai/retrieval/system-prompt.ts
import type { RetrievalPlan, RetrievalContext } from "./types";
import {
  researchCoverageComplete,
  researchReceiptEvidenceText,
  researchSourceLabel,
  type ChatTurnResearchContract,
  type ResearchReceipt,
} from "./research-contract";
import {
  CHARS_PER_TOKEN,
  DEFAULT_HARD_LIMIT_TOKENS,
} from "@/lib/ai/stream/compaction";

const MAX_CHUNK_CHARS = 1200;
const MAX_VECTOR_RESULTS = 8;
const MAX_COMPACT_VALUE_CHARS = 1200;
const MAX_PACKET_CARDS = 8;
const MAX_PACKET_LIST_ITEMS = 5;

const SYSTEM_PROMPT_SEPARATOR = "\n\n---\n\n";

// The injected retrieval/context blocks must never grow large enough to push a
// request over the context hard limit on their own — otherwise even a one-line
// chat gets rejected by the compaction guard (which can only shrink the
// conversation, not the system prompt). Default to ~60% of the hard limit's
// char-equivalent so there is always room left for the conversation + response.
// Derived from the SAME hard-limit constant the compactor uses so the two can
// never disagree about what "over the limit" means.
export const DEFAULT_SYSTEM_PROMPT_MAX_CHARS = Math.floor(
  DEFAULT_HARD_LIMIT_TOKENS * CHARS_PER_TOKEN * 0.6,
);

export type AssembleSystemPromptOptions = {
  /** Hard cap on the assembled prompt length in characters. */
  maxContextChars?: number;
  /** Optional sink for "context was trimmed" telemetry. */
  onContextTrimmed?: (info: {
    maxContextChars: number;
    totalBlocks: number;
    keptBlocks: number;
    omittedBlocks: number;
    truncatedBlock: boolean;
  }) => void;
};

/**
 * Keep the highest-priority injected-context blocks that fit under the budget,
 * drop the rest, and (if even the first block overflows) truncate it so at least
 * the top-priority context survives. `basePrompt` (the operating instructions)
 * is never subject to the budget — it is always appended in full by the caller.
 */
function enforceContextBudget(
  parts: string[],
  basePrompt: string,
  maxContextChars: number,
): { parts: string[]; omittedBlocks: number; truncatedBlock: boolean } {
  const reserved = basePrompt.length + SYSTEM_PROMPT_SEPARATOR.length;
  const available = Math.max(0, maxContextChars - reserved);

  const kept: string[] = [];
  let used = 0;
  let omittedBlocks = 0;
  let truncatedBlock = false;

  for (const part of parts) {
    // Once we start dropping, drop everything after it (lower priority).
    if (omittedBlocks > 0) {
      omittedBlocks += 1;
      continue;
    }
    const cost =
      (kept.length > 0 ? SYSTEM_PROMPT_SEPARATOR.length : 0) + part.length;
    if (used + cost <= available) {
      kept.push(part);
      used += cost;
      continue;
    }
    // Doesn't fit. If nothing has been kept yet, truncate this top-priority
    // block so it survives partially rather than being dropped wholesale.
    if (kept.length === 0) {
      const marker = "\n\n[context truncated to fit the model window]";
      const room = available - marker.length;
      if (room > 0) {
        kept.push(`${part.slice(0, room)}${marker}`);
        used = available;
        truncatedBlock = true;
        continue;
      }
    }
    omittedBlocks += 1;
  }

  return { parts: kept, omittedBlocks, truncatedBlock };
}

type SemanticResult = {
  content?: string;
  sourceTable?: string;
  recordId?: string | number;
  similarity?: number;
  finalScore?: number;
  createdAt?: string | null;
  metadata?: Record<string, unknown>;
};

function renderSemanticResults(raw: unknown): string {
  if (!raw || typeof raw !== "object") return "";
  const wrapper = raw as { results?: SemanticResult[]; resultCount?: number };
  const results = Array.isArray(wrapper.results) ? wrapper.results : [];
  if (results.length === 0) return "";

  const sliced = results.slice(0, MAX_VECTOR_RESULTS);
  const lines = sliced.map((r, i) => {
    const content = (r.content ?? "")
      .trim()
      .replace(/\s+/g, " ")
      .slice(0, MAX_CHUNK_CHARS);
    const date = r.createdAt
      ? new Date(r.createdAt).toISOString().slice(0, 10)
      : "unknown date";
    const score =
      typeof r.finalScore === "number" ? r.finalScore.toFixed(2) : "?";
    const source = r.sourceTable ?? "unknown";
    const title =
      (r.metadata?.subject as string | undefined) ??
      (r.metadata?.title as string | undefined) ??
      (r.metadata?.meeting_title as string | undefined) ??
      "";
    const heading = title ? `${source} · ${title}` : source;
    const truncated =
      (r.content ?? "").trim().replace(/\s+/g, " ").length > MAX_CHUNK_CHARS
        ? " [truncated]"
        : "";
    return `### [${i + 1}] ${heading}\nDate: ${date}; score: ${score}\n${content}${truncated}`;
  });

  return lines.join("\n\n");
}

function renderResearchReceipts(
  contract: ChatTurnResearchContract,
  receipts: ResearchReceipt[] | undefined,
): string {
  const receiptLines = contract.requests.flatMap((request) => {
    const receipt = receipts?.find((item) => item.source === request.source);
    if (!receipt) {
      return [
        `## ${researchSourceLabel(request.source)} · MISSING`,
        "No Research receipt was produced. Treat this required source as failed and name the gap.",
      ];
    }

    const header = `## ${researchSourceLabel(request.source)} · ${receipt.status.toUpperCase()}`;
    const authority = "Authority: operating/process findings only.";
    const lines = [header, authority, `Reader: ${receipt.toolName}`];
    if (receipt.error) lines.push(`Error: ${receipt.error}`);
    if (receipt.status === "complete" || receipt.status === "empty") {
      const evidence = researchReceiptEvidenceText(receipt);
      if (evidence) lines.push("", evidence);
    }
    return lines;
  });

  const complete = researchCoverageComplete(contract, receipts);
  return [
    "# Chat-turn Research Receipts",
    "",
    `Coverage: ${complete ? "COMPLETE" : "INCOMPLETE"}.`,
    complete
      ? "Every required source produced a terminal successful read receipt."
      : "One or more required sources is missing, denied, unavailable, timed out, or failed. Do not claim that all requested sources were searched; name each gap explicitly.",
    "Cite each source family independently.",
    "",
    ...receiptLines,
  ].join("\n");
}

function compactText(
  value: unknown,
  maxChars = MAX_COMPACT_VALUE_CHARS,
): string | null {
  if (value == null) return null;
  const text = String(value).trim().replace(/\s+/g, " ");
  if (!text) return null;
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)} [truncated]`;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function renderTitledItems(
  value: unknown,
  fields: string[],
  limit = MAX_PACKET_LIST_ITEMS,
): string {
  const items = asArray(value)
    .slice(0, limit)
    .map((item) => {
      const record = asRecord(item);
      const title = compactText(record.title, 220);
      if (!title) return null;
      const detail = fields
        .map((field) => compactText(record[field], 320))
        .filter(Boolean)
        .join(" ");
      return detail ? `- ${title}: ${detail}` : `- ${title}`;
    })
    .filter((line): line is string => Boolean(line));
  return items.join("\n");
}

function renderPacketSourceCoverage(packet: Record<string, unknown>): string {
  const coverage = asRecord(packet.sourceCoverage ?? packet.source_coverage);
  const categoryRows = asArray(coverage.categoryCoverage);
  const linkedEvidenceCount = compactText(coverage.linkedEvidenceCount, 80);
  const latestSourceAt = compactText(coverage.latestSourceAt, 120);
  const lines: string[] = [];

  if (linkedEvidenceCount) {
    lines.push(`- linked evidence citations: ${linkedEvidenceCount}`);
  }
  if (latestSourceAt) {
    lines.push(`- latest packet source date: ${latestSourceAt}`);
  }

  for (const row of categoryRows.slice(0, 8)) {
    const record = asRecord(row);
    const label = compactText(record.label ?? record.category, 120);
    if (!label) continue;
    const selected = compactText(record.sourceCount, 40) ?? "0";
    const available = compactText(record.availableCount, 40) ?? "0";
    const latest = compactText(record.latestAt, 120);
    lines.push(
      `- ${label}: ${selected} selected / ${available} available${latest ? `; latest ${latest}` : ""}`,
    );
  }

  const qualityCounts = asRecord(coverage.sourceQualityCounts);
  if (Object.keys(qualityCounts).length > 0) {
    const quality = Object.entries(qualityCounts)
      .map(([key, value]) => `${key}=${compactText(value, 40) ?? "0"}`)
      .join(", ");
    lines.push(`- source quality: ${quality}`);
  }

  if (lines.length === 0) return "";
  return [
    "## Source Coverage",
    ...lines,
    "",
    "If this coverage lists meeting sources, do not claim no meeting transcripts surfaced. Say the packet has meeting coverage, and separately state if a fresh direct transcript lookup was not run or returned no additional rows.",
  ].join("\n");
}

function renderStrategicReport(packet: Record<string, unknown>): string {
  const packetJson = asRecord(packet.packetJson ?? packet.packet_json);
  const report = asRecord(packetJson.strategicReport);
  if (Object.keys(report).length === 0) return "";

  const sections = [
    ["What Changed", renderTitledItems(report.whatChanged, ["impact"])],
    [
      "Risks",
      renderTitledItems(report.risks, ["recommendedAction", "severity"]),
    ],
    [
      "Open Decisions",
      renderTitledItems(report.openDecisions, ["owner", "neededBy"]),
    ],
    ["Money Impact", compactText(asRecord(report.moneyImpact).summary, 700)],
    [
      "Promises Made",
      renderTitledItems(report.promisesMade, ["owner", "dueDate"]),
    ],
    [
      "Recommended Actions",
      renderTitledItems(report.recommendedActions, ["reason", "priority"]),
    ],
  ].filter(([, body]) => Boolean(body));

  if (sections.length === 0) return "";
  return [
    "## Strategic Report",
    ...sections.map(([title, body]) => `### ${title}\n${body}`),
  ].join("\n\n");
}

function renderProjectOperatingRecord(packet: Record<string, unknown>): string {
  const operatingRecord = asRecord(
    packet.operatingRecord ?? packet.operating_record,
  );
  if (Object.keys(operatingRecord).length === 0) return "";

  const currentState = asRecord(operatingRecord.currentState);
  const snapshot = asRecord(operatingRecord.latestSnapshot);
  const timelineEvents = asArray(operatingRecord.timelineEvents)
    .slice(0, 8)
    .map((item) => {
      const record = asRecord(item);
      const title = compactText(record.title, 180);
      if (!title) return null;
      const status = compactText(record.current_status, 80);
      const priority = compactText(record.priority, 80);
      const summary = compactText(record.summary, 280);
      const why = compactText(record.why_it_matters, 220);
      return `- ${title}${status ? ` (${status}${priority ? `, ${priority}` : ""})` : ""}: ${[summary, why].filter(Boolean).join(" ")}`;
    })
    .filter((value): value is string => Boolean(value));

  const changeCandidates = asArray(operatingRecord.changeEventCandidates)
    .slice(0, 6)
    .map((item) => {
      const record = asRecord(item);
      const title = compactText(record.title, 180);
      if (!title) return null;
      const status = compactText(record.status, 80);
      const reason = compactText(record.reason ?? record.description, 280);
      const cost = compactText(record.potential_cost_impact, 140);
      const schedule = compactText(record.potential_schedule_impact, 140);
      return `- ${title}${status ? ` (${status})` : ""}: ${[reason, cost, schedule].filter(Boolean).join(" ")}`;
    })
    .filter((value): value is string => Boolean(value));

  const databaseCounts = asRecord(snapshot.database_counts);
  const financialSnapshot = asRecord(snapshot.financial_snapshot);
  const countLine = Object.entries(databaseCounts)
    .slice(0, 10)
    .map(([key, value]) => `${key}=${compactText(value, 40) ?? "0"}`)
    .join(", ");
  const financialLine = [
    compactText(currentState.financial_read, 360),
    Object.keys(financialSnapshot).length > 0
      ? Object.entries(financialSnapshot)
          .slice(0, 8)
          .map(([key, value]) => `${key}=${compactText(value, 80) ?? ""}`)
          .join(", ")
      : null,
  ]
    .filter(Boolean)
    .join(" ");

  const lines = ["## Source-Synthesized Operating Record"];
  const summary = compactText(currentState.current_summary, 900);
  if (summary) lines.push(`### Current State\n${summary}`);

  const changed = renderTitledItems(
    currentState.what_changed_since_last_update,
    ["summary", "impact"],
    5,
  );
  if (changed) lines.push(`### What Changed Since Last Update\n${changed}`);

  const attention = renderTitledItems(
    currentState.needs_attention,
    ["summary", "owner", "priority"],
    5,
  );
  if (attention) lines.push(`### Needs Attention\n${attention}`);

  const decisions = renderTitledItems(
    currentState.open_decisions,
    ["summary", "owner", "neededBy"],
    5,
  );
  if (decisions) lines.push(`### Open Decisions\n${decisions}`);

  const risks = renderTitledItems(
    currentState.active_risks,
    ["summary", "recommendedAction", "severity"],
    5,
  );
  if (risks) lines.push(`### Active Risks\n${risks}`);

  if (timelineEvents.length > 0) {
    lines.push(`### Recent Timeline\n${timelineEvents.join("\n")}`);
  }
  if (changeCandidates.length > 0) {
    lines.push(`### Potential Change Events\n${changeCandidates.join("\n")}`);
  }
  if (financialLine) {
    lines.push(`### Financial / ERP Snapshot\n${financialLine}`);
  }
  if (countLine) {
    lines.push(`### Record Counts\n${countLine}`);
  }

  if (lines.length === 1) return "";
  lines.push(
    "Use this operating record as the running project brief. For exact proof, drill into the source document, email, Teams message, meeting transcript, or record-system tool before presenting a quote or final number.",
  );
  return lines.join("\n\n");
}

function renderDocumentIntelligence(packet: Record<string, unknown>): string {
  const coverage = asRecord(packet.sourceCoverage ?? packet.source_coverage);
  const packetJson = asRecord(packet.packetJson ?? packet.packet_json);
  const strategicReport = asRecord(packetJson.strategicReport);
  const documentIntelligence = asRecord(
    coverage.documentIntelligence ?? strategicReport.documentIntelligence,
  );
  if (Object.keys(documentIntelligence).length === 0) return "";

  const latest = asArray(documentIntelligence.latestByCategory)
    .slice(0, 6)
    .map((item) => {
      const record = asRecord(item);
      const latestRecord = asRecord(record.latest);
      const label = compactText(record.label ?? record.category, 120);
      const title = compactText(latestRecord.title, 180);
      const impact = compactText(record.projectImpact, 260);
      if (!label || !title) return null;
      return `- ${label}: ${title}${impact ? ` — ${impact}` : ""}`;
    })
    .filter((line): line is string => Boolean(line));

  const obligations = asArray(documentIntelligence.obligations)
    .slice(0, 4)
    .map((item) => {
      const record = asRecord(item);
      const title = compactText(record.title, 160);
      const obligation = compactText(record.obligation, 280);
      return title && obligation ? `- ${title}: ${obligation}` : null;
    })
    .filter((line): line is string => Boolean(line));

  const conflicts = asArray(documentIntelligence.conflictSignals)
    .slice(0, 4)
    .map((item) => {
      const record = asRecord(item);
      const title = compactText(record.title, 160);
      const signal = compactText(record.conflictSignal, 280);
      return title && signal ? `- ${title}: ${signal}` : null;
    })
    .filter((line): line is string => Boolean(line));

  const lines: string[] = ["## Document Intelligence"];
  if (latest.length > 0)
    lines.push("### Latest Document Signals", latest.join("\n"));
  if (obligations.length > 0)
    lines.push("### Obligations", obligations.join("\n"));
  if (conflicts.length > 0)
    lines.push("### Conflict / Revision Signals", conflicts.join("\n"));
  if (lines.length === 1) return "";
  lines.push(
    "Use this as the document baseline. Use document/source-specific RAG only when the user asks for exact clauses, excerpts, attachments, or proof.",
  );
  return lines.join("\n");
}

function renderIntelligencePacket(raw: unknown): string {
  if (!raw || typeof raw !== "object") return "";
  const packet = raw as Record<string, unknown>;
  const lines: string[] = [];

  // Staleness warning — packets older than the freshness window may misrepresent
  // current state. Tell the model so it doesn't assert stale facts.
  const isStale = packet.isStale === true;
  const ageHours = typeof packet.ageHours === "number" ? packet.ageHours : null;
  if (isStale && ageHours !== null) {
    const ageDisplay =
      ageHours >= 48
        ? `${Math.round(ageHours / 24)} days`
        : `${Math.round(ageHours)} hours`;
    lines.push(
      [
        "## ⚠️ STALE PACKET WARNING",
        `This intelligence packet was generated ${ageDisplay} ago and may be out of date.`,
        "Treat it as background context only — confirm critical claims by calling fresh tools (getProjectBriefingSnapshot, getMeetingsByDate, getRecentEmails) before stating numbers, dates, or decisions to the user.",
      ].join("\n"),
    );
  }

  const summary = compactText(
    packet.executiveSummary ?? packet.executive_summary,
  );
  if (summary) {
    lines.push(`## Executive Summary\n${summary}`);
  }

  const currentStatus = compactText(
    packet.currentStatus ?? packet.current_status,
  );
  if (currentStatus) {
    lines.push(`## Current Status\n${currentStatus}`);
  }

  const strategicRead = compactText(
    packet.strategicRead ?? packet.strategic_read,
  );
  if (strategicRead) {
    lines.push(`## Strategic Read\n${strategicRead}`);
  }

  const recommendedMoves = asArray(
    packet.recommendedNextMoves ?? packet.recommended_next_moves,
  )
    .map((move) => compactText(move, 260))
    .filter((move): move is string => Boolean(move))
    .slice(0, MAX_PACKET_LIST_ITEMS);
  if (recommendedMoves.length > 0) {
    lines.push(
      `## Recommended Next Moves\n${recommendedMoves.map((move) => `- ${move}`).join("\n")}`,
    );
  }

  const sourceCoverage = renderPacketSourceCoverage(packet);
  if (sourceCoverage) {
    lines.push(sourceCoverage);
  }

  const strategicReport = renderStrategicReport(packet);
  if (strategicReport) {
    lines.push(strategicReport);
  }

  const operatingRecord = renderProjectOperatingRecord(packet);
  if (operatingRecord) {
    lines.push(operatingRecord);
  }

  const documentIntelligence = renderDocumentIntelligence(packet);
  if (documentIntelligence) {
    lines.push(documentIntelligence);
  }

  const cards = Array.isArray(packet.cards)
    ? packet.cards.slice(0, MAX_PACKET_CARDS)
    : [];
  if (cards.length > 0) {
    const renderedCards = cards
      .map((card, index) => {
        if (!card || typeof card !== "object") return null;
        const cardRecord = card as Record<string, unknown>;
        const title = compactText(cardRecord.title, 160) ?? `Card ${index + 1}`;
        const cardSummary = compactText(
          cardRecord.summary ??
            cardRecord.description ??
            cardRecord.recommendation,
        );
        return cardSummary ? `### ${title}\n${cardSummary}` : `### ${title}`;
      })
      .filter((value): value is string => Boolean(value));
    if (renderedCards.length > 0) {
      lines.push(`## Cards\n${renderedCards.join("\n\n")}`);
    }
  }

  const status = compactText(
    packet.status ?? packet.health ?? packet.riskLevel,
    240,
  );
  if (status) {
    lines.push(`## Status\n${status}`);
  }

  if (lines.length === 0) {
    const id = compactText(
      packet.id ?? packet.targetId ?? packet.target_id,
      240,
    );
    if (id) {
      lines.push(`Packet ID: ${id}`);
    }
  }

  return lines.join("\n\n");
}

function renderCompactRecord(raw: unknown): string {
  if (!raw || typeof raw !== "object") return "";
  const entries = Object.entries(raw as Record<string, unknown>)
    .filter(([, value]) => value != null)
    .slice(0, 16)
    .map(([key, value]) => `- ${key}: ${compactText(value, 500) ?? ""}`);
  return entries.join("\n");
}

function renderRecentEmailInbox(raw: unknown): string {
  if (!raw || typeof raw !== "object") return "";
  const record = raw as Record<string, unknown>;
  const lines: string[] = [];

  for (const key of [
    "summary",
    "dataCutoffNote",
    "latestAvailableFallback",
    "requestedWindowEmpty",
    "latestAvailableReceivedAt",
    "count",
    "threadCount",
  ]) {
    const value = compactText(record[key], 700);
    if (value) lines.push(`- ${key}: ${value}`);
  }

  const threads = Array.isArray(record.threads)
    ? record.threads.slice(0, 12)
    : [];
  if (threads.length > 0) {
    lines.push("## Threads");
    threads.forEach((thread, index) => {
      if (!thread || typeof thread !== "object") return;
      const threadRecord = thread as Record<string, unknown>;
      const subject =
        compactText(threadRecord.latestSubject, 180) ?? `Thread ${index + 1}`;
      const receivedAt =
        compactText(threadRecord.latestReceivedAt, 80) ?? "unknown time";
      const senders = Array.isArray(threadRecord.senders)
        ? threadRecord.senders.join(", ")
        : compactText(threadRecord.senders, 240);
      const preview = compactText(threadRecord.latestPreview, 500);
      const messageCount = compactText(threadRecord.messageCount, 40);
      const attachmentNote =
        threadRecord.hasAttachments === true ? "; has attachments" : "";
      lines.push(
        [
          `${index + 1}. ${subject}`,
          `   received: ${receivedAt}${messageCount ? `; messages: ${messageCount}` : ""}${attachmentNote}`,
          senders ? `   senders: ${senders}` : null,
          preview ? `   preview: ${preview}` : null,
        ]
          .filter((line): line is string => Boolean(line))
          .join("\n"),
      );
    });
  }

  if (lines.length > 0) return lines.join("\n");
  return renderCompactRecord(raw);
}

function renderAppExpertPacket(raw: unknown): string {
  if (!raw || typeof raw !== "object") return "";
  const record = raw as Record<string, unknown>;
  const lines: string[] = [];

  for (const key of ["mode", "orchestrator"]) {
    const value = compactText(record[key], 240);
    if (value) lines.push(`- ${key}: ${value}`);
  }

  const skillsLoaded = Array.isArray(record.skillsLoaded)
    ? record.skillsLoaded.map((skill) => String(skill)).join(", ")
    : compactText(record.skillsLoaded, 500);
  if (skillsLoaded) lines.push(`- skillsLoaded: ${skillsLoaded}`);

  const approvedSkillContext = compactText(record.approvedSkillContext, 1800);
  if (approvedSkillContext) {
    lines.push("", "## Approved App-Help Skills", approvedSkillContext);
  }

  const answer = compactText(record.answer, 2500);
  if (answer) {
    lines.push("", "## Backend Answer", answer);
  }

  const sources = Array.isArray(record.sources)
    ? record.sources.slice(0, 12)
    : [];
  if (sources.length > 0) {
    lines.push("", "## Sources");
    sources.forEach((source, index) => {
      if (!source || typeof source !== "object") return;
      const sourceRecord = source as Record<string, unknown>;
      const title =
        compactText(sourceRecord.title, 180) ?? `Source ${index + 1}`;
      const sourceType = compactText(sourceRecord.sourceType, 80) ?? "unknown";
      const route = compactText(sourceRecord.route, 120);
      const filePath = compactText(sourceRecord.filePath, 180);
      const detail = compactText(sourceRecord.detail, 360);
      lines.push(
        [
          `${index + 1}. [${sourceType}] ${title}`,
          route ? `   route: ${route}` : null,
          filePath ? `   file: ${filePath}` : null,
          detail ? `   detail: ${detail}` : null,
        ]
          .filter((line): line is string => Boolean(line))
          .join("\n"),
      );
    });
  }

  const trace = Array.isArray(record.toolTrace)
    ? record.toolTrace.slice(0, 8)
    : [];
  if (trace.length > 0) {
    lines.push("", "## Backend Trace");
    for (const item of trace) {
      if (!item || typeof item !== "object") continue;
      const traceRecord = item as Record<string, unknown>;
      const agent = compactText(traceRecord.agent, 120) ?? "unknown-agent";
      const tool = compactText(traceRecord.tool, 120) ?? "unknown-tool";
      const status = compactText(traceRecord.status, 80) ?? "unknown";
      const detail = compactText(traceRecord.detail, 260);
      lines.push(
        `- ${agent}/${tool}: ${status}${detail ? ` - ${detail}` : ""}`,
      );
    }
  }

  return lines.join("\n");
}

function renderProjectOperatingContextContract(ctx: RetrievalContext): string {
  const hasPacket = Boolean(ctx.intelligencePacket);
  const hasSnapshot = Boolean(ctx.projectSnapshot);
  if (!hasPacket && !hasSnapshot) return "";

  return [
    "# Project Operating Context",
    "",
    "You have preloaded project operating context. Treat this as the baseline expert read for the selected project before using search results or runtime tools.",
    "",
    "- Use the intelligence packet for current status, risks, decisions, promises, recommended actions, confidence, source coverage, and document-intelligence signals.",
    "- Use the project briefing snapshot for structured project facts, team, financial, schedule, and record-system context.",
    "- Use vector/source-specific RAG as drilldown for exact documents, transcript passages, email/Teams evidence, specifications, drawings, RFIs, or source citations.",
    "- If packet freshness, coverage, or a requested source is missing, say which layer is missing and continue with the strongest available evidence.",
  ].join("\n");
}

function renderIntelligenceEvidenceContract(ctx: RetrievalContext): string {
  const evidence = ctx.intelligenceEvidence;
  if (!evidence) return "";
  const historical = evidence.historical.length;
  const reports = evidence.executiveReports.length;
  if (evidence.status !== "complete") {
    return [
      "# Project Intelligence Evidence Unavailable",
      "",
      `Completed Product Intelligence / Executive Report evidence is ${evidence.status}.`,
      evidence.reason ?? "No completed governed artifacts were returned.",
      "Do not present raw semantic chunks as current project intelligence. Say explicitly that evidence is insufficient and identify the missing artifact before offering a limited, source-specific read.",
    ].join("\n");
  }
  return [
    "# Governed Project Intelligence Evidence",
    "",
    `Completed Product Intelligence Packet: ${evidence.current ? "loaded (current)" : "missing"}.`,
    `Completed Executive Reports: ${reports}; packet lineage records: ${historical}.`,
    "Use the current packet for present-state claims, completed Executive Reports for historical context, and raw semantic results only for direct source excerpts/citations.",
    "Never blend historical report facts into a current claim without naming the report date.",
  ].join("\n");
}

export function assembleSystemPromptFromContext(
  plan: RetrievalPlan,
  ctx: RetrievalContext,
  basePrompt: string,
  options: AssembleSystemPromptOptions = {},
): string {
  const maxContextChars =
    Number.isFinite(options.maxContextChars) &&
    (options.maxContextChars as number) > 0
      ? (options.maxContextChars as number)
      : DEFAULT_SYSTEM_PROMPT_MAX_CHARS;
  const parts: string[] = [];

  const operatingContextContract = renderProjectOperatingContextContract(ctx);
  if (operatingContextContract) {
    parts.push(operatingContextContract);
  }

  const intelligenceEvidenceContract = renderIntelligenceEvidenceContract(ctx);
  if (intelligenceEvidenceContract) parts.push(intelligenceEvidenceContract);

  if (ctx.intelligencePacket) {
    const packet = renderIntelligencePacket(ctx.intelligencePacket);
    if (packet) {
      parts.push(
        `# Current Project Intelligence Packet\n\nA pre-rendered intelligence packet is available below. Use it as your primary evidence. Layer your own analysis, recommendations, and follow-up questions on top.\n\n${packet}`,
      );
    }
  }

  if (ctx.projectSnapshot) {
    const snapshot = renderCompactRecord(ctx.projectSnapshot);
    if (snapshot) {
      parts.push(`# Project Briefing Snapshot\n\n${snapshot}`);
    }
  }

  if (plan.sources.research) {
    parts.push(
      renderResearchReceipts(plan.sources.research, ctx.researchReceipts),
    );
  }

  if (ctx.semanticVectorResults) {
    const rendered = renderSemanticResults(ctx.semanticVectorResults);
    if (rendered) {
      parts.push(
        `# Vector Search Results\n\nThe following passages were retrieved from meeting transcripts, emails, Teams messages, OneDrive docs, and the company knowledge base. Cite by source/date when answering. If the evidence does not cover the question, say so explicitly.\n\n${rendered}`,
      );
    }
  }

  if (ctx.executiveBriefingRetrieval && !plan.sources.research) {
    const briefing = renderCompactRecord(ctx.executiveBriefingRetrieval);
    if (briefing) {
      parts.push(`# Recent Communication Signals\n\n${briefing}`);
    }
  }

  if (ctx.recentEmailInbox) {
    const recentEmailInbox = renderRecentEmailInbox(ctx.recentEmailInbox);
    if (recentEmailInbox) {
      parts.push(
        [
          "# Structured Outlook Inbox Result",
          "",
          "This came from the structured outlook_email_intake path, not semantic RAG. Use it to answer inbox/date/importance questions. If it contains an error, say which Outlook lookup failed and do not pretend the inbox was checked.",
          "",
          recentEmailInbox,
        ].join("\n"),
      );
    }
  }

  if (ctx.sourceSpecificRagAnswer) {
    const content = compactText(ctx.sourceSpecificRagAnswer.content, 2500);
    if (content) {
      parts.push(
        [
          "# Internal Source-Specific RAG Evidence",
          "",
          "This block is internal evidence for synthesis. Do NOT copy this block, its heading, coverage notes, freshness lines, source context lines, or numbered evidence rows into the final answer.",
          "Use it to produce a concise user-facing answer with the main themes, risks, decisions, and follow-ups. If evidence is thin, say that in plain English without exposing the internal evidence block.",
          "",
          content,
          "",
          "Final-answer contract: never begin the user-visible response with `Source-Specific RAG`, `Teams Message Evidence For Synthesis`, `Use these Teams snippets`, `Freshness`, or `Coverage note`. Do not output raw evidence rows.",
        ].join("\n"),
      );
    } else {
      // Pre-fetch was attempted but returned no rows. Tell the model to use
      // its runtime tools rather than saying "no data found."
      const kind = plan.sources.sourceSpecificRag?.kind ?? "data";
      parts.push(
        [
          `# Pre-fetch Returned No Results (${kind})`,
          "",
          "The server-side retrieval for this query found no matching records.",
          "Do NOT say 'no data available'. Instead, use your available tools to answer the question directly.",
          "Call the most relevant tool (e.g. getMeetingsByDate, getMeetingDetails, getActionItemsAndInsights, consultMicrosoftExecutiveAssistant) and report what you find.",
        ].join("\n"),
      );
    }
  }

  if (ctx.appExpertPacket) {
    const appExpert = renderAppExpertPacket(ctx.appExpertPacket);
    if (appExpert) {
      parts.push(
        [
          "# App Expert Packet",
          "",
          "This came from the backend read-only App Expert Deep Agents module. Use it for questions about app navigation, feature status, permissions, route ownership, and how Alleato PM works. Do not invent app behavior that is not supported by the sources below.",
          "",
          appExpert,
        ].join("\n"),
      );
    }
  }

  if (ctx.warnings.length > 0) {
    const lines = ctx.warnings
      .map((w) => `- ${w.source}: ${w.message}`)
      .join("\n");
    parts.push(
      `# Sources Unavailable\nThe following sources were attempted and did not return in time. Acknowledge this gap in your answer and proceed with what you have.\n${lines}`,
    );
  }

  void plan;

  if (parts.length === 0) {
    // No retrieval context was pre-loaded. Tell the model to reach for its
    // runtime tools rather than confabulating or refusing.
    const noDataBlock = [
      "# No Pre-fetched Context",
      "",
      "Nothing was pre-loaded for this query — no packet, snapshot, emails, or meetings.",
      "Use your available tools to answer. Do NOT invent facts about projects, people, budgets, schedules, or communications.",
      "",
      "## Tool routing for the most common owner questions",
      "",
      "**Project FACTS** (address, client, phase, manager, project number, OneDrive link, budget, completion %):",
      "  → call `getProjectDetails(projectName | projectId)`. These are STRUCTURED columns; do NOT semantic-search for them.",
      "",
      "**Find a specific DOCUMENT/FILE** (the permit, the contract, the latest drawings, the certificate of occupancy):",
      "  → call `findProjectDocuments(projectId|projectName, category, titleKeyword)`.",
      "  Categories: contract, permit, drawing, specification, submittal, rfi, daily_report, change_order, certificate, insurance, financial_document.",
      "",
      "**Search CONTENT inside documents** (e.g. 'what does the spec say about fire ratings'):",
      "  → call `searchDocuments(query, projectName?)`. This is vector search — use for topic / concept questions.",
      "",
      "**Risks / blockers / decisions on a project**:",
      "  → call `getProjectsWithRisks` for portfolio rollup, or `getProjectRiskAnalysis(projectId)` for a single project deep dive.",
      "",
      "**Microsoft operator work** (Outlook inbox/date triage, email replies, Teams escalation, Microsoft calendar/files):",
      "  → call `consultMicrosoftExecutiveAssistant`. The Strategist delegates this work instead of using direct Outlook/Teams tools.",
      "**Specialist analysis** (financial / operational / risk / people / BD / marketing):",
      "  → `consultCFO`, `consultCOO`, `consultCRO`, `consultCHRO`, `consultVPBD`, `consultCMO`.",
      "",
      "If the user has not specified a project, ask which one they mean before calling project-scoped tools.",
    ].join("\n");
    return `${noDataBlock}\n\n---\n\n${basePrompt}`;
  }

  const budgeted = enforceContextBudget(parts, basePrompt, maxContextChars);
  if (budgeted.omittedBlocks > 0 || budgeted.truncatedBlock) {
    const info = {
      maxContextChars,
      totalBlocks: parts.length,
      keptBlocks: budgeted.parts.length,
      omittedBlocks: budgeted.omittedBlocks,
      truncatedBlock: budgeted.truncatedBlock,
    };
    // Fail loudly (telemetry) AND visibly (to the model) — never silently drop
    // context and let the model claim full coverage of evidence it never saw.
    console.warn("[system-prompt] injected context exceeded budget", info);
    options.onContextTrimmed?.(info);
    budgeted.parts.push(
      [
        "# Context Truncated",
        "",
        `Some retrieved context was omitted to fit the model context window ` +
          `(${budgeted.omittedBlocks} block(s) dropped` +
          `${budgeted.truncatedBlock ? ", 1 block truncated" : ""}).`,
        "If the answer needs the missing detail, say so explicitly and use your tools to fetch it. Do not claim to have reviewed evidence that is not present above.",
      ].join("\n"),
    );
  }

  return `${budgeted.parts.join(SYSTEM_PROMPT_SEPARATOR)}${SYSTEM_PROMPT_SEPARATOR}${basePrompt}`;
}
