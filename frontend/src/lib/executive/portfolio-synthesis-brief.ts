/**
 * L4 — Portfolio brief SYNTHESIS-of-syntheses.
 *
 * The redesign's L4: synthesize ACROSS the per-project L2 packets
 * (`project_intelligence_synthesis_v1`) into ONE cross-portfolio executive brief.
 *
 * This deliberately does NOT:
 *   - read `insight_cards` verbatim (the current subpar card-dump path), or
 *   - run raw RAG chunk search (the old broken path).
 * It reads the already-synthesized project packets — each one a coherent read of
 * a single project — plus the deterministic financial pulse (real AR / pending
 * CO numbers from Acumatica), and asks one strong model to produce the
 * cross-portfolio brief: one-line → what changed → needs Brandon → watch list →
 * waiting on.
 *
 * Gated behind PORTFOLIO_SYNTHESIS_BRIEF_ENABLED. The builder itself always runs
 * (so it can be reviewed via a dry run); the flag gates whether the delivery
 * path uses it instead of the legacy verbatim-card brief. Re-enable AM/PM Teams
 * delivery only after a human approves the output (PRP G6 / Phase 5).
 */
import { generateText } from "ai";

import { getLanguageModel } from "@/lib/ai/providers";
import {
  financialPulseToSynthesisContext,
  loadFinancialPulse,
} from "@/lib/executive/financial-pulse";
import { serviceDb } from "@/lib/supabase/service-db";

export const PORTFOLIO_SYNTHESIS_BRIEF_COMPILER_VERSION =
  "project_intelligence_synthesis_v1";
export const PORTFOLIO_SYNTHESIS_BRIEF_MODEL = "gpt-5.5";
const PORTFOLIO_SYNTHESIS_TIMEOUT_MS = 240_000;

export function isPortfolioSynthesisBriefEnabled(): boolean {
  return (process.env.PORTFOLIO_SYNTHESIS_BRIEF_ENABLED ?? "")
    .toLowerCase()
    .trim() === "true";
}

export type PortfolioBriefChange = {
  project: string;
  point: string;
  whyItMatters: string;
};

export type PortfolioBriefDecision = {
  project: string;
  decision: string;
  why: string;
  priority: "high" | "medium";
};

export type PortfolioBriefWatchItem = {
  project: string;
  risk: string;
  severity: string;
};

export type PortfolioBriefWaitingItem = {
  project: string;
  item: string;
  owner: string | null;
};

export type PortfolioSynthesisBrief = {
  generatedAt: string;
  oneLine: string;
  whatChanged: PortfolioBriefChange[];
  needsBrandon: PortfolioBriefDecision[];
  watchList: PortfolioBriefWatchItem[];
  waitingOn: PortfolioBriefWaitingItem[];
  projectsCovered: number;
  model: string;
};

type ProjectPacketDigest = {
  projectName: string;
  executiveRead: string;
  whatChanged: { point: string; whyItMatters: string }[];
  risks: { risk: string; severity: string }[];
  openDecisions: { decision: string; owner: string | null }[];
  recommendedActions: { action: string; priority: string }[];
  confidence: string;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object")
    : [];
}

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function stripJsonFence(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith("```")) {
    return trimmed.replace(/^```[a-z]*\n?/i, "").replace(/```$/, "").trim();
  }
  return trimmed;
}

/**
 * Load every active client-project's current L2 synthesis packet and reduce each
 * to the compact digest the cross-portfolio pass reasons over.
 */
export async function loadSynthesisPacketDigests(): Promise<ProjectPacketDigest[]> {

  const { data: targets, error: targetError } = await serviceDb.from("intelligence_targets")
    .select("id, name")
    .eq("target_type", "client_project")
    .eq("status", "active")
    .limit(500);

  if (targetError) {
    throw new Error(`Failed to load intelligence targets: ${targetError.message}`);
  }
  const targetIds = (targets ?? []).map((row) => row.id);
  if (targetIds.length === 0) return [];

  const { data: packets, error: packetError } = await serviceDb.from("intelligence_packets")
    .select("target_id, packet_json, generated_at")
    .in("target_id", targetIds)
    .eq("packet_type", "current")
    .eq("compiler_version", PORTFOLIO_SYNTHESIS_BRIEF_COMPILER_VERSION);

  if (packetError) {
    throw new Error(`Failed to load synthesis packets: ${packetError.message}`);
  }

  const digests: ProjectPacketDigest[] = [];
  for (const packet of packets ?? []) {
    const summary = asRecord(asRecord(packet.packet_json).summary);
    const executiveRead = str(summary.currentExecutiveRead);
    if (!executiveRead) continue; // a packet with no narrative adds nothing to the cross-read

    const target = asRecord(asRecord(packet.packet_json).target);
    const projectName = str(target.name) || "Unknown project";

    digests.push({
      projectName,
      executiveRead,
      whatChanged: asArray(summary.whatChanged)
        .map((it) => ({ point: str(it.title), whyItMatters: str(it.impact) }))
        .filter((it) => it.point),
      risks: asArray(summary.risks)
        .map((it) => ({ risk: str(it.title), severity: str(it.severity) || "medium" }))
        .filter((it) => it.risk),
      openDecisions: asArray(summary.openDecisions)
        .map((it) => ({ decision: str(it.title), owner: str(it.owner) || null }))
        .filter((it) => it.decision),
      recommendedActions: asArray(summary.recommendedActions)
        .map((it) => ({ action: str(it.title), priority: str(it.priority) || "medium" }))
        .filter((it) => it.action),
      confidence: str(summary.confidence) || "medium",
    });
  }
  return digests;
}

