import { generateText, Output, type LanguageModel } from "ai";
import { z } from "zod";

import { getLanguageModel } from "@/lib/ai/providers";
import type { MeetingCollectionItem, MeetingCollectionResult } from "./types";

const COLLECTION_EXTRACTION_MODEL =
  process.env.AI_ASSISTANT_COLLECTION_EXTRACTION_MODEL ?? "openai/gpt-4.1-nano";
export const COLLECTION_SYNTHESIS_MODEL =
  process.env.AI_ASSISTANT_COLLECTION_SYNTHESIS_MODEL ?? "openai/gpt-4.1-mini";
export const COLLECTION_ADVISOR_JUDGE_MODEL =
  process.env.AI_ASSISTANT_COLLECTION_ADVISOR_JUDGE_MODEL ??
  "openai/gpt-4.1-mini";
export const COLLECTION_ADVISOR_CONTRACT_VERSION = "executive-advisor-v1";
export const COLLECTION_SYNTHESIS_MAX_OUTPUT_TOKENS = 4_096;
export const COLLECTION_SYNTHESIS_MODE = "non_reasoning";
export const COLLECTION_SYNTHESIS_TIMEOUT_MS = 90_000;
export const COLLECTION_ADVISOR_JUDGE_TIMEOUT_MS = 30_000;
const COLLECTION_ADVISOR_MAX_ATTEMPTS = 2;
const TRANSCRIPT_CHUNK_CHARACTERS = 48_000;
const EXTRACTION_CONCURRENCY = 3;

const chunkEvidenceSchema = z.object({
  factualSummary: z.string().max(4_000),
  strengths: z.array(z.string().max(1_000)).max(12),
  coachingThemes: z.array(z.string().max(1_000)).max(12),
  commitments: z.array(z.string().max(1_000)).max(12),
  organizationalSignals: z.array(z.string().max(1_000)).max(12),
  evidence: z
    .array(
      z.object({
        claim: z.string().max(1_000),
        excerpt: z.string().max(500),
      }),
    )
    .max(16),
});

const advisorEvidenceIdsSchema = z.array(z.string()).min(1).max(6);

const advisorExecutiveReadSchema = z.object({
  thesis: z.string().min(120).max(1_200),
  evidenceMeetingIds: advisorEvidenceIdsSchema,
});

const advisorPrioritySignalSchema = z.object({
  title: z.string().min(4).max(100),
  judgment: z.string().min(80).max(900),
  implication: z.string().min(60).max(700),
  evidenceMeetingIds: advisorEvidenceIdsSchema,
});

const advisorActionSchema = z.object({
  action: z.string().min(12).max(180),
  rationale: z.string().min(50).max(600),
  evidenceMeetingIds: advisorEvidenceIdsSchema,
});

const advisorCaveatSchema = z.object({
  text: z.string().min(40).max(500),
  evidenceMeetingIds: advisorEvidenceIdsSchema,
});

const collectionAdvisorDraftSchema = z.object({
  executiveRead: advisorExecutiveReadSchema,
  prioritySignals: z.array(advisorPrioritySignalSchema).min(2).max(5),
  actions: z.array(advisorActionSchema).min(2).max(5),
  caveat: advisorCaveatSchema.nullable(),
});

const collectionAdvisorJudgeSchema = z.object({
  thesisSpecificity: z.number().int().min(1).max(5),
  prioritization: z.number().int().min(1).max(5),
  businessImplications: z.number().int().min(1).max(5),
  actionability: z.number().int().min(1).max(5),
  executiveVoice: z.number().int().min(1).max(5),
  feedback: z.array(z.string().min(10).max(240)).max(5),
});

export type CollectionAdvisorDraft = z.infer<
  typeof collectionAdvisorDraftSchema
>;

export type CollectionAdvisorQuality = {
  contractVersion: string;
  passed: true;
  score: number;
  attempts: number;
  judgeModel: string;
  semanticScores: Omit<
    z.infer<typeof collectionAdvisorJudgeSchema>,
    "feedback"
  >;
  reasons: string[];
};

