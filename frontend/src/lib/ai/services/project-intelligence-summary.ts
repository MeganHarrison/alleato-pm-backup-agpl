import { generateObject } from "ai";
import { z } from "zod";
import { formatAIProviderFailure } from "@/lib/ai/provider-config";
import { getLanguageModel } from "@/lib/ai/providers";

const DEFAULT_SUMMARY_MODEL = "openai/gpt-5.5";
const MAX_SOURCE_TEXT_CHARS = 1600;
const MAX_SOURCES = 96;

function createCitedItemSchema(sourceIds?: string[]) {
  const sourceIdSchema = sourceIds?.length
    ? z.enum(sourceIds as [string, ...string[]])
    : z.string().min(1);

  return z.object({
    title: z.string().min(3),
    sourceIds: z
      .array(sourceIdSchema)
      .min(1)
      .describe("IDs from the provided source list that support this item."),
  });
}

function createProjectIntelligenceSummarySchema(sourceIds?: string[]) {
  const citedItemSchema = createCitedItemSchema(sourceIds);
  const prioritySchema = z.enum(["low", "medium", "high", "critical"]);
  const severitySchema = z.enum(["low", "medium", "high", "critical"]);

  return z.object({
  headline: z
    .string()
    .min(8)
    .describe("One sentence that says what matters most."),
  context: z
    .string()
    .min(20)
    .describe("Short operator-facing summary of the situation and why it matters."),
  risks: z
    .array(
      citedItemSchema.extend({
        severity: severitySchema,
        recommendedAction: z.string().min(5),
      }),
    )
    .max(6),
  decisions: z
    .array(
      citedItemSchema.extend({
        owner: z.string().nullable(),
        followUp: z.string().nullable(),
      }),
    )
    .max(6),
  actionItems: z
    .array(
      citedItemSchema.extend({
        owner: z.string().nullable(),
        dueDate: z
          .string()
          .nullable()
          .describe("ISO date when explicit in the source, otherwise null."),
        priority: prioritySchema,
      }),
    )
    .max(8),
  dataGaps: z
    .array(z.string().min(5))
    .max(8)
    .describe("Missing inputs or ambiguities an operator should resolve."),
  confidence: z
    .enum(["low", "medium", "high"])
    .describe("Confidence based only on source specificity and agreement."),
  operatingSummary: z.object({
    currentExecutiveRead: z
      .string()
      .min(20)
      .describe("A concise but specific read of the project's current state."),
    immediateAttention: z
      .array(
        citedItemSchema.extend({
          detail: z.string().min(8),
          priority: prioritySchema,
        }),
      )
      .max(5)
      .describe("The short list of items leadership should notice immediately."),
    currentFocus: z
      .array(
        citedItemSchema.extend({
          status: z.string().nullable(),
          owner: z.string().nullable(),
          summary: z.string().min(8),
          nextDecision: z.string().nullable(),
          riskSeverity: severitySchema.nullable(),
        }),
      )
      .max(5)
      .describe("The few active workstreams that define the job right now."),
    timeline: z
      .array(
        citedItemSchema.extend({
          occurredAt: z
            .string()
            .nullable()
            .describe("ISO timestamp/date when explicit in the source, otherwise null."),
          significance: z.string().min(8),
        }),
      )
      .max(12)
      .describe("Chronological project history and recent change trail."),
    recentChanges: z
      .array(
        citedItemSchema.extend({
          changedArea: z.enum([
            "scope",
            "design",
            "financial",
            "schedule",
            "procurement",
            "rfi",
            "submittal",
            "drawing",
            "specification",
            "daily_report",
            "task",
            "risk",
            "other",
          ]),
          impact: z.string().min(8),
        }),
      )
      .max(10),
    financialPosition: z
      .object({
        summary: z.string().min(10),
        knownAmounts: z.array(citedItemSchema).max(8),
        exposure: z.array(citedItemSchema).max(8),
      })
      .describe("Budget, change, commitment, Acumatica, and cost exposure read."),
    scheduleAndProcurement: z.object({
      summary: z.string().min(10),
      blockers: z.array(citedItemSchema).max(8),
      upcomingDates: z
        .array(
          citedItemSchema.extend({
            date: z.string().nullable(),
          }),
        )
        .max(8),
    }),
    projectControls: z.object({
      rfis: z.array(citedItemSchema).max(8),
      submittals: z.array(citedItemSchema).max(8),
      drawings: z.array(citedItemSchema).max(8),
      specifications: z.array(citedItemSchema).max(8),
      dailyReports: z.array(citedItemSchema).max(8),
      tasks: z.array(citedItemSchema).max(8),
    }),
    openQuestions: z
      .array(
        citedItemSchema.extend({
          owner: z.string().nullable(),
          neededBy: z.string().nullable(),
        }),
      )
      .max(10),
    recommendedFocus: z
      .array(
        citedItemSchema.extend({
          reason: z.string().min(8),
          priority: prioritySchema,
        }),
      )
      .max(8),
    sourceCoverage: z.object({
      coveredTypes: z.array(z.string().min(1)).max(20),
      missingTypes: z.array(z.string().min(1)).max(20),
      weakestAreas: z.array(z.string().min(5)).max(8),
    }),
  }),
  });
}

