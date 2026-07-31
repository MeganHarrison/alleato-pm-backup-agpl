/**
 * Code-owned LLM-as-a-judge for assistant responses.
 *
 * Scores the semantic quality the cheap heuristics in `score-response-quality.ts`
 * can't see — directly targeting the failure modes this assistant actually hit:
 * deflection (answering a different thing / a system-status report instead of the
 * question) and generic filler. Runs on a SAMPLE of production responses and
 * writes the result as Langfuse trace scores.
 *
 * OFF BY DEFAULT — set LANGFUSE_LLM_JUDGE_ENABLED=true and a non-zero
 * LANGFUSE_LLM_JUDGE_SAMPLE_RATE to turn it on. This keeps a real (small) LLM
 * cost from appearing until you opt in.
 *
 * Cost knobs:
 *   LANGFUSE_LLM_JUDGE_ENABLED      "true" to enable (default off)
 *   LANGFUSE_LLM_JUDGE_SAMPLE_RATE  0..1, fraction of responses judged (default 0)
 *   LANGFUSE_LLM_JUDGE_MODEL        model id (default "gpt-4.1-mini")
 */
import { generateObject } from "ai";
import { z } from "zod";

const score01 = z.number().min(0).max(1);

const judgeSchema = z.object({
  relevance: score01.describe(
    "Did the answer directly address THE question the user asked? Score low if it deflected to a different topic, returned a system/source-health/status report instead of answering, stalled, or answered a question that wasn't asked.",
  ),
  specificity: score01.describe(
    "Concrete and specific (real numbers, names, dates, facts) vs generic filler or boilerplate advice.",
  ),
  completeness: score01.describe(
    "Did it cover what was asked, or leave the core of the request unanswered?",
  ),
  reasoning: z.string().describe("One or two sentences justifying the scores."),
});

export type JudgeResult = z.infer<typeof judgeSchema>;

const JUDGE_SYSTEM = [
  "You are a strict evaluator for a construction project-management AI assistant used by executives and project managers.",
  "You are given the USER QUESTION and the ASSISTANT ANSWER. Score the answer on each dimension from 0 (terrible) to 1 (excellent).",
  "Be harsh about deflection: an answer that reports system/source/sync health, says it will look something up, asks which project/list they mean, or otherwise dodges the actual question must get a LOW relevance score even if it is well written.",
  "Be harsh about generic filler: vague best-practice advice with no concrete project facts gets a LOW specificity score.",
  "Judge only what is asked — do not reward extra unrelated content.",
].join(" ");

/**
 * Run the LLM judge on a single Q/A. Throws on model/parse failure — callers
 * should treat the judge as best-effort and swallow errors.
 */
export async function judgeChatResponse(params: {
  question: string;
  answer: string;
  modelId?: string;
}): Promise<JudgeResult> {
  const modelId = params.modelId ?? process.env.LANGFUSE_LLM_JUDGE_MODEL ?? "gpt-4.1-mini";
  // Lazy import keeps the heavy provider chain (and bcrypt) out of the module
  // graph for the off-by-default path and for unit tests of the sampling gate.
  const { getLanguageModel } = await import("@/lib/ai/providers");
  const { object } = await generateObject({
    model: getLanguageModel(modelId),
    schema: judgeSchema,
    instructions: JUDGE_SYSTEM,
    prompt: [
      `USER QUESTION:\n${params.question}`,
      "",
      `ASSISTANT ANSWER:\n${params.answer}`,
    ].join("\n"),
  });
  return object;
}

/**
 * Whether the judge should run for this response. Gated by env flag + sample
 * rate. `rng`/`rate` are injectable for deterministic tests.
 */
export function shouldRunJudge(options?: { rate?: number; rng?: () => number }): boolean {
  if (process.env.LANGFUSE_LLM_JUDGE_ENABLED !== "true") return false;
  const rate =
    options?.rate ?? Number.parseFloat(process.env.LANGFUSE_LLM_JUDGE_SAMPLE_RATE ?? "0");
  if (!Number.isFinite(rate) || rate <= 0) return false;
  if (rate >= 1) return true;
  const rng = options?.rng ?? Math.random;
  return rng() < rate;
}