type CollectionFinalSynthesisResult = {
  content: string;
  advisorQuality: CollectionAdvisorQuality;
};

export type MeetingChunkEvidence = z.infer<typeof chunkEvidenceSchema> & {
  meetingId: string;
  meetingTitle: string;
  meetingDate: string | null;
  sourceRef: string;
  chunkIndex: number;
  chunkCount: number;
};

export type CollectionChunkExtractor = (input: {
  item: MeetingCollectionItem;
  chunk: string;
  chunkIndex: number;
  chunkCount: number;
}) => Promise<z.infer<typeof chunkEvidenceSchema>>;

export type CollectionFinalSynthesizer = (input: {
  originalRequest: string;
  coverage: MeetingCollectionResult["coverage"];
  evidence: MeetingChunkEvidence[];
  model: LanguageModel;
}) => Promise<CollectionFinalSynthesisResult>;

export type MeetingCollectionSynthesisResult = {
  content: string;
  meetingCount: number;
  chunkCount: number;
  processedTranscriptCharacters: number;
  evidenceCharacters: number;
  extractionDurationMs: number;
  finalSynthesisDurationMs: number;
  finalSynthesisMaxOutputTokens: number;
  finalSynthesisMode: string;
  finalSynthesisTimeoutMs: number;
  advisorQuality: CollectionAdvisorQuality;
};

export function splitTranscriptForCollectionAnalysis(
  transcript: string,
  maxCharacters = TRANSCRIPT_CHUNK_CHARACTERS,
): string[] {
  if (!transcript.trim()) return [];
  if (transcript.length <= maxCharacters) return [transcript];

  const chunks: string[] = [];
  let cursor = 0;
  while (cursor < transcript.length) {
    const hardEnd = Math.min(cursor + maxCharacters, transcript.length);
    if (hardEnd === transcript.length) {
      chunks.push(transcript.slice(cursor));
      break;
    }

    const paragraphBreak = transcript.lastIndexOf("\n\n", hardEnd);
    const lineBreak = transcript.lastIndexOf("\n", hardEnd);
    const preferredEnd = Math.max(paragraphBreak, lineBreak);
    const end =
      preferredEnd > cursor + maxCharacters * 0.65 ? preferredEnd : hardEnd;
    chunks.push(transcript.slice(cursor, end));
    cursor = end;
  }

  return chunks.filter((chunk) => chunk.trim().length > 0);
}

async function mapWithConcurrency<T, TResult>(
  values: T[],
  concurrency: number,
  mapper: (value: T, index: number) => Promise<TResult>,
): Promise<TResult[]> {
  const results = new Array<TResult>(values.length);
  let cursor = 0;
  const workers = Array.from(
    { length: Math.min(concurrency, values.length) },
    async () => {
      while (cursor < values.length) {
        const index = cursor++;
        const value = values[index];
        if (value === undefined) continue;
        results[index] = await mapper(value, index);
      }
    },
  );
  await Promise.all(workers);
  return results;
}

async function extractMeetingChunk(input: {
  item: MeetingCollectionItem;
  chunk: string;
  chunkIndex: number;
  chunkCount: number;
}): Promise<z.infer<typeof chunkEvidenceSchema>> {
  const result = await generateText({
    model: getLanguageModel(COLLECTION_EXTRACTION_MODEL),
    output: Output.object({
      schema: chunkEvidenceSchema,
      name: "meeting_transcript_evidence",
      description:
        "Grounded evidence extracted from one complete transcript segment.",
    }),
    instructions: [
      "Extract only claims supported by the supplied transcript segment.",
      "Distinguish what participants explicitly said from your interpretation.",
      "Do not infer personality, motive, diagnosis, or private intent.",
      "Use short excerpts only as anchors; do not reproduce the transcript.",
      "If a category has no support, return an empty array.",
    ].join("\n"),
    prompt: [
      `Meeting: ${input.item.title}`,
      `Date: ${input.item.date ?? "unavailable"}`,
      `Source: ${input.item.sourceRef}`,
      `Transcript segment: ${input.chunkIndex + 1} of ${input.chunkCount}`,
      "Transcript segment:",
      input.chunk,
    ].join("\n\n"),
  });
  return result.output;
}