const PORTFOLIO_SYSTEM =
  "You are the chief of staff to the owner of a construction firm. You are given " +
  "the already-synthesized executive read of EACH active project plus the firm's " +
  "real financial numbers. Your job is to synthesize ACROSS projects into one " +
  "portfolio brief the owner reads in two minutes: what actually moved, what needs " +
  "his decision today, what to watch, what is stuck waiting. Synthesize and " +
  "prioritize across the whole portfolio — do not just concatenate per-project " +
  "lists. Prefer fewer, sharper, cross-cutting items. Respond with a single JSON " +
  "object and nothing else.";

function buildUserPrompt(
  digests: ProjectPacketDigest[],
  financialContext: string,
): string {
  const projectBlocks = digests
    .map((d) => {
      const changed = d.whatChanged.map((c) => `    - ${c.point} (${c.whyItMatters})`).join("\n");
      const risks = d.risks.map((r) => `    - [${r.severity}] ${r.risk}`).join("\n");
      const decisions = d.openDecisions
        .map((dec) => `    - ${dec.decision}${dec.owner ? ` (owner: ${dec.owner})` : ""}`)
        .join("\n");
      const actions = d.recommendedActions.map((a) => `    - [${a.priority}] ${a.action}`).join("\n");
      return [
        `### ${d.projectName} (confidence: ${d.confidence})`,
        `  Executive read: ${d.executiveRead}`,
        changed ? `  What changed:\n${changed}` : "",
        risks ? `  Risks:\n${risks}` : "",
        decisions ? `  Open decisions:\n${decisions}` : "",
        actions ? `  Recommended actions:\n${actions}` : "",
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n");

  return [
    "PER-PROJECT SYNTHESIZED STATE (already analyzed — your job is the cross-portfolio read):",
    "",
    projectBlocks,
    "",
    financialContext,
    "",
    "Produce the portfolio brief as EXACTLY this JSON:",
    "{",
    '  "oneLine": "one sentence: the state of the whole portfolio today",',
    '  "whatChanged": [{"project":"...","point":"what moved","whyItMatters":"..."}],',
    '  "needsBrandon": [{"project":"...","decision":"the call he must make today","why":"...","priority":"high|medium"}],',
    '  "watchList": [{"project":"...","risk":"...","severity":"critical|high|medium|low"}],',
    '  "waitingOn": [{"project":"...","item":"what is stuck","owner":"name or null"}]',
    "}",
    "",
    "Rules: be honest about a quiet day — a short brief is correct when little moved. " +
      "Do not manufacture urgency. Use real project names. You MAY cite real dollar " +
      "figures from the financial ground truth, but never invent numbers.",
  ].join("\n");
}

/**
 * Build the cross-portfolio synthesis brief. Always runnable (for dry-run
 * review); the delivery path checks isPortfolioSynthesisBriefEnabled().
 *
 * Throws on an empty/failed model response — never returns a silent empty brief.
 */
export async function buildPortfolioSynthesisBrief(options?: {
  model?: string;
}): Promise<PortfolioSynthesisBrief> {
  const model = options?.model ?? PORTFOLIO_SYNTHESIS_BRIEF_MODEL;
  const digests = await loadSynthesisPacketDigests();

  const generatedAt = new Date().toISOString();
  if (digests.length === 0) {
    throw new Error(
      "No project synthesis packets found (compiler_version " +
        `${PORTFOLIO_SYNTHESIS_BRIEF_COMPILER_VERSION}). Run L2 refresh before the portfolio brief.`,
    );
  }

  let financialContext = "FINANCIAL GROUND TRUTH: Data unavailable this run.";
  try {
    const pulse = await loadFinancialPulse();
    financialContext = financialPulseToSynthesisContext(pulse);
  } catch (error) {
    console.warn("[portfolio-synthesis-brief] Financial pulse unavailable; using explicit fallback context.", error);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PORTFOLIO_SYNTHESIS_TIMEOUT_MS);
  let raw: string;
  try {
    const result = await generateText({
      model: getLanguageModel(model),
      temperature: 0.2,
      instructions: PORTFOLIO_SYSTEM,
      messages: [{ role: "user", content: buildUserPrompt(digests, financialContext) }],
      abortSignal: controller.signal,
    });
    raw = result.text.trim();
  } finally {
    clearTimeout(timeout);
  }

  if (!raw) {
    throw new Error("Portfolio synthesis returned an empty response (model failure).");
  }

  const parsed = JSON.parse(stripJsonFence(raw)) as Partial<{
    oneLine: string;
    whatChanged: PortfolioBriefChange[];
    needsBrandon: PortfolioBriefDecision[];
    watchList: PortfolioBriefWatchItem[];
    waitingOn: PortfolioBriefWaitingItem[];
  }>;

  return {
    generatedAt,
    oneLine: str(parsed.oneLine),
    whatChanged: asArray(parsed.whatChanged).map((it) => ({
      project: str(it.project),
      point: str(it.point),
      whyItMatters: str(it.whyItMatters),
    })),
    needsBrandon: asArray(parsed.needsBrandon).map((it) => ({
      project: str(it.project),
      decision: str(it.decision),
      why: str(it.why),
      priority: str(it.priority) === "high" ? "high" : "medium",
    })),
    watchList: asArray(parsed.watchList).map((it) => ({
      project: str(it.project),
      risk: str(it.risk),
      severity: str(it.severity) || "medium",
    })),
    waitingOn: asArray(parsed.waitingOn).map((it) => ({
      project: str(it.project),
      item: str(it.item),
      owner: str(it.owner) || null,
    })),
    projectsCovered: digests.length,
    model,
  };
}