export const projectIntelligenceSummarySchema = createProjectIntelligenceSummarySchema();

export type ProjectIntelligenceSummary = z.infer<
  typeof projectIntelligenceSummarySchema
> & {
  schema: "project_intelligence_summary_v1";
  model: string;
  sourceCount: number;
  sourceIds: string[];
};

export type ProjectIntelligenceSummarySource = {
  id: string;
  type:
    | "email"
    | "meeting"
    | "teams"
    | "document"
    | "acumatica"
    | "rfi"
    | "submittal"
    | "drawing"
    | "specification"
    | "daily_report"
    | "task"
    | "risk"
    | "source_sync"
    | "ai_insight"
    | "other";
  text: string;
  title?: string | null;
  projectName?: string | null;
  sourceUrl?: string | null;
  capturedAt?: string | null;
};

export type SummarizeProjectIntelligenceInput = {
  sources: ProjectIntelligenceSummarySource[];
  focus?:
    | "project_brief"
    | "project_intelligence"
    | "source_sync"
    | "handoff"
    | "daily_digest";
  projectName?: string | null;
  model?: string;
};

function normalizeSource(source: ProjectIntelligenceSummarySource, index: number) {
  const id = source.id.trim();
  const text = source.text.trim();
  if (!id) {
    throw new Error(`Project intelligence summary source at index ${index} is missing an id.`);
  }
  if (text.length < 10) {
    throw new Error(
      `Project intelligence summary source "${id}" must include at least 10 characters of text.`,
    );
  }

  return {
    ...source,
    id,
    text: text.slice(0, MAX_SOURCE_TEXT_CHARS),
    title: source.title?.trim() || null,
    projectName: source.projectName?.trim() || null,
    sourceUrl: source.sourceUrl?.trim() || null,
    capturedAt: source.capturedAt?.trim() || null,
  };
}

function buildSourceDigest(sources: ReturnType<typeof normalizeSource>[]): string {
  return sources
    .map((source, index) =>
      [
        `Source ${index + 1}`,
        `id: ${source.id}`,
        `type: ${source.type}`,
        source.title ? `title: ${source.title}` : null,
        source.projectName ? `project: ${source.projectName}` : null,
        source.capturedAt ? `captured_at: ${source.capturedAt}` : null,
        source.sourceUrl ? `url: ${source.sourceUrl}` : null,
        "text:",
        source.text,
      ]
        .filter(Boolean)
        .join("\n"),
    )
    .join("\n\n---\n\n");
}

function collectCitedSourceIds(summary: z.infer<typeof projectIntelligenceSummarySchema>) {
  return [
    ...summary.risks.flatMap((risk) => risk.sourceIds),
    ...summary.decisions.flatMap((decision) => decision.sourceIds),
    ...summary.actionItems.flatMap((actionItem) => actionItem.sourceIds),
    ...summary.operatingSummary.immediateAttention.flatMap((item) => item.sourceIds),
    ...summary.operatingSummary.currentFocus.flatMap((item) => item.sourceIds),
    ...summary.operatingSummary.timeline.flatMap((item) => item.sourceIds),
    ...summary.operatingSummary.recentChanges.flatMap((item) => item.sourceIds),
    ...summary.operatingSummary.financialPosition.knownAmounts.flatMap((item) => item.sourceIds),
    ...summary.operatingSummary.financialPosition.exposure.flatMap((item) => item.sourceIds),
    ...summary.operatingSummary.scheduleAndProcurement.blockers.flatMap((item) => item.sourceIds),
    ...summary.operatingSummary.scheduleAndProcurement.upcomingDates.flatMap((item) => item.sourceIds),
    ...summary.operatingSummary.projectControls.rfis.flatMap((item) => item.sourceIds),
    ...summary.operatingSummary.projectControls.submittals.flatMap((item) => item.sourceIds),
    ...summary.operatingSummary.projectControls.drawings.flatMap((item) => item.sourceIds),
    ...summary.operatingSummary.projectControls.specifications.flatMap((item) => item.sourceIds),
    ...summary.operatingSummary.projectControls.dailyReports.flatMap((item) => item.sourceIds),
    ...summary.operatingSummary.projectControls.tasks.flatMap((item) => item.sourceIds),
    ...summary.operatingSummary.openQuestions.flatMap((item) => item.sourceIds),
    ...summary.operatingSummary.recommendedFocus.flatMap((item) => item.sourceIds),
  ];
}