function createCollectionAdvisorDraftSchema(meetingIds: string[]) {
  const uniqueIds = [...new Set(meetingIds)];
  if (uniqueIds.length === 0) {
    throw new Error(
      "Collection advisor synthesis requires at least one evidence meeting ID.",
    );
  }
  const meetingIdSchema = z.enum(uniqueIds as [string, ...string[]]);
  const evidenceMeetingIds = z.array(meetingIdSchema).min(1).max(6);

  return collectionAdvisorDraftSchema.extend({
    executiveRead: advisorExecutiveReadSchema.extend({ evidenceMeetingIds }),
    prioritySignals: z
      .array(advisorPrioritySignalSchema.extend({ evidenceMeetingIds }))
      .min(2)
      .max(5),
    actions: z
      .array(advisorActionSchema.extend({ evidenceMeetingIds }))
      .min(2)
      .max(5),
    caveat: advisorCaveatSchema.extend({ evidenceMeetingIds }).nullable(),
  });
}

function normalizedWords(value: string): string[] {
  return value.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
}

function normalizedText(value: string): string {
  return normalizedWords(value).join(" ");
}

function repeatedOpenings(values: string[]): string[] {
  const openings = new Map<string, number>();
  for (const value of values) {
    const opening = normalizedWords(value).slice(0, 5).join(" ");
    if (!opening) continue;
    openings.set(opening, (openings.get(opening) ?? 0) + 1);
  }
  return [...openings.entries()]
    .filter(([, count]) => count > 1)
    .map(([opening]) => opening);
}

export function validateCollectionAdvisorDraft(
  draft: CollectionAdvisorDraft,
): string[] {
  const issues: string[] = [];
  const signalTitles = draft.prioritySignals.map((signal) =>
    normalizedText(signal.title),
  );
  if (new Set(signalTitles).size !== signalTitles.length) {
    issues.push("priority signal titles must be distinct");
  }

  const actionLabels = draft.actions.map((action) =>
    normalizedText(action.action),
  );
  if (new Set(actionLabels).size !== actionLabels.length) {
    issues.push("recommended actions must be distinct");
  }

  const narrativeBlocks = [
    ...draft.prioritySignals.flatMap((signal) => [
      signal.judgment,
      signal.implication,
    ]),
    ...draft.actions.map((action) => action.rationale),
  ].map(normalizedText);
  if (new Set(narrativeBlocks).size !== narrativeBlocks.length) {
    issues.push("narrative sections must not duplicate one another");
  }

  const repeatedSignalOpenings = repeatedOpenings(
    draft.prioritySignals.map((signal) => signal.judgment),
  );
  if (repeatedSignalOpenings.length > 0) {
    issues.push(
      `priority signals repeat the same opening structure: ${repeatedSignalOpenings.join(", ")}`,
    );
  }

  const repeatedActionOpenings = repeatedOpenings(
    draft.actions.map((action) => action.rationale),
  );
  if (repeatedActionOpenings.length > 0) {
    issues.push(
      `action rationales repeat the same opening structure: ${repeatedActionOpenings.join(", ")}`,
    );
  }

  return issues;
}

function renderEvidenceReferences(
  meetingIds: string[],
  sourceRefByMeetingId: Map<string, string>,
): string {
  const references = [...new Set(meetingIds)].map((meetingId) => {
    const reference = sourceRefByMeetingId.get(meetingId);
    if (!reference) {
      throw new Error(
        `Collection advisor contract referenced unknown meeting ID ${meetingId}.`,
      );
    }
    return reference;
  });
  return references.join(" ");
}

