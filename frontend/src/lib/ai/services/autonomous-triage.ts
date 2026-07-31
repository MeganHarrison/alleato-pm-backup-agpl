/**
 * Autonomous triage of stuck AI learning candidates.
 *
 * The learning loop creates `agent_learnings` rows. Categorized feedback (a
 * thumbs-down with a reason, a submittal-review correction) lands as `active`
 * immediately, but an uncategorized thumbs-down lands as `candidate` and only
 * activates on a *second* occurrence — so single-occurrence candidates pile up
 * forever and never influence the AI (51 stuck as of 2026-06-27).
 *
 * This module scores each candidate with a cheap model and takes ONE of three
 * actions, behind deliberate safety rails:
 *   - promote  → status `active` (only on a confident, specific verdict)
 *   - archive  → status `archived` (only on a confident junk verdict)
 *   - keep     → left as `candidate` for human review
 *
 * Safety: feature-flagged off by default, conservative thresholds, every action
 * is a reversible status flip (no deletes), and the full run is reported to
 * Teams. It deliberately does NOT auto-apply the human-review
 * `ai_learning_promotions` queue — that gate stays human. It only counts that
 * queue for the digest.
 */

import { generateText, Output } from "ai";
import { z } from "zod";
import { getLanguageModel } from "@/lib/ai/providers";
import { serviceDb } from "@/lib/supabase/service-db";
import { sendProactiveTeamsDM } from "@/lib/bot/teams-proactive";
import { OWNER_BRIEFING_RECIPIENTS } from "@/lib/executive/owner-briefing-recipients";
import { logger } from "@/lib/logger";

/**
 * Who receives the triage digest. The learning-system operator, not the full
 * owner-briefing list — Brandon doesn't need triage internals. Resolved against
 * the authoritative `OWNER_BRIEFING_RECIPIENTS` registry so the Teams user id
 * isn't re-hardcoded here.
 */
const TRIAGE_DIGEST_OPERATOR_EMAIL = "mharrison@alleatogroup.com";
import {
  decideTriageAction,
  DEFAULT_TRIAGE_CONFIG,
  type TriageConfig,
  type TriageVerdict,
} from "@/lib/ai/services/autonomous-triage-decision";

export {
  decideTriageAction,
  DEFAULT_TRIAGE_CONFIG,
} from "@/lib/ai/services/autonomous-triage-decision";
export type {
  TriageAction,
  TriageConfig,
  TriageDecision,
  TriageVerdict,
} from "@/lib/ai/services/autonomous-triage-decision";

/** Cheapest scoring model — same one human-gated-learning uses for candidates. */
const TRIAGE_MODEL = "openai/gpt-4.1-nano";
/** Cap per run so a backlog can't blow the cron's time/token budget. */
export const MAX_CANDIDATES_PER_RUN = 40;
/**
 * Only these learning sources are auto-triaged. `admin_feedback` candidates are
 * page-scoped UI bug reports (their own feedback-inbox review owns them), not
 * reusable assistant prevention prompts — so they are deliberately excluded.
 */
export const TRIAGEABLE_SOURCES = ["thumbs_down", "eval_failure"] as const;

interface CandidateRow {
  id: string;
  title: string;
  source: string;
  problem_signature: string;
  symptoms: string;
  prevention_prompt: string;
  confidence: number;
  occurrences: number;
}

const verdictSchema = z.object({
  decision: z.enum(["promote", "archive", "keep"]),
  confidence: z.number().min(0).max(1),
  rationale: z.string().max(400),
});

async function scoreCandidate(candidate: CandidateRow): Promise<TriageVerdict> {
  const result = await generateText({
    model: getLanguageModel(TRIAGE_MODEL),
    output: Output.object({
      schema: verdictSchema,
      name: "learning_triage_verdict",
      description:
        "Whether a candidate agent-learning should be promoted to active, archived as junk, or kept for human review.",
    }),
    instructions: `You triage "agent learnings" for a construction project-management AI. An agent learning is a prevention prompt that gets injected into the assistant's context to stop a repeated mistake. Decide ONE action for the candidate:
- promote: specific, clearly correct, reusable, and safe to always inject. It prevents a real recurring mistake without over-constraining unrelated answers.
- archive: vague, one-off, contradictory, nonsensical, or so generic it would only add noise.
- keep: plausible but you are not confident — leave it for a human.

Be conservative. Only choose promote when you are confident the learning is correct, specific, and safe to apply broadly. When in doubt, choose keep.`,
    prompt: `Candidate learning:
Title: ${candidate.title}
Problem signature: ${candidate.problem_signature}
Symptoms: ${candidate.symptoms}
Prevention prompt (this exact text gets injected): ${candidate.prevention_prompt}
Times seen: ${candidate.occurrences}
Current confidence: ${candidate.confidence}`,
  });
  return result.output;
}

export interface TriageRunResult {
  scanned: number;
  promoted: number;
  archived: number;
  kept: number;
  scoringFailed: number;
  remainingCandidates: number;
  pendingHumanPromotions: number;
  promotedTitles: string[];
  topRemaining: Array<{ title: string; confidence: number }>;
  teamsSent: boolean;
  dryRun: boolean;
}

/**
 * Scan stuck candidate learnings, score each, and apply the gated action.
 * `dryRun` scores and reports without writing any status change.
 */
