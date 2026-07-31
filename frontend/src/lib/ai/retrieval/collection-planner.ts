import { generateText, Output, type UIMessage } from "ai";
import { z } from "zod";
import { getLanguageModel } from "@/lib/ai/providers";
import { planRetrieval, type PlanInput } from "./planner";
import type {
  MeetingCollectionRequest,
  RetrievalPlan,
} from "./types";

const COLLECTION_PLANNER_MODEL =
  process.env.AI_ASSISTANT_COLLECTION_PLANNER_MODEL ?? "openai/gpt-4.1-mini";
const MAX_HISTORY_MESSAGES = 8;
const MAX_HISTORY_CHARS = 1_500;

export const collectionInterpretationSchema = z.object({
  isCollectionRequest: z.boolean(),
  corpus: z.enum(["meeting_transcripts", "unsupported"]),
  operation: z.enum(["analyze", "summarize", "compare", "list", "search"]),
  scope: z.enum(["all_matches", "matching_subset", "single_entity"]),
  semanticCriteria: z.string().max(800),
  searchTerms: z.array(z.string().min(1).max(120)).min(3).max(8),
  excludeTerms: z.array(z.string().min(1).max(120)).max(12),
  titleContains: z.string().max(160).nullable(),
  titleFilterExplicit: z.boolean(),
  category: z.string().max(120).nullable(),
  categoryFilterExplicit: z.boolean(),
  participant: z.string().max(120).nullable(),
  dateFrom: z.string().max(40).nullable(),
  dateTo: z.string().max(40).nullable(),
  requiresExhaustiveCoverage: z.boolean(),
  rationale: z.string().max(500),
});

export type CollectionInterpretation = z.infer<
  typeof collectionInterpretationSchema
>;

export type CanonicalEntityReference = {
  entityType: "meeting";
  entityId: string;
  canonicalPath: string;
};

const CANONICAL_ENTITY_ROUTES: Array<{
  entityType: CanonicalEntityReference["entityType"];
  pattern: RegExp;
}> = [
  {
    entityType: "meeting",
    pattern: /(?:https?:\/\/[^\s/]+)?\/meetings\/([A-Za-z0-9_-]+)/i,
  },
];

function messageText(parts: UIMessage["parts"]): string {
  return parts
    .filter(
      (part): part is Extract<(typeof parts)[number], { type: "text" }> =>
        part.type === "text",
    )
    .map((part) => part.text)
    .join("\n");
}

export function parseCanonicalEntityReference(
  message: string,
): CanonicalEntityReference | null {
  for (const route of CANONICAL_ENTITY_ROUTES) {
    const match = message.match(route.pattern);
    const entityId = match?.[1]?.trim();
    if (!entityId) continue;
    return {
      entityType: route.entityType,
      entityId,
      canonicalPath: `/meetings/${entityId}`,
    };
  }
  return null;
}

function recentConversation(messages: UIMessage[]): string {
  return messages
    .slice(-MAX_HISTORY_MESSAGES)
    .map((message) => {
      const content = messageText(message.parts)
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, MAX_HISTORY_CHARS);
      return `${message.role.toUpperCase()}: ${content}`;
    })
    .join("\n");
}

export async function interpretCollectionRequest(input: {
  message: string;
  messages: UIMessage[];
}): Promise<CollectionInterpretation> {
  const result = await generateText({
    model: getLanguageModel(COLLECTION_PLANNER_MODEL),
    output: Output.object({
      schema: collectionInterpretationSchema,
      name: "assistant_collection_plan",
      description:
        "A typed plan for an operation over a collection of authorized application records.",
    }),
    instructions: [
      "You compile natural-language requests into typed retrieval plans for Alleato PM.",
      "Interpret meaning across the recent conversation; never depend on an exact trigger word or phrase.",
      "A collection request asks to list, search, compare, summarize, or analyze one or more records selected by semantic criteria.",
      "The available collection corpus in this planner is meeting_transcripts. It supports metadata discovery by title, category, participant, project, and date, followed by exact transcript retrieval.",
      "Use corpus=unsupported when the request targets another record family or is ordinary conversation.",
      "For exhaustive language, use scope=all_matches and requiresExhaustiveCoverage=true.",
      "searchTerms are broad metadata candidate terms, not a final relevance decision. Return 3-8 plausible title/category phrases, synonyms, and application naming variants derived from meaning so discovery has high recall.",
      "excludeTerms are metadata phrases that affirmatively identify commonly confused record types that do not belong. Do not list generic filler words.",
      "semanticCriteria must be self-contained: state what belongs, what commonly confused record types do not belong, and how to distinguish them from metadata. A later semantic selector uses it to reject records that only share a generic word.",
      "Preserve the narrowest ordinary business meaning of the requested record class. Do not broaden a staff evaluation into project, document, design, financial, schedule, or risk reviews merely because they share a generic noun.",
      "Set titleFilterExplicit or categoryFilterExplicit only when the user explicitly states that exact metadata constraint (for example, says the title contains a phrase or names a category). Do not turn an ordinary description of the desired records into a literal metadata filter.",
      "Do not invent project IDs, dates, people, or entity IDs.",
      "If the latest message clarifies an earlier request, combine both turns into one plan.",
    ].join("\n"),
    prompt: `Recent conversation:\n${recentConversation(input.messages)}\n\nLatest request:\n${input.message}`,
  });

  return result.output;
}