export function renderCollectionAdvisorAnswer(input: {
  draft: CollectionAdvisorDraft;
  coverage: MeetingCollectionResult["coverage"];
  evidence: Pick<MeetingChunkEvidence, "meetingId" | "sourceRef">[];
}): string {
  const sourceRefByMeetingId = new Map(
    input.evidence.map((item) => [item.meetingId, item.sourceRef]),
  );
  const lines = [
    "## Executive read",
    "",
    `${input.draft.executiveRead.thesis} ${renderEvidenceReferences(
      input.draft.executiveRead.evidenceMeetingIds,
      sourceRefByMeetingId,
    )}`,
    "",
    "## What matters most",
    "",
  ];

  for (const [index, signal] of input.draft.prioritySignals.entries()) {
    lines.push(
      `### ${index + 1}. ${signal.title}`,
      "",
      signal.judgment,
      "",
      `**Why it matters:** ${signal.implication} ${renderEvidenceReferences(
        signal.evidenceMeetingIds,
        sourceRefByMeetingId,
      )}`,
      "",
    );
  }

  lines.push("## What I would do next", "");
  for (const [index, action] of input.draft.actions.entries()) {
    lines.push(
      `${index + 1}. **${action.action}** — ${action.rationale} ${renderEvidenceReferences(
        action.evidenceMeetingIds,
        sourceRefByMeetingId,
      )}`,
      "",
    );
  }

  if (input.draft.caveat) {
    lines.push(
      "## Where I would be careful",
      "",
      `${input.draft.caveat.text} ${renderEvidenceReferences(
        input.draft.caveat.evidenceMeetingIds,
        sourceRefByMeetingId,
      )}`,
      "",
    );
  }

  const meetingLabel =
    input.coverage.retrieved === 1 ? "matching meeting" : "matching meetings";
  const failureLabel =
    input.coverage.failed === 0
      ? "none were unavailable"
      : `${input.coverage.failed} were unavailable`;
  lines.push(
    "---",
    "",
    `_Evidence basis: all ${input.coverage.retrieved} ${meetingLabel} were reviewed; ${failureLabel}._`,
  );
  return lines.join("\n").trim();
}

async function generateAdvisorDraft(input: {
  originalRequest: string;
  coverage: MeetingCollectionResult["coverage"];
  evidence: MeetingChunkEvidence[];
  model: LanguageModel;
  correctionFeedback: string[];
}): Promise<CollectionAdvisorDraft> {
  const result = await generateText({
    model: input.model,
    maxOutputTokens: COLLECTION_SYNTHESIS_MAX_OUTPUT_TOKENS,
    abortSignal: AbortSignal.timeout(COLLECTION_SYNTHESIS_TIMEOUT_MS),
    output: Output.object({
      schema: createCollectionAdvisorDraftSchema(
        input.evidence.map((item) => item.meetingId),
      ),
      name: "collection_executive_advisor_answer",
      description:
        "A prioritized, evidence-backed executive judgment with implications and concrete leadership actions.",
    }),
    instructions: [
      "Act as a candid executive advisor, not a retrieval system or report generator.",
      "Give the leader a point of view: choose the few patterns with the greatest organizational consequence and state what they mean.",
      "Prioritize rather than catalog. Omitting lower-impact categories is expected.",
      "Make each priority signal a distinct judgment, then explain the concrete business implication.",
      "Recommend a short sequence of decisions or actions that a leadership team can actually take.",
      "Write direct, natural prose with varied sentence structure. Do not reuse a template lead-in across sections.",
      "Ground every thesis, signal, action, and caveat in one or more supplied meeting IDs. Use only exact meetingId values from the evidence.",
      "Do not infer personality, motive, diagnosis, or private intent.",
      "Do not mention retrieval, coverage, transcript characters, model passes, chunks, JSON, or implementation details; coverage is rendered separately.",
      "Return prose fields only. Do not put headings, lists, source labels, or markdown inside the fields.",
    ].join("\n"),
    prompt: [
      `User request: ${input.originalRequest}`,
      `Collection status: ${JSON.stringify({
        matched: input.coverage.matched,
        retrieved: input.coverage.retrieved,
        failed: input.coverage.failed,
        exhaustive: input.coverage.exhaustive,
      })}`,
      ...(input.correctionFeedback.length > 0
        ? [
            "The previous draft failed the advisor quality contract. Correct these issues:",
            input.correctionFeedback.map((item) => `- ${item}`).join("\n"),
          ]
        : []),
      "Grounded per-meeting evidence:",
      JSON.stringify(input.evidence),
    ].join("\n\n"),
  });

  if (result.finishReason === "length") {
    throw new Error(
      `Collection synthesis exceeded its ${COLLECTION_SYNTHESIS_MAX_OUTPUT_TOKENS}-token output contract.`,
    );
  }
  return result.output;
}

