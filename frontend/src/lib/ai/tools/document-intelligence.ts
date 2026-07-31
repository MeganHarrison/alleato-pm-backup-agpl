import { tool } from "ai";
import { z } from "zod";
import {
  EMBEDDING,
  generateEmbedding,
  resolveProject,
  type ToolTracePayload,
  withTrace as _withTrace,
} from "./tool-utils";
import { createToolContext, type ToolContext } from "./tool-context";
import { ingestSubmittalReviewCorrectionLearning } from "@/lib/ai/services/agent-learning-service";

import { type AnyRow } from "./types";

type CreateDocumentIntelligenceToolsOptions = {
  onTrace?: (trace: ToolTracePayload) => void;
  pinnedProjectId?: number;
  // Injected data seam; defaults to building a real context when omitted.
  ctx?: ToolContext;
};

function withTrace<TInput extends Record<string, unknown>, TResult>(
  name: string,
  options: CreateDocumentIntelligenceToolsOptions,
  execute: (input: TInput) => Promise<TResult>,
) {
  return _withTrace(
    name,
    options,
    execute,
    "This document intelligence tool failed. Explain the gap and proceed with other available information.",
  );
}

// ---------------------------------------------------------------------------
// Spec requirement types
// ---------------------------------------------------------------------------

const REQUIREMENT_TYPES = [
  "material",
  "manufacturer",
  "performance",
  "documentation",
  "code_reference",
  "installation",
  "warranty",
] as const;

type StoredSpecDocumentRow = {
  id: string;
  title: string | null;
  content: string | null;
  raw_text: string | null;
  summary: string | null;
  overview: string | null;
  source: string | null;
  source_system: string | null;
  document_type: string | null;
  category: string | null;
};

type SpecSourceResult = {
  documentId: string;
  title: string;
  excerptCount: number;
  excerpts: string[];
};

const SPEC_TITLE_KEYWORDS = [
  "spec",
  "specification",
  "division",
  "section",
  "csi",
  "requirements",
];

function tokenizeSpecQuery(query: string): string[] {
  return Array.from(
    new Set(
      query
        .toLowerCase()
        .split(/[^a-z0-9.-]+/i)
        .map((token) => token.trim())
        .filter((token) => token.length >= 3),
    ),
  );
}

function extractSpecSectionHints(query: string): string[] {
  return Array.from(
    new Set(
      query.match(/\b\d{2}(?:[-.\s]?\d{2,4}){1,3}\b/g)?.map((match) =>
        match.replace(/\s+/g, "-"),
      ) ?? [],
    ),
  );
}