export async function runAutonomousTriage(
  opts: { dryRun?: boolean; config?: TriageConfig } = {},
): Promise<TriageRunResult> {
  const dryRun = opts.dryRun ?? false;
  const config = opts.config ?? DEFAULT_TRIAGE_CONFIG;

  const { data: candidates, error } = await serviceDb.from("agent_learnings")
    .select(
      "id, title, source, problem_signature, symptoms, prevention_prompt, confidence, occurrences",
    )
    .eq("status", "candidate")
    // Only triage genuine AI-quality learnings. `admin_feedback` candidates are
    // page-scoped UI bug reports from the feedback inbox — they have their own
    // human review flow and must not be auto-promoted into the assistant.
    .in("source", [...TRIAGEABLE_SOURCES])
    .order("last_seen_at", { ascending: false })
    .limit(MAX_CANDIDATES_PER_RUN);

  if (error) {
    throw new Error(`Failed to load candidate learnings: ${error.message}`);
  }

  const rows = (candidates ?? []) as CandidateRow[];
  let promoted = 0;
  let archived = 0;
  let kept = 0;
  let scoringFailed = 0;
  const promotedTitles: string[] = [];

  for (const candidate of rows) {
    let verdict: TriageVerdict;
    try {
      verdict = await scoreCandidate(candidate);
    } catch (scoreError) {
      scoringFailed++;
      logger.warn({
        msg: "[autonomous-triage] scoring failed",
        data: {
          learningId: candidate.id,
          error:
            scoreError instanceof Error ? scoreError.message : String(scoreError),
        },
      });
      continue;
    }

    const action = decideTriageAction(verdict, config);
    if (action === "keep") {
      kept++;
      continue;
    }

    if (!dryRun) {
      const update =
        action === "promote"
          ? {
              status: "active" as const,
              activated_at: new Date().toISOString(),
              confidence: Math.max(candidate.confidence, verdict.confidence),
            }
          : { status: "archived" as const };
      const { error: updateError } = await serviceDb.from("agent_learnings")
        .update(update)
        .eq("id", candidate.id);
      if (updateError) {
        scoringFailed++;
        logger.warn({
          msg: "[autonomous-triage] status update failed",
          data: { learningId: candidate.id, action, error: updateError.message },
        });
        continue;
      }
    }

    if (action === "promote") {
      promoted++;
      promotedTitles.push(candidate.title);
    } else {
      archived++;
    }
  }

  const [{ count: remainingCandidates }, { count: pendingHumanPromotions }, topRemainingRes] =
    await Promise.all([
      serviceDb.from("agent_learnings")
        .select("id", { count: "exact", head: true })
        .eq("status", "candidate"),
      serviceDb.from("ai_learning_promotions")
        .select("id", { count: "exact", head: true })
        .eq("status", "candidate"),
      serviceDb.from("agent_learnings")
        .select("title, confidence")
        .eq("status", "candidate")
        .order("confidence", { ascending: false })
        .limit(5),
    ]);

  const result: TriageRunResult = {
    scanned: rows.length,
    promoted,
    archived,
    kept,
    scoringFailed,
    remainingCandidates: remainingCandidates ?? 0,
    pendingHumanPromotions: pendingHumanPromotions ?? 0,
    promotedTitles,
    topRemaining: (topRemainingRes.data ?? []).map((r) => ({
      title: (r as { title: string }).title,
      confidence: (r as { confidence: number }).confidence,
    })),
    teamsSent: false,
    dryRun,
  };

  const teams = await sendTriageDigestToTeams(result);
  result.teamsSent = teams.ok;
  return result;
}

function formatTriageDigest(digest: TriageRunResult): string {
  const lines = [
    `**AI Learning ${digest.dryRun ? "Triage — dry run" : "Autonomous Triage"}**`,
    `Scanned ${digest.scanned} eligible candidate${digest.scanned === 1 ? "" : "s"}.`,
    `- Promoted to active: ${digest.promoted}`,
    `- Archived as noise: ${digest.archived}`,
    `- Kept for human review: ${digest.kept}`,
    ...(digest.scoringFailed ? [`- Scoring errors: ${digest.scoringFailed}`] : []),
    `- Candidates remaining: ${digest.remainingCandidates}`,
    `- Promotions awaiting your review: ${digest.pendingHumanPromotions}`,
  ];
  if (digest.promotedTitles.length > 0) {
    lines.push("", "Promoted:");
    lines.push(...digest.promotedTitles.slice(0, 8).map((title) => `- ${title}`));
  }
  if (digest.remainingCandidates > 0 || digest.pendingHumanPromotions > 0) {
    lines.push("", "Review the rest at /learning-feedback.");
  }
  return lines.join("\n");
}

/**
 * Deliver the digest via the bot proactive-DM path (same one the daily owner
 * briefing uses) to the learning-system operator. There is no Power Automate
 * webhook in this app — Teams delivery is the bot. Noise-gated: a silent
 * scheduled no-op run (nothing promoted/archived, no errors) sends nothing; a
 * dry run always sends so a manual preview is visible. Failure-isolated.
 */
async function sendTriageDigestToTeams(
  digest: TriageRunResult,
): Promise<{ ok: boolean }> {
  const hadActivity =
    digest.promoted + digest.archived + digest.scoringFailed > 0;
  if (!digest.dryRun && !hadActivity) {
    return { ok: true };
  }

  const operator = OWNER_BRIEFING_RECIPIENTS.find(
    (r) => r.email.toLowerCase() === TRIAGE_DIGEST_OPERATOR_EMAIL,
  );
  if (!operator) {
    logger.warn({
      msg: "[autonomous-triage] no digest operator configured",
      data: { email: TRIAGE_DIGEST_OPERATOR_EMAIL },
    });
    return { ok: false };
  }

  try {
    const result = await sendProactiveTeamsDM(
      operator.supabaseUserId,
      formatTriageDigest(digest),
    );
    return { ok: result.sent };
  } catch (error) {
    logger.warn({
      msg: "[autonomous-triage] Teams digest delivery failed",
      data: { error: error instanceof Error ? error.message : String(error) },
    });
    return { ok: false };
  }
}