async function judgeAdvisorAnswer(input: {
  originalRequest: string;
  content: string;
}): Promise<z.infer<typeof collectionAdvisorJudgeSchema>> {
  const result = await generateText({
    model: getLanguageModel(COLLECTION_ADVISOR_JUDGE_MODEL),
    maxOutputTokens: 1_200,
    abortSignal: AbortSignal.timeout(COLLECTION_ADVISOR_JUDGE_TIMEOUT_MS),
    output: Output.object({
      schema: collectionAdvisorJudgeSchema,
      name: "collection_executive_advisor_quality",
      description:
        "A strict semantic quality review of an executive-advisor answer.",
    }),
    instructions: [
      "Grade the answer as if a senior executive asked a trusted advisor for judgment, not a data inventory.",
      "Score each dimension from 1 to 5. A passing score is 4 or 5 in every dimension.",
      "Thesis specificity: the opening makes a consequential, evidence-shaped judgment rather than restating the request.",
      "Prioritization: the answer chooses what matters most instead of listing every category found.",
      "Business implications: it explains consequences, risks, tradeoffs, or leverage for leadership.",
      "Actionability: recommended actions are concrete enough to guide a leadership decision or operating change.",
      "Executive voice: prose is candid, natural, concise, and varied rather than mechanical or repetitive.",
      "Return brief correction feedback for every dimension below 4. Do not praise the answer.",
    ].join("\n"),
    prompt: [
      `User request: ${input.originalRequest}`,
      "Candidate answer:",
      input.content,
    ].join("\n\n"),
  });
  return result.output;
}

function failedAdvisorJudgeDimensions(
  judge: z.infer<typeof collectionAdvisorJudgeSchema>,
): string[] {
  const dimensions = [
    ["thesis specificity", judge.thesisSpecificity],
    ["prioritization", judge.prioritization],
    ["business implications", judge.businessImplications],
    ["actionability", judge.actionability],
    ["executive voice", judge.executiveVoice],
  ] as const;
  return dimensions
    .filter(([, score]) => score < 4)
    .map(([name, score]) => `${name} scored ${score}/5`);
}

async function synthesizeCollectionEvidence(input: {
  originalRequest: string;
  coverage: MeetingCollectionResult["coverage"];
  evidence: MeetingChunkEvidence[];
  model: LanguageModel;
}): Promise<CollectionFinalSynthesisResult> {
  let correctionFeedback: string[] = [];
  let lastFailure = "unknown advisor quality failure";

  for (let attempt = 1; attempt <= COLLECTION_ADVISOR_MAX_ATTEMPTS; attempt++) {
    const draft = await generateAdvisorDraft({
      ...input,
      correctionFeedback,
    });
    const structuralIssues = validateCollectionAdvisorDraft(draft);
    if (structuralIssues.length > 0) {
      lastFailure = structuralIssues.join("; ");
      correctionFeedback = structuralIssues;
      continue;
    }

    const content = renderCollectionAdvisorAnswer({
      draft,
      coverage: input.coverage,
      evidence: input.evidence,
    });
    const judge = await judgeAdvisorAnswer({
      originalRequest: input.originalRequest,
      content,
    });
    const failedDimensions = failedAdvisorJudgeDimensions(judge);
    if (failedDimensions.length > 0) {
      correctionFeedback =
        judge.feedback.length > 0 ? judge.feedback : failedDimensions;
      lastFailure = [...failedDimensions, ...judge.feedback].join("; ");
      continue;
    }

    const semanticScores = {
      thesisSpecificity: judge.thesisSpecificity,
      prioritization: judge.prioritization,
      businessImplications: judge.businessImplications,
      actionability: judge.actionability,
      executiveVoice: judge.executiveVoice,
    };
    const score = Math.round(
      (Object.values(semanticScores).reduce((sum, value) => sum + value, 0) /
        (Object.keys(semanticScores).length * 5)) *
        100,
    );
    return {
      content,
      advisorQuality: {
        contractVersion: COLLECTION_ADVISOR_CONTRACT_VERSION,
        passed: true,
        score,
        attempts: attempt,
        judgeModel: COLLECTION_ADVISOR_JUDGE_MODEL,
        semanticScores,
        reasons: [
          `semantic executive-advisor review passed at ${score}/100`,
          "typed executive thesis present",
          `${draft.prioritySignals.length} distinct prioritized signals with business implications`,
          `${draft.actions.length} distinct leadership actions`,
          "all evidence IDs validated against the retrieved collection",
          "coverage rendered deterministically after the advice",
        ],
      },
    };
  }

  throw new Error(
    `Collection advisor contract failed after ${COLLECTION_ADVISOR_MAX_ATTEMPTS} attempts: ${lastFailure}`,
  );
}