function exactMeetingPlan(
  input: PlanInput,
  reference: CanonicalEntityReference,
): RetrievalPlan {
  const request: MeetingCollectionRequest = {
    corpus: "meeting_transcripts",
    operation: "analyze",
    scope: "single_entity",
    originalRequest: input.message,
    semanticCriteria: `The exact meeting referenced by ${reference.canonicalPath}`,
    searchTerms: [],
    excludeTerms: [],
    entityId: reference.entityId,
    requiresExhaustiveCoverage: true,
  };
  return {
    intent: "source_lookup",
    responseFormat: "collection_analysis",
    sources: { meetingCollection: request },
    selectedProjectId: input.selectedProjectId,
    reason: "canonical_entity_reference",
  };
}

export function collectionPlanFromInterpretation(
  input: PlanInput,
  interpretation: CollectionInterpretation,
): RetrievalPlan | null {
  if (
    !interpretation.isCollectionRequest ||
    interpretation.corpus !== "meeting_transcripts"
  ) {
    return null;
  }

  const request: MeetingCollectionRequest = {
    corpus: "meeting_transcripts",
    operation: interpretation.operation,
    scope: interpretation.scope,
    originalRequest: input.message,
    semanticCriteria: interpretation.semanticCriteria,
    searchTerms: [...new Set(interpretation.searchTerms.map((term) => term.trim()))]
      .filter(Boolean)
      .slice(0, 8),
    excludeTerms: [
      ...new Set(interpretation.excludeTerms.map((term) => term.trim())),
    ]
      .filter(Boolean)
      .slice(0, 12),
    titleContains: interpretation.titleFilterExplicit
      ? interpretation.titleContains
      : null,
    category: interpretation.categoryFilterExplicit
      ? interpretation.category
      : null,
    participant: interpretation.participant,
    dateFrom: interpretation.dateFrom,
    dateTo: interpretation.dateTo,
    requiresExhaustiveCoverage:
      interpretation.scope === "all_matches" ||
      interpretation.requiresExhaustiveCoverage,
  };

  return {
    intent: "source_lookup",
    responseFormat: "collection_analysis",
    sources: { meetingCollection: request },
    selectedProjectId: input.selectedProjectId,
    reason: "semantic_collection_plan",
  };
}

export type CollectionClassifier = (input: {
  message: string;
  messages: UIMessage[];
}) => Promise<CollectionInterpretation>;

export async function planRetrievalWithSemanticCollections(
  input: PlanInput,
  options: { classify?: CollectionClassifier } = {},
): Promise<RetrievalPlan> {
  const reference = parseCanonicalEntityReference(input.message);
  if (reference?.entityType === "meeting") {
    return exactMeetingPlan(input, reference);
  }

  const basePlan = planRetrieval(input);

  // A typed research contract is already the authoritative source-execution
  // plan for this turn. The semantic collection classifier owns only the
  // meeting-transcript corpus and must not replace an explicit request for
  // email, Teams, documents, or a combination of those sources.
  //
  // This boundary is deliberately contract-based: every research request
  // carries the same closed source ownership and receipt obligations. Allowing
  // the secondary classifier to override any of them silently drops requested
  // readers before execution.
  if (
    basePlan.sources.research ||
    (basePlan.responseFormat !== "conversational" &&
      basePlan.responseFormat !== "source_lookup")
  ) {
    return basePlan;
  }

  const classify = options.classify ?? interpretCollectionRequest;

  try {
    const interpretation = await classify({
      message: input.message,
      messages: input.messages,
    });
    return collectionPlanFromInterpretation(input, interpretation) ?? basePlan;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[collection-planner] semantic planning failed", {
      message,
      basePlanReason: basePlan.reason,
    });
    if (Object.keys(basePlan.sources).length === 0) {
      throw new Error(
        `Semantic request planning failed and the fallback plan contained no evidence sources. Refusing a source-free answer: ${message}`,
      );
    }
    return basePlan;
  }
}