function compactWhitespace(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function buildSpecExcerpt(text: string, queryTokens: string[]): string {
  const normalized = compactWhitespace(text);
  if (!normalized) return "";

  const lower = normalized.toLowerCase();
  const firstHit = queryTokens
    .map((token) => lower.indexOf(token))
    .filter((index) => index >= 0)
    .sort((a, b) => a - b)[0];

  if (firstHit === undefined) {
    return normalized.slice(0, 500);
  }

  const start = Math.max(0, firstHit - 140);
  const end = Math.min(normalized.length, firstHit + 360);
  return normalized.slice(start, end).trim();
}

function scoreStoredSpecDocument(
  row: StoredSpecDocumentRow,
  queryTokens: string[],
  specSectionHints: string[],
): number {
  const title = compactWhitespace(row.title).toLowerCase();
  const text = compactWhitespace(
    row.content ?? row.raw_text ?? row.summary ?? row.overview,
  ).toLowerCase();

  let score = 0;

  if (
    SPEC_TITLE_KEYWORDS.some((keyword) => title.includes(keyword)) ||
    row.category === "specification"
  ) {
    score += 6;
  }

  if (
    row.document_type?.toLowerCase().includes("spec") ||
    row.source_system?.toLowerCase().includes("spec")
  ) {
    score += 4;
  }

  for (const hint of specSectionHints) {
    const normalizedHint = hint.toLowerCase();
    if (title.includes(normalizedHint)) score += 7;
    if (text.includes(normalizedHint)) score += 5;
  }

  for (const token of queryTokens) {
    if (title.includes(token)) score += 3;
    if (text.includes(token)) score += 1;
  }

  return score;
}

function hasStoredSpecSignal(
  row: StoredSpecDocumentRow,
  specSectionHints: string[],
): boolean {
  const title = compactWhitespace(row.title).toLowerCase();
  const text = compactWhitespace(
    row.content ?? row.raw_text ?? row.summary ?? row.overview,
  ).toLowerCase();

  if (
    row.category === "specification" ||
    row.document_type?.toLowerCase().includes("spec") ||
    row.source_system?.toLowerCase().includes("spec") ||
    SPEC_TITLE_KEYWORDS.some((keyword) => title.includes(keyword))
  ) {
    return true;
  }

  return specSectionHints.some((hint) => {
    const normalizedHint = hint.toLowerCase();
    return title.includes(normalizedHint) || text.includes(normalizedHint);
  });
}

export function findStoredSpecDocumentMatches(
  rows: StoredSpecDocumentRow[],
  query: string,
  maxSources = 4,
): SpecSourceResult[] {
  const queryTokens = tokenizeSpecQuery(query);
  const specSectionHints = extractSpecSectionHints(query);

  return rows
    .map((row) => {
      const fullText = compactWhitespace(
        row.content ?? row.raw_text ?? row.summary ?? row.overview,
      );
      const score = scoreStoredSpecDocument(row, queryTokens, specSectionHints);
      return {
        row,
        score,
        hasSpecSignal: hasStoredSpecSignal(row, specSectionHints),
        excerpt: buildSpecExcerpt(fullText, queryTokens),
      };
    })
    .filter(
      ({ score, excerpt, hasSpecSignal }) =>
        hasSpecSignal && score > 0 && excerpt.length > 0,
    )
    .sort((a, b) => b.score - a.score)
    .slice(0, maxSources)
    .map(({ row, excerpt }) => ({
      documentId: row.id,
      title: compactWhitespace(row.title) || row.id,
      excerptCount: 1,
      excerpts: [excerpt],
    }));
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createDocumentIntelligenceTools(
  userId: string,
  options: CreateDocumentIntelligenceToolsOptions = {},
) {
  const ctx = options.ctx ?? createToolContext({ userId, pinnedProjectId: options.pinnedProjectId });
  const supabase = ctx.db;
  const ragSupabase = ctx.rag;
  const guardrails = ctx.guardrails;

  async function resolveSpecificationSources(
    query: string,
    resolvedProjectId?: number,
    topK = 12,
  ): Promise<{
    sources: SpecSourceResult[];
    combinedText: string;
    note?: string;
  }> {
    const specSectionHints = extractSpecSectionHints(query);
    const canonicalSpecSources: SpecSourceResult[] = [];

    if (resolvedProjectId && specSectionHints.length > 0) {
      const canonicalResp = await supabase
        .from("specification_sections")
        .select(
          "id, section_number, title, description, division, content, ai_summary, status",
        )
        .eq("project_id", resolvedProjectId)
        .ilike("section_number", `%${specSectionHints[0]}%`)
        .limit(4);

      if (canonicalResp.error) {
        throw new Error(
          `Specification section lookup failed: ${canonicalResp.error.message}`,
        );
      }
      canonicalSpecSources.push(
        ...((canonicalResp.data ?? []) as Array<{
          id: number;
          section_number: string;
          title: string;
          description: string | null;
          division: string | null;
          content: string | null;
          ai_summary: string | null;
        }>).map((row) => ({
          documentId: `specification_section:${row.id}`,
          title: `${row.section_number} - ${row.title}`,
          excerptCount: 1,
          excerpts: [
            buildSpecExcerpt(
              compactWhitespace(row.content ?? row.ai_summary),
              tokenizeSpecQuery(query),
            ) ||
              compactWhitespace(row.description) ||
              compactWhitespace(row.ai_summary) ||
              `Specification section ${row.section_number}${row.division ? ` (${row.division})` : ""} is present, but no extracted body text is stored yet.`,
          ],
        })),
      );
    }

    if (canonicalSpecSources.length > 0) {
      const combinedText = canonicalSpecSources
        .flatMap((source) => source.excerpts)
        .join("\n\n")
        .slice(0, 6000);

      return { sources: canonicalSpecSources.slice(0, topK), combinedText };
    }

    if (!resolvedProjectId) {
      return {
        sources: [],
        combinedText: "",
        note:
          "No project scope was provided for specification lookup. Provide a project so the search can use project spec sources instead of a broad global search.",
      };
    }

    const { data: candidateRows, error: candidateError } = await ragSupabase
      .from("rag_document_metadata")
      .select(
        "id, title, content, raw_text, summary, overview, source, source_system, document_type, category",
      )
      .eq("project_id", resolvedProjectId)
      .or(
        [
          "category.eq.specification",
          "document_type.ilike.%spec%",
          "title.ilike.%spec%",
          "title.ilike.%specification%",
          "title.ilike.%section%",
          "title.ilike.%division%",
        ].join(","),
      )
      .limit(Math.max(topK * 3, 18));

    if (candidateError) {
      throw new Error(
        `Specification document lookup failed: ${candidateError.message}`,
      );
    }

    const matchedSources = findStoredSpecDocumentMatches(
      ((candidateRows ?? []) as StoredSpecDocumentRow[]),
      query,
      Math.min(topK, 6),
    );

    if (matchedSources.length === 0) {
      return {
        sources: [],
        combinedText: "",
        note:
          "No project specification sources matched this query. Check the Specifications page or document ingestion status before relying on spec-backed review.",
      };
    }

    return {
      sources: matchedSources,
      combinedText: matchedSources
        .flatMap((source) => source.excerpts)
        .join("\n\n")
        .slice(0, 6000),
    };
  }

  return {
    // -----------------------------------------------------------------------
    // 1. getSubmittalLog
    // -----------------------------------------------------------------------
    getSubmittalLog: tool({
      description:
        "Fetch the submittal register for a project — what submittals are required, " +
        "submitted, approved, rejected, or missing. Use when asked about submittal " +
        "status, pipeline, or progress. Also use as the first step before " +
        "detectMissingSubmittals.",
      inputSchema: z.object({
        projectId: z.number().optional().describe("Project ID if known"),
        projectName: z
          .string()
          .optional()
          .describe("Project name to search for"),
        status: z
          .enum([
            "open",
            "submitted",
            "approved",
            "rejected",
            "draft",
            "distributed",
            "all",
          ])
          .optional()
          .default("all")
          .describe("Filter by status. Default: all"),
        specSection: z
          .string()
          .optional()
          .describe("Filter to a specific spec section, e.g. '08-1113'"),
      }),
      execute: withTrace(
        "getSubmittalLog",
        options,
        async ({ projectId, projectName, status, specSection }) => {
          const resolved = await resolveProject(
            supabase,
            guardrails,
            projectId,
            projectName,
          );
          if ("error" in resolved) return resolved;

          let query = supabase
            .from("submittals")
            .select(
              "id, submittal_number, title, specification_section, division, " +
                "submittal_type, status, priority, submission_date, " +
                "required_approval_date, final_due_date, ball_in_court, " +
                "submitter_company, revision",
            )
            .eq("project_id", resolved.id)
            .is("deleted_at", null)
            .order("specification_section", { ascending: true });

          if (status && status !== "all") {
            query = query.ilike("status", status);
          }
          if (specSection) {
            query = query.ilike("specification_section", `%${specSection}%`);
          }

          const { data: submittals, error } = await query.limit(200);
          if (error)
            return { error: `Failed to fetch submittals: ${error.message}` };

          const rows = (submittals ?? []) as unknown as AnyRow[];

          const byStatus: Record<string, AnyRow[]> = {};
          for (const row of rows) {
            const s = (row.status as string) ?? "unknown";
            byStatus[s] = byStatus[s] ?? [];
            byStatus[s].push(row);
          }

          const summary = Object.entries(byStatus).map(([s, items]) => ({
            status: s,
            count: items.length,
          }));

          const overdue = rows.filter((r) => {
            const due = r.final_due_date ?? r.required_approval_date;
            if (!due) return false;
            return (
              new Date(due as string) < new Date() && r.status !== "approved"
            );
          });

          return {
            project: { id: resolved.id, name: resolved.name },
            total: rows.length,
            summary,
            overdueCount: overdue.length,
            submittals: rows.map((r) => ({
              id: r.id,
              number: r.submittal_number,
              title: r.title,
              specSection: r.specification_section,
              division: r.division,
              type: r.submittal_type,
              status: r.status,
              priority: r.priority,
              ballInCourt: r.ball_in_court,
              submitter: r.submitter_company,
              submittedDate: r.submission_date,
              dueDate: r.final_due_date ?? r.required_approval_date,
              revision: r.revision,
            })),
          };
        },
      ),
    }),

    // -----------------------------------------------------------------------
    // 2. getSpecRequirements
    // -----------------------------------------------------------------------
    getSpecRequirements: tool({
      description:
        "Search project specification documents for requirements related to a trade, " +
        "product, or spec section. Returns structured requirements (material, manufacturer, " +
        "performance, documentation, code reference). Use when asked what the spec " +
        "requires for a given system or product, or before reviewing a submittal.",
      inputSchema: z.object({
        query: z
          .string()
          .describe(
            "What to search for, e.g. 'HVAC equipment requirements', " +
              "'fire sprinkler pipe material', 'Section 08-1113 doors'",
          ),
        projectId: z.number().optional().describe("Project ID to scope search"),
        projectName: z
          .string()
          .optional()
          .describe("Project name to search for"),
        topK: z
          .number()
          .optional()
          .default(12)
          .describe("Number of chunks to retrieve. Default 12."),
      }),
      execute: withTrace(
        "getSpecRequirements",
        options,
        async ({ query, projectId, projectName, topK }) => {
          let resolvedProjectId: number | undefined;
          if (projectId || projectName) {
            const resolved = await resolveProject(
              supabase,
              guardrails,
              projectId,
              projectName,
            );
            if (!("error" in resolved)) {
              resolvedProjectId = resolved.id;
            }
          }
          const result = await resolveSpecificationSources(
            query,
            resolvedProjectId,
            topK ?? 12,
          );

          return {
            query,
            projectId: resolvedProjectId,
            totalChunks: result.sources.reduce(
              (count, source) => count + source.excerptCount,
              0,
            ),
            sources: result.sources,
            combinedText: result.combinedText,
            note: result.note,
          };
        },
      ),
    }),

    // -----------------------------------------------------------------------
    // 3. detectMissingSubmittals
    // -----------------------------------------------------------------------
    detectMissingSubmittals: tool({
      description:
        "Cross-reference the submittal register against what the project scope and " +
        "spec documents suggest is needed. Returns submittals that appear to be " +
        "missing or incomplete. Use when asked 'what submittals are we missing?' or " +
        "'is our submittal log complete?'",
      inputSchema: z.object({
        projectId: z.number().optional().describe("Project ID if known"),
        projectName: z
          .string()
          .optional()
          .describe("Project name to search for"),
      }),
      execute: withTrace(
        "detectMissingSubmittals",
        options,
        async ({ projectId, projectName }) => {
          const resolved = await resolveProject(
            supabase,
            guardrails,
            projectId,
            projectName,
          );
          if ("error" in resolved) return resolved;

          // Fetch existing submittals
          const { data: submittals, error: subError } = await supabase
            .from("submittals")
            .select("id, title, specification_section, status, division")
            .eq("project_id", resolved.id)
            .is("deleted_at", null);

          if (subError)
            return { error: `Failed to fetch submittals: ${subError.message}` };

          const rows = (submittals ?? []) as unknown as AnyRow[];
          const existingSections = new Set(
            rows
              .map((r) =>
                (r.specification_section as string | null)?.toLowerCase(),
              )
              .filter(Boolean),
          );

          const totalSubmittals = rows.length;
          const withSection = rows.filter(
            (r) => r.specification_section,
          ).length;
          const withoutSection = totalSubmittals - withSection;

          const statusBreakdown: Record<string, number> = {};
          for (const r of rows) {
            const s = (r.status as string) ?? "unknown";
            statusBreakdown[s] = (statusBreakdown[s] ?? 0) + 1;
          }

          const overdue = rows.filter((r) => {
            if (r.status === "approved" || r.status === "distributed")
              return false;
            // No due date data in this query — flag open/draft items as watch
            return r.status === "open" || r.status === "draft";
          });

          return {
            project: { id: resolved.id, name: resolved.name },
            summary: {
              totalSubmittals,
              withSpecSection: withSection,
              withoutSpecSection: withoutSection,
              statusBreakdown,
              overdueOrOpenCount: overdue.length,
            },
            missingSpecSections:
              withoutSection > 0
                ? "Some submittals have no spec section assigned — they cannot be " +
                  "cross-referenced against drawings or specs until sections are added."
                : null,
            existingSections: Array.from(existingSections).sort(),
            recommendations: [
              totalSubmittals < 5
                ? "Submittal register appears sparse. Verify all required submittals " +
                  "have been logged. Cross-reference against the spec table of contents."
                : null,
              withoutSection > 0
                ? `${withoutSection} submittal(s) are missing spec section numbers — ` +
                  "assign sections so they can be tracked against spec requirements."
                : null,
              overdue.length > 0
                ? `${overdue.length} submittal(s) are open or in draft — ` +
                  "confirm these are actively being processed."
                : null,
            ].filter(Boolean),
          };
        },
      ),
    }),

    // -----------------------------------------------------------------------
    // 4. reviewSubmittalAgainstDrawings
    // -----------------------------------------------------------------------
    reviewSubmittalAgainstDrawings: tool({
      description:
        "Compare a submittal's documents against the project drawings to identify conflicts, " +
        "missing information, or compliance issues. Fetches the submittal details and linked " +
        "drawings, retrieves vectorized content from both, and returns a structured comparison. " +
        "Use when asked to review a submittal, check if a submittal matches the drawings, or " +
        "identify what drawing packages are needed for a spec section.",
      inputSchema: z.object({
        submittalId: z
          .string()
          .optional()
          .describe("UUID of the submittal to review"),
        submittalNumber: z
          .string()
          .optional()
          .describe("Submittal number (e.g. '001', 'MECH-003') — used to look up submittalId"),
        projectId: z
          .number()
          .optional()
          .describe("Project ID — required if submittalId is not provided"),
        projectName: z
          .string()
          .optional()
          .describe("Project name — used to resolve projectId if not provided"),
        focusArea: z
          .string()
          .optional()
          .describe(
            "Specific area to focus the comparison on, e.g. 'rebar size', 'fire rating', " +
            "'dimensions'. Leave blank for a full review.",
          ),
      }),
      execute: withTrace(
        "reviewSubmittalAgainstDrawings",
        options,
        async ({ submittalId, submittalNumber, projectId, projectName, focusArea }) => {
          // ── 1. Resolve project ──────────────────────────────────────────────
          let resolvedProjectId: number | undefined;
          if (projectId || projectName) {
            const resolved = await resolveProject(
              supabase,
              guardrails,
              projectId,
              projectName,
            );
            if ("error" in resolved) return resolved;
            resolvedProjectId = resolved.id;
          }

          // ── 2. Resolve submittal ────────────────────────────────────────────
          let resolvedSubmittalId = submittalId;
          if (!resolvedSubmittalId) {
            if (!submittalNumber) {
              return {
                error: "Provide either submittalId or submittalNumber to identify the submittal.",
              };
            }
            if (resolvedProjectId === undefined) {
              return {
                error:
                  "Provide projectId or projectName to look up a submittal by number.",
              };
            }
            const lookupResp = await supabase
              .from("submittals")
              .select("id, title, status, submittal_number, description")
              .eq("project_id", resolvedProjectId)
              .ilike("submittal_number", `%${submittalNumber}%`)
              .limit(1)
              .single();
            if (!lookupResp.data) {
              return {
                error: `No submittal found matching number "${submittalNumber}" on project ${resolvedProjectId}.`,
              };
            }
            resolvedSubmittalId = lookupResp.data.id;
          }

          // ── 3. Fetch submittal details ──────────────────────────────────────
          const submittalResp = await supabase
            .from("submittals")
            .select(
              "id, title, submittal_number, status, description, submittal_type_id, specification_section_id, submission_date, required_approval_date, priority, specification_section, submittal_type",
            )
            .eq("id", resolvedSubmittalId)
            .single();
          const submittal = submittalResp.data;
          if (!submittal) {
            return { error: `Submittal ${resolvedSubmittalId} not found.` };
          }

          // ── 4. Fetch submittal documents (extracted text from uploaded files) ─
          // submittal_doc_links → document_metadata/RAG content
          const docLinksResp = await supabase
            .from("submittal_doc_links")
            .select("document_metadata_id")
            .eq("submittal_id", resolvedSubmittalId);
          const docLinkMetaIds = (docLinksResp.data ?? []).map(
            (r) => (r as unknown as { document_metadata_id: string }).document_metadata_id,
          );

          const submittalDocs: Array<{
            document_name: string;
            extracted_text: string | null;
            document_type?: string | null;
            page_count?: number | null;
          }> = [];

          if (docLinkMetaIds.length > 0) {
            for (const metaId of docLinkMetaIds) {
              // Primary: vision page summaries (GPT-4o extracted clean prose)
              const visionResp = await supabase
                .from("document_page_intelligence")
                .select("page_number, sheet_number, sheet_title, ai_summary, implied_submittals, notes_and_requirements")
                .eq("document_metadata_id", metaId)
                .order("page_number", { ascending: true });
              const visionPages = visionResp.data ?? [];
              if (visionPages.length > 0) {
                const combined = visionPages
                  .filter((p) => p.ai_summary)
                  .map((p) => {
                    const header = [p.sheet_number, p.sheet_title].filter(Boolean).join(" — ");
                    return header ? `[${header}]\n${p.ai_summary}` : String(p.ai_summary);
                  })
                  .join("\n\n");
                if (combined.trim()) {
                  submittalDocs.push({ document_name: "Submittal Attachment", extracted_text: combined });
                  continue;
                }
              }

              // Fallback 1: RAG chunks (vision embeddings or OCR chunks)
              const chunksResp = await ragSupabase
                .from("document_chunks")
                .select("text, chunk_index")
                .eq("document_id", metaId)
                .order("chunk_index", { ascending: true })
                .limit(10);
              if ((chunksResp.data ?? []).length > 0) {
                const combined = (chunksResp.data ?? [])
                  .map((c) => (c.text as string).substring(0, 600))
                  .join("\n\n");
                submittalDocs.push({ document_name: "Submittal Attachment", extracted_text: combined });
                continue;
              }

              // Fallback 2: OCR text from RAG metadata.
              const metaResp = await ragSupabase
                .from("rag_document_metadata")
                .select("title, content")
                .eq("id", metaId)
                .maybeSingle();
              const text = (metaResp.data?.content as string | null)?.trim();
              if (text) {
                submittalDocs.push({
                  document_name: (metaResp.data?.title as string) ?? "Attachment",
                  extracted_text: text,
                });
              }
            }
          }

          // ── 5. Fetch linked drawings via submittal_linked_drawings ──────────
          const linkedDrawingsResp = await supabase
            .from("submittal_linked_drawings")
            .select(
              "drawing_id, drawings!inner(id, title, drawing_number, drawing_type, " +
              "discipline, document_metadata_id)",
            )
            .eq("submittal_id", resolvedSubmittalId);
          let linkedDrawings = (linkedDrawingsResp.data ?? []).map(
            (r) => (r as unknown as { drawing_id: string; drawings: AnyRow }).drawings,
          );
          let drawingsWereAutoMatched = false;

          // ── 5b. Auto-match drawings when none are manually linked ─────────
          // Infer relevant drawings from the submittal's spec section, division,
          // submittal type, and title keywords — so the review works without any
          // manual setup.
          if (linkedDrawings.length === 0 && resolvedProjectId) {
            const specSection = (submittal.specification_section as string | null)?.trim() ?? "";

            // Map CSI division prefix → drawing discipline keyword
            const DIVISION_TO_DISCIPLINE: Record<string, string> = {
              "01": "general",
              "02": "civil",
              "03": "structural",
              "04": "structural",
              "05": "structural",
              "06": "architectural",
              "07": "architectural",
              "08": "architectural",
              "09": "architectural",
              "10": "architectural",
              "21": "fire",
              "22": "plumbing",
              "23": "mechanical",
              "25": "electrical",
              "26": "electrical",
              "27": "electrical",
              "28": "electrical",
              "31": "civil",
              "32": "civil",
              "33": "civil",
            };

            // CSI spec section format: "03 30 00" → division prefix "03"
            const divPrefix = specSection.replace(/\s/g, "").slice(0, 2);
            const inferredDiscipline = DIVISION_TO_DISCIPLINE[divPrefix] ?? null;

            // Pull project drawings — prefer those with OCR text, filter by discipline
            let drawingsQuery = supabase
              .from("drawings")
              .select("id, title, drawing_number, drawing_type, discipline, document_metadata_id")
              .eq("project_id", resolvedProjectId)
              .eq("is_obsolete", false)
              .not("document_metadata_id", "is", null);

            if (inferredDiscipline) {
              drawingsQuery = drawingsQuery.ilike("discipline", `%${inferredDiscipline}%`);
            }

            const { data: candidateDrawings } = await drawingsQuery.limit(30);
            let candidates = candidateDrawings ?? [];

            // If discipline filter returned nothing, fall back to all drawings with OCR text
            if (candidates.length === 0) {
              const { data: fallback } = await supabase
                .from("drawings")
                .select("id, title, drawing_number, drawing_type, discipline, document_metadata_id")
                .eq("project_id", resolvedProjectId)
                .eq("is_obsolete", false)
                .not("document_metadata_id", "is", null)
                .limit(30);
              candidates = fallback ?? [];
            }

            // Score by keyword overlap between submittal title/description and drawing titles
            const submittalWords = new Set(
              `${submittal.title ?? ""} ${submittal.description ?? ""} ${submittal.submittal_type ?? ""}`
                .toLowerCase()
                .split(/\W+/)
                .filter((w) => w.length > 3),
            );

            const scored = candidates.map((d) => {
              const drawingWords = (d.title as string ?? "").toLowerCase().split(/\W+/);
              const overlap = drawingWords.filter((w) => submittalWords.has(w)).length;
              return { drawing: d, score: overlap };
            });

            scored.sort((a, b) => b.score - a.score);
            linkedDrawings = scored.slice(0, 8).map((s) => s.drawing as AnyRow);
            drawingsWereAutoMatched = linkedDrawings.length > 0;
          }

          // ── 6. Pull vectorized content for each linked drawing ──────────────
          const drawingContents: Array<{
            drawingNumber: string;
            title: string;
            discipline: string | null;
            textExcerpts: string[];
          }> = [];

          for (const drawing of linkedDrawings) {
            const metaId = drawing.document_metadata_id as string | null;
            if (!metaId) continue;

            const excerpts: string[] = [];

            // Primary: vision page summaries (GPT-4o extracted, spatially aware)
            const drawVisionResp = await supabase
              .from("document_page_intelligence")
              .select("page_number, sheet_number, sheet_title, ai_summary, implied_submittals, notes_and_requirements")
              .eq("document_metadata_id", metaId)
              .order("page_number", { ascending: true });
            for (const p of drawVisionResp.data ?? []) {
              if (!p.ai_summary) continue;
              const header = [p.sheet_number, p.sheet_title].filter(Boolean).join(" — ");
              const extra = [
                ...(p.implied_submittals as string[] ?? []).map((s: string) => `Required submittal: ${s}`),
                ...(p.notes_and_requirements as string[] ?? []).slice(0, 3),
              ].join("; ");
              excerpts.push(
                [header ? `[${header}]` : null, p.ai_summary, extra || null]
                  .filter(Boolean)
                  .join("\n") as string
              );
            }

            // Fallback 1: RAG DB chunks (post-embedding)
            if (excerpts.length === 0) {
              const chunksResp = await ragSupabase
                .from("document_chunks")
                .select("text, chunk_index")
                .eq("document_id", metaId)
                .order("chunk_index", { ascending: true })
                .limit(8);
              excerpts.push(
                ...(chunksResp.data ?? []).map((c) => (c.text as string).substring(0, 600))
              );
            }

            // Fallback 2: OCR text from RAG metadata.
            if (excerpts.length === 0) {
              const dmResp = await ragSupabase
                .from("rag_document_metadata")
                .select("content, embedding_status")
                .eq("id", metaId)
                .in("embedding_status", ["embedded", "skipped_low_content"])
                .maybeSingle();
              const rawText = (dmResp.data?.content as string | null) ?? "";
              if (rawText.trim()) {
                const CHUNK = 600;
                const cap = Math.min(rawText.length, CHUNK * 8);
                for (let i = 0; i < cap; i += CHUNK) {
                  excerpts.push(rawText.substring(i, i + CHUNK));
                }
              }
            }

            if (excerpts.length > 0) {
              drawingContents.push({
                drawingNumber: drawing.drawing_number as string,
                title: drawing.title as string,
                discipline: drawing.discipline as string | null,
                textExcerpts: excerpts,
              });
            }
          }

          // ── 7. Semantic search: find additional drawing chunks relevant to this submittal ──
          const searchQuery = [
            submittal.title,
            submittal.description ?? "",
            focusArea ?? "",
          ]
            .filter(Boolean)
            .join(" ");

          const additionalChunks: Array<{ title: string; excerpt: string }> = [];
          if (searchQuery.trim()) {
            try {
              const openai = ctx.openai;
              const queryEmbedding = await generateEmbedding(
                openai,
                searchQuery,
                EMBEDDING.LARGE,
              );
              const vectorResp = await ragSupabase.rpc("search_document_chunks", {
                query_embedding: queryEmbedding,
                match_count: 8,
                filter_project_id: resolvedProjectId,
              });
              for (const chunk of vectorResp.data ?? []) {
                const metadata = (chunk.doc_metadata ?? {}) as unknown as AnyRow;
                if (
                  (metadata.document_type as string | null) === "drawing" ||
                  (metadata.type as string | null) === "document"
                ) {
                  additionalChunks.push({
                    title:
                      (metadata.title as string | null) ??
                      (chunk.doc_title as string | null) ??
                      "Drawing",
                    excerpt: ((chunk.chunk_text as string) ?? "").substring(0, 500),
                  });
                }
              }
            } catch (error) {
              console.error("[document-intelligence] drawing vector search failed", {
                projectId: resolvedProjectId,
                tool: "reviewSubmittalAgainstDrawings",
                error: error instanceof Error ? error.message : String(error),
              });
            }
          }

          // ── 8. Build comparison context ─────────────────────────────────────
          const submittalTextSummary = submittalDocs
            .map((d) => `[${d.document_name}]\n${(d.extracted_text as string).substring(0, 800)}`)
            .join("\n\n");

          const drawingTextSummary = drawingContents
            .map(
              (d) =>
                `[Drawing ${d.drawingNumber}: ${d.title}${d.discipline ? ` (${d.discipline})` : ""}]\n` +
                d.textExcerpts.join("\n"),
            )
            .join("\n\n");

          const hasSubmittalText = submittalTextSummary.trim().length > 0;
          const hasDrawingText = drawingTextSummary.trim().length > 0;

          return {
            submittal: {
              id: submittal.id,
              number: submittal.submittal_number,
              title: submittal.title,
              status: submittal.status,
              priority: submittal.priority,
              submissionDate: submittal.submission_date,
              requiredApprovalDate: submittal.required_approval_date,
            },
            linkedDrawings: linkedDrawings.map((d) => ({
              drawingNumber: d.drawing_number as string,
              title: d.title as string,
              discipline: d.discipline as string | null,
              hasVectorizedContent:
                drawingContents.some((c) => c.drawingNumber === (d.drawing_number as string)),
            })),
            drawingsWereAutoMatched,
            submittalDocuments: submittalDocs.map((d) => ({
              name: d.document_name,
              type: d.document_type,
              pages: d.page_count,
              hasText: Boolean(d.extracted_text),
            })),
            comparisonContext: {
              submittalText: hasSubmittalText
                ? submittalTextSummary.substring(0, 3000)
                : null,
              drawingText: hasDrawingText
                ? drawingTextSummary.substring(0, 3000)
                : null,
              additionalRelevantDrawingChunks: additionalChunks,
              focusArea: focusArea ?? null,
            },
            readiness: {
              canCompare: hasSubmittalText && hasDrawingText,
              missingSubmittalText: !hasSubmittalText
                ? "No extracted text found in submittal documents. The submittal PDFs may " +
                  "not be uploaded or text extraction has not run yet."
                : null,
              missingDrawingText: !hasDrawingText
                ? linkedDrawings.length === 0
                  ? "No drawings with OCR text found for this project. Upload drawings to the " +
                    "project first — OCR runs automatically within 30 minutes of upload."
                  : "Matched drawings have no OCR text yet. OCR runs automatically within 30 minutes of upload."
                : null,
            },
            nextStep: hasSubmittalText && hasDrawingText
              ? focusArea
                ? `Compare the submittal text against the drawing text, focusing on "${focusArea}". ` +
                  "Identify any conflicts, missing specs, or dimension mismatches."
                : "Analyze the submittal text against the drawing excerpts. Identify: " +
                  "(1) items in the submittal not covered by the drawings, " +
                  "(2) drawing requirements not addressed by the submittal, " +
                  "(3) any explicit conflicts in dimensions, materials, or specs."
              : "Resolve the missing content issues above before comparison can proceed.",
          };
        },
      ),
    }),

    // -----------------------------------------------------------------------
    // 5. identifySubmittalPackages
    // -----------------------------------------------------------------------
    identifySubmittalPackages: tool({
      description:
        "Identify what submittal packages are required for a given spec section or drawing. " +
        "Cross-references spec sections against existing submittals and linked drawings to " +
        "surface what's covered, what's missing, and what drawing packages still need submittals. " +
        "Use when asked 'what submittals do we need for section X', 'what's missing from the " +
        "submittal log for this drawing', or 'identify required submittal packages'.",
      inputSchema: z.object({
        projectId: z.number().optional().describe("Project ID if known"),
        projectName: z.string().optional().describe("Project name to resolve projectId"),
        specSectionNumber: z
          .string()
          .optional()
          .describe("Spec section number to look up, e.g. '03300', '05120', '09900'"),
        drawingId: z
          .string()
          .optional()
          .describe("Drawing UUID — find submittals needed for this specific drawing"),
        drawingNumber: z
          .string()
          .optional()
          .describe("Drawing number, e.g. 'S-101' — resolved to drawingId automatically"),
        discipline: z
          .string()
          .optional()
          .describe(
            "Filter by discipline, e.g. 'Structural', 'Mechanical', 'Electrical'. " +
            "Used when no spec section or drawing is provided.",
          ),
      }),
      execute: withTrace(
        "identifySubmittalPackages",
        options,
        async ({
          projectId,
          projectName,
          specSectionNumber,
          drawingId,
          drawingNumber,
          discipline,
        }) => {
          const resolved = await resolveProject(
            supabase,
            guardrails,
            projectId,
            projectName,
          );
          if ("error" in resolved) return resolved;
          const resolvedProjectId = resolved.id;

          // ── Resolve drawing by number if needed ─────────────────────────────
          let resolvedDrawingId = drawingId;
          if (!resolvedDrawingId && drawingNumber) {
            const dwgResp = await supabase
              .from("drawings")
              .select("id, title, drawing_number, discipline, drawing_type")
              .eq("project_id", resolvedProjectId)
              .ilike("drawing_number", `%${drawingNumber}%`)
              .is("deleted_at", null)
              .limit(1)
              .single();
            resolvedDrawingId = dwgResp.data?.id ?? undefined;
          }

          // ── Path A: spec section lookup ──────────────────────────────────────
          if (specSectionNumber) {
            const specResp = await supabase
              .from("specification_sections")
              .select(
                "id, section_number, title, division, requirements, specification_type, status",
              )
              .eq("project_id", resolvedProjectId)
              .ilike("section_number", `%${specSectionNumber}%`)
              .limit(5);
            const specs = specResp.data ?? [];

            if (specs.length === 0) {
              return {
                error: `No spec section matching "${specSectionNumber}" found on this project.`,
                hint: "Check the Specifications page to confirm the section exists and is uploaded.",
              };
            }

            // For each matching spec, get: submittals + linked drawings
            const results = await Promise.all(
              specs.map(async (spec) => {
                const [submittalsResp, linkedDrawingsResp] = await Promise.all([
                  supabase
                    .from("submittals")
                    .select(
                      "id, submittal_number, title, status, priority, submittal_type, submittal_package_id, submission_date, required_approval_date",
                    )
                    .eq("project_id", resolvedProjectId)
                    .eq("specification_section_id", spec.id)
                    .is("deleted_at", null)
                    .order("submittal_number"),
                  supabase
                    .from("spec_drawing_links")
                    .select(
                      "drawing_id, link_method, confidence, " +
                      "drawings!inner(id, drawing_number, title, discipline, " +
                      "drawing_type, document_metadata_id)",
                    )
                    .eq("specification_section_id", spec.id),
                ]);

                const submittals = submittalsResp.data ?? [];
                const linkedDrawings = (linkedDrawingsResp.data ?? []).map(
                  (r) => (r as unknown as { drawing_id: string; drawings: AnyRow }).drawings,
                );

                const statusGroups = {
                  approved: submittals.filter((s) => s.status === "approved"),
                  under_review: submittals.filter((s) =>
                    ["submitted", "under_review"].includes(s.status ?? ""),
                  ),
                  draft_or_open: submittals.filter((s) =>
                    ["draft", "open", null].includes(s.status ?? null),
                  ),
                  rejected: submittals.filter((s) =>
                    ["rejected", "requires_revision"].includes(s.status ?? ""),
                  ),
                };

                return {
                  spec: {
                    id: spec.id,
                    sectionNumber: spec.section_number,
                    title: spec.title,
                    division: spec.division,
                    status: spec.status,
                    requirementCount: Array.isArray(spec.requirements)
                      ? (spec.requirements as unknown[]).length
                      : null,
                  },
                  submittals: {
                    total: submittals.length,
                    byStatus: {
                      approved: statusGroups.approved.length,
                      underReview: statusGroups.under_review.length,
                      draftOrOpen: statusGroups.draft_or_open.length,
                      rejected: statusGroups.rejected.length,
                    },
                    items: submittals.map((s) => ({
                      number: s.submittal_number,
                      title: s.title,
                      status: s.status,
                      priority: s.priority,
                      type: s.submittal_type,
                      dueDate: s.required_approval_date,
                    })),
                  },
                  linkedDrawings: linkedDrawings.map((d) => ({
                    drawingNumber: d.drawing_number as string,
                    title: d.title as string,
                    discipline: d.discipline as string | null,
                    hasVectorizedContent: Boolean(d.document_metadata_id),
                  })),
                  gaps: {
                    noSubmittals: submittals.length === 0,
                    noLinkedDrawings: linkedDrawings.length === 0,
                    openOrRejected:
                      statusGroups.draft_or_open.length +
                      statusGroups.rejected.length,
                  },
                };
              }),
            );

            const totalGaps = results.reduce(
              (acc, r) =>
                acc +
                (r.gaps.noSubmittals ? 1 : 0) +
                r.gaps.openOrRejected,
              0,
            );

            return {
              query: { type: "spec_section", value: specSectionNumber },
              projectId: resolvedProjectId,
              results,
              summary: {
                specsFound: results.length,
                totalSubmittals: results.reduce((a, r) => a + r.submittals.total, 0),
                totalLinkedDrawings: results.reduce(
                  (a, r) => a + r.linkedDrawings.length,
                  0,
                ),
                gaps: totalGaps,
              },
              nextStep:
                results.some((r) => r.gaps.noLinkedDrawings)
                  ? "Some spec sections have no linked drawings. Use the Drawings page to " +
                    "link drawings to spec sections, or ask me to suggest links based on " +
                    "discipline and drawing titles."
                  : results.some((r) => r.gaps.noSubmittals)
                  ? "Some spec sections have linked drawings but no submittals. " +
                    "These are likely missing submittal packages — I can help create them."
                  : "All spec sections have submittals. Review open/rejected items above " +
                    "for action items.",
            };
          }

          // ── Path B: drawing lookup ───────────────────────────────────────────
          if (resolvedDrawingId) {
            const [drawingResp, specLinksResp] = await Promise.all([
              supabase
                .from("drawings")
                .select(
                  "id, drawing_number, title, discipline, drawing_type, document_metadata_id, is_published",
                )
                .eq("id", resolvedDrawingId)
                .single(),
              supabase
                .from("spec_drawing_links")
                .select(
                  "specification_section_id, link_method, confidence, " +
                  "specification_sections!inner(id, section_number, title, division)",
                )
                .eq("drawing_id", resolvedDrawingId),
            ]);

            const drawing = drawingResp.data;
            if (!drawing) {
              return { error: `Drawing ${resolvedDrawingId} not found.` };
            }

            const specLinks = (specLinksResp.data ?? []).map(
              (r) =>
                (r as unknown as { specification_section_id: number; specification_sections: AnyRow })
                  .specification_sections,
            );

            // For each linked spec, get submittal coverage
            const specCoverage = await Promise.all(
              specLinks.map(async (spec) => {
                const subResp = await supabase
                  .from("submittals")
                  .select("id, submittal_number, title, status, submittal_type")
                  .eq("project_id", resolvedProjectId)
                  .eq("specification_section_id", spec.id as number)
                  .is("deleted_at", null);
                return {
                  sectionNumber: spec.section_number as string,
                  title: spec.title as string,
                  division: spec.division as string | null,
                  submittals: (subResp.data ?? []).map((s) => ({
                    number: s.submittal_number,
                    title: s.title,
                    status: s.status,
                    type: s.submittal_type,
                  })),
                  hasSubmittals: (subResp.data ?? []).length > 0,
                };
              }),
            );

            const missingSpecLinks = specLinks.length === 0;
            const sectionsWithoutSubmittals = specCoverage.filter(
              (s) => !s.hasSubmittals,
            );

            return {
              query: { type: "drawing", value: drawingNumber ?? resolvedDrawingId },
              drawing: {
                id: drawing.id,
                number: drawing.drawing_number,
                title: drawing.title,
                discipline: drawing.discipline,
                type: drawing.drawing_type,
                isPublished: drawing.is_published,
                hasVectorizedContent: Boolean(drawing.document_metadata_id),
              },
              linkedSpecSections: specCoverage,
              gaps: {
                noSpecLinks: missingSpecLinks,
                sectionsWithoutSubmittals: sectionsWithoutSubmittals.map(
                  (s) => s.sectionNumber,
                ),
              },
              nextStep: missingSpecLinks
                ? "This drawing has no linked spec sections. Link it to the relevant " +
                  "spec sections so the AI can cross-reference submittals. " +
                  "Alternatively, ask me to suggest spec sections based on the drawing " +
                  "discipline and title."
                : sectionsWithoutSubmittals.length > 0
                ? `Spec section(s) ${sectionsWithoutSubmittals.map((s) => s.sectionNumber).join(", ")} ` +
                  "are linked to this drawing but have no submittals. These submittal " +
                  "packages are likely missing and should be created."
                : "All linked spec sections have submittal coverage. Review statuses above.",
            };
          }

          // ── Path C: discipline-wide scan ────────────────────────────────────
          const drawingsQuery = supabase
            .from("drawings")
            .select(
              "id, drawing_number, title, discipline, drawing_type, document_metadata_id",
            )
            .eq("project_id", resolvedProjectId)
            .is("deleted_at", null)
            .is("is_obsolete", false)
            .order("drawing_number")
            .limit(50);

          if (discipline) {
            drawingsQuery.ilike("discipline", `%${discipline}%`);
          }

          const allDrawingsResp = await drawingsQuery;
          const allDrawings = allDrawingsResp.data ?? [];

          // Check which drawings have spec links
          const drawingIds = allDrawings.map((d) => d.id);
          const linkedIdsResp =
            drawingIds.length > 0
              ? await supabase
                  .from("spec_drawing_links")
                  .select("drawing_id")
                  .in("drawing_id", drawingIds)
              : { data: [] };

          const linkedDrawingIds = new Set(
            (linkedIdsResp.data ?? []).map((r) => r.drawing_id),
          );

          const withLinks = allDrawings.filter((d) => linkedDrawingIds.has(d.id));
          const withoutLinks = allDrawings.filter(
            (d) => !linkedDrawingIds.has(d.id),
          );
          const withoutVectorContent = allDrawings.filter(
            (d) => !d.document_metadata_id,
          );

          return {
            query: {
              type: "discipline_scan",
              value: discipline ?? "all",
            },
            projectId: resolvedProjectId,
            summary: {
              totalDrawings: allDrawings.length,
              withSpecLinks: withLinks.length,
              withoutSpecLinks: withoutLinks.length,
              withoutVectorContent: withoutVectorContent.length,
            },
            drawingsWithoutSpecLinks: withoutLinks.slice(0, 20).map((d) => ({
              drawingNumber: d.drawing_number,
              title: d.title,
              discipline: d.discipline,
            })),
            drawingsWithoutVectorContent: withoutVectorContent.slice(0, 10).map(
              (d) => ({
                drawingNumber: d.drawing_number,
                title: d.title,
                discipline: d.discipline,
              }),
            ),
            nextStep:
              withoutLinks.length > 0
                ? `${withoutLinks.length} drawing(s) have no spec section links. ` +
                  "Provide a spec section number or drawing number for a detailed " +
                  "submittal gap analysis."
                : "All drawings are linked to spec sections. Provide a spec section " +
                  "number for a detailed submittal coverage report.",
          };
        },
      ),
    }),

    // -----------------------------------------------------------------------
    // 6. logFeedback
    // -----------------------------------------------------------------------
    logFeedback: tool({
      description:
        "Record a human correction or validation of an AI document review finding. " +
        "Use when the user says 'that finding was wrong', 'that's correct', or wants " +
        "to annotate an AI review result. This feeds the learning loop.",
      inputSchema: z.object({
        reviewType: z
          .enum([
            "submittal_review",
            "spec_comparison",
            "drawing_check",
            "change_detection",
          ])
          .describe("What type of review this feedback is for"),
        aiFinding: z
          .string()
          .describe("The AI finding being corrected or validated"),
        aiStatus: z
          .enum(["Match", "Missing", "Conflict", "Unclear", "Not Applicable"])
          .describe("The status the AI assigned"),
        feedbackCategory: z
          .enum([
            "correct",
            "missed_requirement",
            "wrong_document_match",
            "bad_interpretation",
            "hallucinated_issue",
            "too_vague",
            "useful_low_priority",
            "needs_expert_review",
          ])
          .describe("How to categorize this feedback"),
        projectId: z.number().optional().describe("Project ID if known"),
        documentId: z.string().optional().describe("Document or submittal ID"),
        specSection: z
          .string()
          .optional()
          .describe("Spec section this finding relates to"),
        requirementType: z
          .enum(REQUIREMENT_TYPES)
          .optional()
          .describe("Type of requirement"),
        correctedStatus: z
          .string()
          .optional()
          .describe("What the status should have been"),
        correctedReason: z.string().optional().describe("Why the AI was wrong"),
        sourceOfTruthRef: z
          .string()
          .optional()
          .describe(
            "The document/section that settles this (e.g. 'Spec Section 15100, page 4')",
          ),
      }),
      execute: withTrace(
        "logFeedback",
        options,
        async ({
          reviewType,
          aiFinding,
          aiStatus,
          feedbackCategory,
          projectId,
          documentId,
          specSection,
          requirementType,
          correctedStatus,
          correctedReason,
          sourceOfTruthRef,
        }) => {
          const { data, error } = await supabase
            .from("ai_review_feedback")
            .insert({
              project_id: projectId ?? null,
              document_id: documentId ?? null,
              review_type: reviewType,
              ai_finding: aiFinding,
              ai_status: aiStatus,
              feedback_category: feedbackCategory,
              spec_section: specSection ?? null,
              requirement_type: requirementType ?? null,
              corrected_status: correctedStatus ?? null,
              corrected_reason: correctedReason ?? null,
              source_of_truth_ref: sourceOfTruthRef ?? null,
              created_by: userId,
            })
            .select("id")
            .single();

          if (error)
            return { error: `Failed to log feedback: ${error.message}` };

          const feedbackId = (data as AnyRow).id as string;

          // Close the learning loop: turn a correction into a durable agent
          // learning so future reviews are prompted to avoid the same mistake.
          // Positive signals are skipped inside the ingest function. Failure here
          // must not fail the feedback write itself.
          if (feedbackCategory !== "correct") {
            try {
              await ingestSubmittalReviewCorrectionLearning({
                reviewType,
                aiFinding,
                aiStatus,
                feedbackCategory,
                specSection,
                requirementType,
                correctedStatus,
                correctedReason,
                sourceOfTruthRef,
                projectId: projectId ?? null,
                feedbackId,
              });
            } catch (learningError) {
              console.warn(
                "[document-intelligence] failed to ingest submittal-review learning:",
                learningError instanceof Error
                  ? learningError.message
                  : learningError,
              );
            }
          }

          return {
            success: true,
            feedbackId,
            message:
              feedbackCategory === "correct"
                ? "Confirmed — logged as correct. This reinforces the detection pattern."
                : `Logged as '${feedbackCategory}'. This correction will improve future reviews.`,
          };
        },
      ),
    }),

    // -----------------------------------------------------------------------
    // 5. reviewDocument (stub — Phase 2 will call the Document Intelligence Agent)
    // -----------------------------------------------------------------------
    reviewDocument: tool({
      description:
        "Request a structured pre-review of a submittal document against project " +
        "spec requirements. Returns a requirements matrix comparing what the spec " +
        "requires against what the submittal provides. Use when asked to 'review this " +
        "submittal', 'check this against the spec', or 'pre-review this document'.",
      inputSchema: z.object({
        projectId: z.number().optional().describe("Project ID"),
        projectName: z.string().optional().describe("Project name"),
        submittalId: z
          .string()
          .optional()
          .describe("Existing submittal record ID to review"),
        specSections: z
          .array(z.string())
          .optional()
          .describe(
            "Specific spec sections to compare against, e.g. ['08-1113', '15100']",
          ),
        focusArea: z
          .string()
          .optional()
          .describe(
            "What to focus the review on, e.g. 'pipe material requirements'",
          ),
      }),
      execute: withTrace(
        "reviewDocument",
        options,
        async ({
          projectId,
          projectName,
          submittalId,
          specSections,
          focusArea,
        }) => {
          let resolvedId: number | undefined;
          if (projectId || projectName) {
            const resolved = await resolveProject(
              supabase,
              guardrails,
              projectId,
              projectName,
            );
            if (!("error" in resolved)) resolvedId = resolved.id;
          }

          // If a submittal ID is provided, fetch its details
          let submittalInfo: AnyRow | null = null;
          if (submittalId) {
            const { data } = await supabase
              .from("submittals")
              .select(
                "id, title, specification_section, division, status, description",
              )
              .eq("id", submittalId)
              .single();
            submittalInfo = data as AnyRow | null;
          }

          // Phase 1 stub: explain what the full review will do and surface
          // what spec content is available to compare against.
          const specQuery =
            focusArea ??
            (submittalInfo
              ? `${submittalInfo.title} ${submittalInfo.specification_section ?? ""}`
              : (specSections?.join(" ") ?? "submittal requirements"));

          const specResult = await resolveSpecificationSources(
            specQuery,
            resolvedId,
            8,
          );

          return {
            status: "phase_1_stub",
            message:
              "Full Document Intelligence Agent (Phase 2) is not yet deployed. " +
              "Here is the available spec content for this review:",
            submittal: submittalInfo
              ? {
                  id: submittalInfo.id,
                  title: submittalInfo.title,
                  specSection: submittalInfo.specification_section,
                  currentStatus: submittalInfo.status,
                }
              : null,
            specContentAvailable: specResult.sources.length > 0,
            specChunksFound: specResult.sources.reduce(
              (count, source) => count + source.excerptCount,
              0,
            ),
            specExcerpts: specResult.sources.slice(0, 3).flatMap((source) =>
              source.excerpts.slice(0, 1).map((excerpt) => ({
                source: source.title,
                text: excerpt.substring(0, 400),
              })),
            ),
            note: specResult.note,
            nextStep:
              specResult.sources.length > 0
                ? "Use the excerpts above as a starting point for a deeper submittal-to-spec review."
                : "No matching specification sources are currently available for this project-scoped review. Verify spec ingestion or link the canonical project specification section.",
          };
        },
      ),
    }),
  };
}