export async function synthesizeMeetingCollection(input: {
  collection: MeetingCollectionResult;
  model: LanguageModel;
  extractChunk?: CollectionChunkExtractor;
  synthesizeFinal?: CollectionFinalSynthesizer;
}): Promise<MeetingCollectionSynthesisResult> {
  if (
    input.collection.status !== "complete" ||
    !input.collection.coverage.exhaustive ||
    input.collection.coverage.failed > 0
  ) {
    throw new Error(
      `Collection synthesis requires complete, exhaustive retrieval; received status=${input.collection.status}, exhaustive=${input.collection.coverage.exhaustive}, failed=${input.collection.coverage.failed}.`,
    );
  }

  const work = input.collection.items.flatMap((item) => {
    const chunks = splitTranscriptForCollectionAnalysis(item.transcript);
    return chunks.map((chunk, chunkIndex) => ({
      item,
      chunk,
      chunkIndex,
      chunkCount: chunks.length,
    }));
  });
  if (work.length === 0) {
    throw new Error(
      "Complete collection retrieval contained no transcript text to analyze.",
    );
  }

  const extractor = input.extractChunk ?? extractMeetingChunk;
  const extractionStartedAt = Date.now();
  const extracted = await mapWithConcurrency(
    work,
    EXTRACTION_CONCURRENCY,
    async (entry) => {
      const evidence = await extractor(entry);
      return {
        ...evidence,
        meetingId: entry.item.id,
        meetingTitle: entry.item.title,
        meetingDate: entry.item.date,
        sourceRef: entry.item.sourceRef,
        chunkIndex: entry.chunkIndex,
        chunkCount: entry.chunkCount,
      } satisfies MeetingChunkEvidence;
    },
  );
  const extractionDurationMs = Date.now() - extractionStartedAt;

  const finalSynthesizer =
    input.synthesizeFinal ?? synthesizeCollectionEvidence;
  const finalSynthesisStartedAt = Date.now();
  const finalSynthesis = await finalSynthesizer({
    originalRequest: input.collection.request.originalRequest,
    coverage: input.collection.coverage,
    evidence: extracted,
    model: input.model,
  });
  const finalSynthesisDurationMs = Date.now() - finalSynthesisStartedAt;

  return {
    content: finalSynthesis.content,
    meetingCount: input.collection.items.length,
    chunkCount: work.length,
    processedTranscriptCharacters: input.collection.items.reduce(
      (total, item) => total + item.transcriptCharacters,
      0,
    ),
    evidenceCharacters: JSON.stringify(extracted).length,
    extractionDurationMs,
    finalSynthesisDurationMs,
    finalSynthesisMaxOutputTokens: COLLECTION_SYNTHESIS_MAX_OUTPUT_TOKENS,
    finalSynthesisMode: COLLECTION_SYNTHESIS_MODE,
    finalSynthesisTimeoutMs: COLLECTION_SYNTHESIS_TIMEOUT_MS,
    advisorQuality: finalSynthesis.advisorQuality,
  };
}