function assertKnownSourceIds(
  summary: z.infer<typeof projectIntelligenceSummarySchema>,
  knownSourceIds: Set<string>,
) {
  const unknown = [...new Set(collectCitedSourceIds(summary))].filter(
    (sourceId) => !knownSourceIds.has(sourceId),
  );

  if (unknown.length > 0) {
    throw new Error(
      `Project intelligence summary cited unknown source IDs: ${unknown.join(", ")}.`,
    );
  }
}

export async function summarizeProjectIntelligence(
  input: SummarizeProjectIntelligenceInput,
): Promise<ProjectIntelligenceSummary> {
  if (input.sources.length === 0) {
    throw new Error("Project intelligence summary requires at least one source.");
  }
  if (input.sources.length > MAX_SOURCES) {
    throw new Error(
      `Project intelligence summary supports at most ${MAX_SOURCES} sources per call.`,
    );
  }

  const normalizedSources = input.sources.map(normalizeSource);
  const sourceIds = normalizedSources.map((source) => source.id);
  const duplicateSourceIds = sourceIds.filter(
    (sourceId, index) => sourceIds.indexOf(sourceId) !== index,
  );
  if (duplicateSourceIds.length > 0) {
    throw new Error(
      `Project intelligence summary source IDs must be unique: ${[
        ...new Set(duplicateSourceIds),
      ].join(", ")}.`,
    );
  }

  const model = input.model ?? DEFAULT_SUMMARY_MODEL;
  const runtimeSchema = createProjectIntelligenceSummarySchema(sourceIds);

  try {
    const result = await generateObject({
      model: getLanguageModel(model),
      schema: runtimeSchema,
      schemaName: "project_intelligence_summary",
      schemaDescription:
        "A traceable construction project operating summary with present-state synthesis, current focus, risks, decisions, actions, timeline, and data gaps.",
      instructions: `You summarize construction project intelligence for operators.

Rules:
- Write this like an executive project briefing, not a PM widget dump.
- Present state first: currentExecutiveRead, immediateAttention, and currentFocus should explain what matters now before timeline/history.
- Lead with Brandon-specific priorities whenever the evidence shows something the owner must personally handle, approve, decide, confirm, or escalate.
- immediateAttention, actionItems, and recommendedFocus must clearly notate what Brandon specifically needs to handle before broader project context.
- Use only the provided sources.
- Cite supporting source IDs exactly as provided for every risk, decision, and action item.
- Cite source IDs for every operatingSummary item that references project facts.
- Do not invent owners, due dates, dollar amounts, project names, or source IDs.
- Use null when owner or due date is not explicit.
- Prefer concrete operational language over generic advice.
- Keep immediateAttention to the 3-5 items a leader should care about first.
- Keep currentFocus to the 3-5 active workstreams shaping the project.
- If the source evidence is thin, say so in dataGaps and lower confidence.`,
      prompt: [
        `Focus: ${input.focus ?? "project_brief"}`,
        input.projectName ? `Shared project context: ${input.projectName}` : null,
        `Available source IDs: ${sourceIds.join(", ")}`,
        "",
        "Sources:",
        buildSourceDigest(normalizedSources),
      ]
        .filter(Boolean)
        .join("\n"),
    });

    assertKnownSourceIds(result.object, new Set(sourceIds));

    return {
      schema: "project_intelligence_summary_v1",
      model,
      sourceCount: normalizedSources.length,
      sourceIds,
      ...result.object,
    };
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.startsWith("Project intelligence summary cited unknown source IDs")
    ) {
      throw error;
    }

    throw new Error(
      formatAIProviderFailure(error, "Project intelligence summarization"),
    );
  }
}
