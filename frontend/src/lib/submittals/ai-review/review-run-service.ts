import { Output, generateText } from "ai";

import { createDocumentIntelligenceTools } from "@/lib/ai/tools/document-intelligence";
import { getLanguageModel } from "@/lib/ai/providers";
import { GuardrailError } from "@/lib/guardrails/errors";
import {
  createRagServiceClient,
  createServiceClient,
} from "@/lib/supabase/service";
import type { Json } from "@/types/database.types";

import {
  type SubmittalAIReviewCheck,
  type SubmittalAIReviewModelOutput,
  type SubmittalAIReviewReadinessLayer,
  type SubmittalAIReviewRun,
  type SubmittalAIReviewSourceReference,
  SubmittalAIReviewModelOutputSchema,
  SubmittalAIReviewRunSchema,
} from "./schemas";
import {
  normalizeReviewRunTimestamp,
  normalizeStoredReadiness,
  normalizeStoredSourceCoverage,
} from "./persistence";
import {
  completeSubmittalAIReviewOpsRun,
  failSubmittalAIReviewOpsRun,
  recordSubmittalAIReviewOpsStep,
  startSubmittalAIReviewOpsRun,
  type SubmittalAIReviewOpsContext,
} from "./ops-ledger";
import {
  buildPromptSourceCatalog,
  buildSourceReference,
  resolvePromptSourceKeys,
} from "./source-references";

const WHERE = "submittal-ai-review-service";
const REVIEW_MODEL = "openai/gpt-5.4-mini";

type AnyRow = Record<string, unknown>;

type ScopedSubmittal = {
  id: string;
  projectId: number;
  title: string;
  status: string | null;
  submittalNumber: string;
  specificationSection: string | null;
  description: string | null;
};

type LinkedDrawingWithReadiness = {
  id: string;
  submittalId: string;
  drawingId: string;
  drawingNumber: string;
  title: string;
  discipline: string | null;
  revision: string | null;
  documentMetadataId: string | null;
  readiness: {
    state: "ready" | "partial" | "not_ready" | "failed";
    reasons: string[];
    ocrTextReady: boolean;
    visionReady: boolean;
    embeddedReady: boolean;
  };
  promptExcerpt: string | null;
};

type SubmittalPromptDocument = {
  sourceId: string;
  documentMetadataId: string | null;
  label: string;
  excerpt: string | null;
};

type SpecPromptSource = {
  sourceId: string;
  label: string;
  excerpt: string | null;
};

function toJson(value: unknown): Json {
  return value as Json;
}

function compactText(value: string | null | undefined, maxLength = 900) {
  const text = value?.trim() ?? "";
  if (!text) return null;
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

function parseProjectId(projectId: string) {
  const parsed = Number.parseInt(projectId, 10);
  if (!Number.isFinite(parsed)) {
    throw new GuardrailError({
      code: "BAD_REQUEST",
      where: WHERE,
      message: "Project ID must be a valid number.",
    });
  }
  return parsed;
}

function readinessStateFromCounts(args: {
  total: number;
  ready: number;
  failed?: boolean;
}) {
  if (args.failed) return "failed" as const;
  if (args.total === 0 || args.ready === 0) return "not_ready" as const;
  if (args.ready === args.total) return "ready" as const;
  return "partial" as const;
}

function readinessSummary(layers: SubmittalAIReviewReadinessLayer[]) {
  if (layers.some((layer) => layer.state === "failed")) {
    return "One or more source layers failed during review assembly.";
  }
  if (layers.some((layer) => layer.state === "not_ready")) {
    return "Required review sources are missing or incomplete.";
  }
  if (layers.some((layer) => layer.state === "partial")) {
    return "Review can proceed, but one or more supporting source layers are degraded.";
  }
  return "All review source layers are ready.";
}

function overallRunStatus(layers: SubmittalAIReviewReadinessLayer[]) {
  if (layers.some((layer) => layer.state === "failed"))
    return "partial" as const;
  if (
    layers.some(
      (layer) =>
        (layer.key === "submittal_text" || layer.key === "linked_drawings") &&
        layer.state === "not_ready",
    )
  ) {
    return "not_ready" as const;
  }
  if (
    layers.some(
      (layer) => layer.state === "partial" || layer.state === "not_ready",
    )
  ) {
    return "partial" as const;
  }
  return "ready" as const;
}
export function createSubmittalAIReviewService(userId: string) {
  const service = createServiceClient();
  const rag = createRagServiceClient();

  async function getScopedSubmittal(projectId: number, submittalId: string) {
    const { data, error } = await service
      .from("submittals")
      .select(
        "id, project_id, title, status, submittal_number, specification_section, description",
      )
      .eq("id", submittalId)
      .eq("project_id", projectId)
      .maybeSingle();

    if (error) {
      throw new GuardrailError({
        code: "DB_ERROR",
        where: WHERE,
        message: `Could not load submittal: ${error.message}`,
      });
    }

    if (!data) {
      throw new GuardrailError({
        code: "NOT_FOUND",
        where: WHERE,
        message: "Submittal not found for this project.",
      });
    }

    return {
      id: data.id,
      projectId: data.project_id,
      title: data.title,
      status: data.status,
      submittalNumber: data.submittal_number,
      specificationSection: data.specification_section,
      description: data.description,
    };
  }

  async function getDrawingByScope(projectId: number, drawingId: string) {
    const { data, error } = await service
      .from("drawings")
      .select("id, project_id")
      .eq("id", drawingId)
      .eq("project_id", projectId)
      .maybeSingle();

    if (error) {
      throw new GuardrailError({
        code: "DB_ERROR",
        where: WHERE,
        message: `Could not validate drawing scope: ${error.message}`,
      });
    }

    if (!data) {
      throw new GuardrailError({
        code: "NOT_FOUND",
        where: WHERE,
        message: "Drawing not found for this project.",
      });
    }
  }

  async function listLinkedDrawings(projectId: number, submittalId: string) {
    await getScopedSubmittal(projectId, submittalId);

    const { data, error } = await service
      .from("submittal_linked_drawings")
      .select(
        `
        id,
        submittal_id,
        drawing_id,
        drawings!submittal_linked_drawings_drawing_id_fkey (
          id,
          drawing_number,
          title,
          discipline,
          project_id,
          current_revision_id,
          document_metadata_id
        )
      `,
      )
      .eq("submittal_id", submittalId);

    if (error) {
      throw new GuardrailError({
        code: "DB_ERROR",
        where: WHERE,
        message: `Could not load linked drawings: ${error.message}`,
      });
    }

    const linkRows = (data ?? []) as Array<{
      id: string;
      submittal_id: string;
      drawing_id: string;
      drawings: AnyRow | null;
    }>;

    const drawingIds = linkRows.map((row) => row.drawing_id);
    const { data: revisions } = drawingIds.length
      ? await service
          .from("drawing_revisions")
          .select("drawing_id, revision_number, document_metadata_id, id")
          .in("drawing_id", drawingIds)
      : { data: [] as AnyRow[] };

    const currentByDrawing = new Map<string, AnyRow>();
    for (const row of (revisions ?? []) as AnyRow[]) {
      if (!currentByDrawing.has(String(row.drawing_id))) {
        currentByDrawing.set(String(row.drawing_id), row);
      }
    }

    const metadataIds = linkRows
      .map((row) => {
        const revision = currentByDrawing.get(row.drawing_id);
        return (
          (revision?.document_metadata_id as string | undefined) ??
          (row.drawings?.document_metadata_id as string | undefined) ??
          null
        );
      })
      .filter((value): value is string => Boolean(value));

    const { data: metadataRows } = metadataIds.length
      ? await service
          .from("document_metadata")
          .select("id, status, content, raw_text")
          .in("id", metadataIds)
      : { data: [] as AnyRow[] };

    const metadataById = new Map(
      ((metadataRows ?? []) as AnyRow[]).map((row) => [String(row.id), row]),
    );

    const { data: pageRows } = metadataIds.length
      ? await service
          .from("document_page_intelligence")
          .select("document_metadata_id, page_number, ai_summary")
          .in("document_metadata_id", metadataIds)
      : { data: [] as AnyRow[] };

    const pageCountByMetaId = new Map<string, number>();
    const pagePreviewByMetaId = new Map<string, string>();
    for (const row of (pageRows ?? []) as AnyRow[]) {
      const key = String(row.document_metadata_id);
      pageCountByMetaId.set(key, (pageCountByMetaId.get(key) ?? 0) + 1);
      if (!pagePreviewByMetaId.has(key) && typeof row.ai_summary === "string") {
        pagePreviewByMetaId.set(key, row.ai_summary);
      }
    }

    const { data: chunkRows } = metadataIds.length
      ? await rag
          .from("document_chunks")
          .select("document_id, text, chunk_index")
          .in("document_id", metadataIds)
      : { data: [] as AnyRow[] };

    const chunkCountByMetaId = new Map<string, number>();
    const chunkPreviewByMetaId = new Map<string, string>();
    for (const row of (chunkRows ?? []) as AnyRow[]) {
      const key = String(row.document_id);
      chunkCountByMetaId.set(key, (chunkCountByMetaId.get(key) ?? 0) + 1);
      if (!chunkPreviewByMetaId.has(key) && typeof row.text === "string") {
        chunkPreviewByMetaId.set(key, row.text);
      }
    }

    return linkRows.map((row) => {
      const drawing = row.drawings ?? {};
      const revision = currentByDrawing.get(row.drawing_id);
      const documentMetadataId =
        (revision?.document_metadata_id as string | undefined) ??
        (drawing.document_metadata_id as string | undefined) ??
        null;
      const metadata = documentMetadataId
        ? metadataById.get(documentMetadataId)
        : null;
      const ocrTextReady = Boolean(
        compactText(
          (metadata?.content as string | undefined) ??
            (metadata?.raw_text as string | undefined),
        ),
      );
      const visionReady =
        (pageCountByMetaId.get(documentMetadataId ?? "") ?? 0) > 0;
      const embeddedReady =
        (chunkCountByMetaId.get(documentMetadataId ?? "") ?? 0) > 0;
      const reasons: string[] = [];

      if (!documentMetadataId) {
        reasons.push(
          "This drawing has no document metadata record for OCR or visual AI.",
        );
      }
      if (!ocrTextReady) {
        reasons.push(
          "No OCR or raw extracted text is available for this drawing.",
        );
      }
      if (!visionReady) {
        reasons.push(
          "No page-level visual AI summaries are available for this drawing.",
        );
      }
      if (!embeddedReady) {
        reasons.push("No retrieval chunks are available for this drawing.");
      }

      const state = !documentMetadataId
        ? "not_ready"
        : metadata?.status === "ocr_failed" || metadata?.status === "error"
          ? "failed"
          : ocrTextReady && visionReady && embeddedReady
            ? "ready"
            : ocrTextReady || visionReady || embeddedReady
              ? "partial"
              : "not_ready";

      return {
        id: row.id,
        submittalId: row.submittal_id,
        drawingId: row.drawing_id,
        drawingNumber: String(drawing.drawing_number ?? ""),
        title: String(drawing.title ?? ""),
        discipline: (drawing.discipline as string | null) ?? null,
        revision: (revision?.revision_number as string | undefined) ?? null,
        documentMetadataId,
        readiness: {
          state,
          reasons,
          ocrTextReady,
          visionReady,
          embeddedReady,
        },
        promptExcerpt:
          compactText(pagePreviewByMetaId.get(documentMetadataId ?? "")) ??
          compactText(chunkPreviewByMetaId.get(documentMetadataId ?? "")) ??
          compactText(
            (metadata?.content as string | undefined) ??
              (metadata?.raw_text as string | undefined),
          ),
      } satisfies LinkedDrawingWithReadiness;
    });
  }

  async function loadSubmittalPromptDocuments(submittalId: string) {
    const { data: linkRows, error: linkError } = await service
      .from("submittal_doc_links")
      .select("document_metadata_id")
      .eq("submittal_id", submittalId);

    if (linkError) {
      throw new GuardrailError({
        code: "DB_ERROR",
        where: WHERE,
        message: `Could not load submittal document links: ${linkError.message}`,
      });
    }

    const docIds = (linkRows ?? [])
      .map((row) => row.document_metadata_id)
      .filter((value): value is string => Boolean(value));

    const docs: SubmittalPromptDocument[] = [];

    if (docIds.length > 0) {
      const { data: metadataRows, error: metadataError } = await service
        .from("document_metadata")
        .select("id, title, content, raw_text")
        .in("id", docIds);

      if (metadataError) {
        throw new GuardrailError({
          code: "DB_ERROR",
          where: WHERE,
          message: `Could not load submittal source text: ${metadataError.message}`,
        });
      }

      const { data: ragRows, error: ragError } = await rag
        .from("rag_document_metadata")
        .select("id, content, raw_text")
        .in("id", docIds);

      if (ragError) {
        throw new GuardrailError({
          code: "DB_ERROR",
          where: WHERE,
          message: `Could not load submittal RAG source text: ${ragError.message}`,
        });
      }

      const ragById = new Map(
        ((ragRows ?? []) as AnyRow[]).map((row) => [String(row.id), row]),
      );

      for (const row of (metadataRows ?? []) as AnyRow[]) {
        const ragRow = ragById.get(String(row.id));
        docs.push({
          sourceId: String(row.id),
          documentMetadataId: String(row.id),
          label: String(row.title ?? "Submittal document"),
          excerpt: compactText(
            (ragRow?.content as string | undefined) ??
              (ragRow?.raw_text as string | undefined) ??
              (row.content as string | undefined) ??
              (row.raw_text as string | undefined),
          ),
        });
      }
    }

    return docs;
  }

  async function insertRunRecord(input: Record<string, unknown>) {
    const { data, error } = await service
      .from("submittal_ai_review_runs" as never)
      .insert(input as never)
      .select("*")
      .single();

    if (error) {
      throw new GuardrailError({
        code: "DB_ERROR",
        where: WHERE,
        message: `Could not create submittal AI review run: ${error.message}`,
      });
    }

    return data as AnyRow;
  }

  async function updateRunRecord(
    runId: string,
    patch: Record<string, unknown>,
  ) {
    const { error } = await service
      .from("submittal_ai_review_runs" as never)
      .update(patch as never)
      .eq("id", runId);

    if (error) {
      throw new GuardrailError({
        code: "DB_ERROR",
        where: WHERE,
        message: `Could not update submittal AI review run: ${error.message}`,
      });
    }
  }

  async function replaceRunChecks(
    runId: string,
    projectId: number,
    submittalId: string,
    checks: SubmittalAIReviewCheck[],
  ) {
    const { error: deleteError } = await service
      .from("submittal_ai_review_checks" as never)
      .delete()
      .eq("run_id", runId);

    if (deleteError) {
      throw new GuardrailError({
        code: "DB_ERROR",
        where: WHERE,
        message: `Could not clear prior review checks: ${deleteError.message}`,
      });
    }

    if (checks.length === 0) return;

    const rows = checks.map((check) => ({
      run_id: runId,
      project_id: projectId,
      submittal_id: submittalId,
      check_type: check.checkType,
      status: check.status,
      severity: check.severity,
      title: check.title,
      finding: check.finding,
      expected_value: check.expectedValue,
      submitted_value: check.submittedValue,
      recommendation: check.recommendation,
      source_references: toJson(check.sourceReferences),
      confidence: check.confidence,
      missing_data: toJson(check.missingData),
      reviewer_disposition: check.reviewerDisposition,
      reviewer_notes: check.reviewerNotes,
    }));

    const { error } = await service
      .from("submittal_ai_review_checks" as never)
      .insert(rows as never);

    if (error) {
      throw new GuardrailError({
        code: "DB_ERROR",
        where: WHERE,
        message: `Could not persist review checks: ${error.message}`,
      });
    }
  }

  async function failRunIfStillRunning(
    runId: string,
    code: string,
    message: string,
  ) {
    const { error } = await service
      .from("submittal_ai_review_runs" as never)
      .update({
        status: "failed",
        completed_at: new Date().toISOString(),
        error_code: code,
        error_message: message,
      } as never)
      .eq("id", runId)
      .eq("status", "running");

    if (error) {
      throw new GuardrailError({
        code: "DB_ERROR",
        where: WHERE,
        message: `Could not finalize failed review run: ${error.message}`,
      });
    }
  }

  async function getLatestReview(projectId: number, submittalId: string) {
    await getScopedSubmittal(projectId, submittalId);
    const { data, error } = await service
      .from("submittal_ai_review_runs" as never)
      .select("*, submittal_ai_review_checks(*)")
      .eq("project_id", projectId)
      .eq("submittal_id", submittalId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new GuardrailError({
        code: "DB_ERROR",
        where: WHERE,
        message: `Could not load submittal AI review runs: ${error.message}`,
      });
    }

    if (!data) return null;

    const runData = data as AnyRow;

    return SubmittalAIReviewRunSchema.parse({
      runId: runData.id,
      projectId: runData.project_id,
      submittalId: runData.submittal_id,
      status: runData.status,
      focusArea: runData.focus_area ?? null,
      summary: runData.summary ?? null,
      recommendation: runData.recommendation ?? null,
      startedAt:
        normalizeReviewRunTimestamp(runData.started_at) ??
        (() => {
          throw new GuardrailError({
            code: "INTERNAL_ERROR",
            where: WHERE,
            message: "Stored review run timestamp is invalid.",
          });
        })(),
      completedAt: runData.completed_at
        ? normalizeReviewRunTimestamp(runData.completed_at)
        : null,
      readiness: normalizeStoredReadiness(
        runData.readiness,
        String(runData.status ?? ""),
        runData.error_message as string | null | undefined,
      ),
      sourceCoverage: normalizeStoredSourceCoverage(runData.source_coverage),
      linkedDrawings: [],
      checks: ((runData.submittal_ai_review_checks ?? []) as AnyRow[]).map(
        (row) => ({
          id: row.id,
          checkType: row.check_type,
          status: row.status,
          severity: row.severity,
          title: row.title,
          finding: row.finding,
          expectedValue: row.expected_value ?? null,
          submittedValue: row.submitted_value ?? null,
          recommendation: row.recommendation ?? null,
          sourceReferences:
            (row.source_references as SubmittalAIReviewSourceReference[]) ?? [],
          confidence:
            typeof row.confidence === "number" ? row.confidence : null,
          missingData: (row.missing_data as string[]) ?? [],
          reviewerDisposition: row.reviewer_disposition ?? "pending",
          reviewerNotes: row.reviewer_notes ?? null,
        }),
      ),
      error:
        runData.error_code || runData.error_message
          ? {
              code: runData.error_code ?? "INTERNAL_ERROR",
              message: runData.error_message ?? "Submittal AI review failed.",
            }
          : null,
    });
  }

  async function updateCheckDisposition(
    projectId: number,
    submittalId: string,
    checkId: string,
    reviewerDisposition: SubmittalAIReviewCheck["reviewerDisposition"],
    reviewerNotes: string | null,
  ) {
    await getScopedSubmittal(projectId, submittalId);

    const { data: checkRow, error: checkError } = await service
      .from("submittal_ai_review_checks" as never)
      .select("id, project_id, submittal_id")
      .eq("id", checkId)
      .maybeSingle();

    if (checkError) {
      throw new GuardrailError({
        code: "DB_ERROR",
        where: WHERE,
        message: `Could not load AI review check: ${checkError.message}`,
      });
    }

    if (!checkRow) {
      throw new GuardrailError({
        code: "NOT_FOUND",
        where: WHERE,
        message: "AI review check not found.",
      });
    }

    const scopedCheck = checkRow as AnyRow;
    if (
      Number(scopedCheck.project_id) !== projectId ||
      String(scopedCheck.submittal_id) !== submittalId
    ) {
      throw new GuardrailError({
        code: "NOT_FOUND",
        where: WHERE,
        message: "AI review check not found for this submittal.",
      });
    }

    const { error: updateError } = await service
      .from("submittal_ai_review_checks" as never)
      .update({
        reviewer_disposition: reviewerDisposition,
        reviewer_notes: reviewerNotes,
      } as never)
      .eq("id", checkId);

    if (updateError) {
      throw new GuardrailError({
        code: "DB_ERROR",
        where: WHERE,
        message: `Could not update AI review check disposition: ${updateError.message}`,
      });
    }

    const latestReview = await getLatestReview(projectId, submittalId);
    if (!latestReview) {
      throw new GuardrailError({
        code: "NOT_FOUND",
        where: WHERE,
        message: "AI review run not found after updating check disposition.",
      });
    }

    return latestReview;
  }

  async function runReview(
    projectId: number,
    submittalId: string,
    focusArea?: string,
  ) {
    const scopedSubmittal = await getScopedSubmittal(projectId, submittalId);
    const linkedDrawings = await listLinkedDrawings(projectId, submittalId);
    const submittalDocuments = await loadSubmittalPromptDocuments(submittalId);
    const tools = createDocumentIntelligenceTools(userId, {
      pinnedProjectId: projectId,
    });

    const runRow = await insertRunRecord({
      project_id: projectId,
      submittal_id: submittalId,
      status: "running",
      focus_area: focusArea ?? null,
      readiness: toJson({}),
      source_coverage: toJson({}),
      created_by: userId,
      model_id: REVIEW_MODEL,
    });
    const runId = String(runRow.id);
    let opsContext: SubmittalAIReviewOpsContext | null = null;
    let opsTerminalRecorded = false;

    try {
      const startedAt =
        normalizeReviewRunTimestamp(runRow.started_at) ??
        (() => {
          throw new GuardrailError({
            code: "INTERNAL_ERROR",
            where: WHERE,
            message: "Stored review run timestamp is invalid.",
          });
        })();
      opsContext = await startSubmittalAIReviewOpsRun({
        projectId,
        submittalId,
        submittalReviewRunId: runId,
        userId,
        focusArea: focusArea ?? null,
        modelId: REVIEW_MODEL,
        startedAt,
      });

      const reviewTool = tools.reviewSubmittalAgainstDrawings;
      const specTool = tools.getSpecRequirements;

      let toolContext: AnyRow;
      const contextStepStartedAt = new Date().toISOString();
      try {
        toolContext = (await reviewTool.execute!(
          { projectId, submittalId, focusArea },
          {
            toolCallId: "submittal-review",
            messages: [],
            abortSignal: undefined,
            context: {},
          },
        )) as AnyRow;
      } catch (error) {
        await recordSubmittalAIReviewOpsStep(opsContext, {
          stepType: "tool_call",
          status: "failed_retryable",
          startedAt: contextStepStartedAt,
          failureCode: "TOOL_EXECUTION_FAILED",
          failureMessage:
            error instanceof Error
              ? error.message
              : "Submittal review tool failed.",
          metadata: {
            toolName: "reviewSubmittalAgainstDrawings",
            projectId,
            submittalId,
          },
        });
        await updateRunRecord(runId, {
          status: "failed",
          completed_at: new Date().toISOString(),
          error_code: "TOOL_EXECUTION_FAILED",
          error_message:
            error instanceof Error
              ? error.message
              : "Submittal review tool failed.",
        });
        throw new GuardrailError({
          code: "INTERNAL_ERROR",
          where: WHERE,
          message: "Submittal review context assembly failed.",
          cause: error,
        });
      }
      await recordSubmittalAIReviewOpsStep(opsContext, {
        stepType: "tool_call",
        status: "succeeded",
        startedAt: contextStepStartedAt,
        metadata: {
          toolName: "reviewSubmittalAgainstDrawings",
          projectId,
          submittalId,
        },
      });

    const specQuery =
      scopedSubmittal.specificationSection?.trim() ||
      scopedSubmittal.title ||
      "submittal requirements";
    let specSources: SpecPromptSource[] = [];
    let specLayerFailure: string | null = null;

    try {
      const specResult = (await specTool.execute!(
        {
          projectId,
          query: specQuery,
          topK: 6,
        },
        {
          toolCallId: "submittal-specs",
          messages: [],
          abortSignal: undefined,
          context: {},
        },
      )) as AnyRow;

      if (!("error" in specResult)) {
        specSources = ((specResult.sources ?? []) as AnyRow[]).flatMap(
          (source) =>
            ((source.excerpts as string[] | undefined) ?? [])
              .slice(0, 2)
              .map((excerpt, index) => ({
                sourceId: `${String(source.documentId ?? source.title)}:${index}`,
                label: String(source.title ?? "Specification source"),
                excerpt: compactText(excerpt, 500),
              })),
        );
      } else {
        specLayerFailure = String(specResult.error);
      }
    } catch (error) {
      specLayerFailure =
        error instanceof Error
          ? error.message
          : "Specification context failed.";
    }

    const submittalTextLayer: SubmittalAIReviewReadinessLayer = {
      key: "submittal_text",
      label: "Submittal text",
      state: readinessStateFromCounts({
        total: Math.max(submittalDocuments.length, 1),
        ready: submittalDocuments.filter((doc) => Boolean(doc.excerpt)).length,
      }),
      reasons:
        submittalDocuments.filter((doc) => Boolean(doc.excerpt)).length > 0
          ? []
          : ["No extracted submittal source text is available yet."],
      availableCount: submittalDocuments.filter((doc) => Boolean(doc.excerpt))
        .length,
      totalCount: submittalDocuments.length,
    };

    const linkedDrawingLayer: SubmittalAIReviewReadinessLayer = {
      key: "linked_drawings",
      label: "Linked drawings",
      state:
        linkedDrawings.length > 0
          ? readinessStateFromCounts({
              total: linkedDrawings.length,
              ready: linkedDrawings.filter(
                (drawing) => drawing.readiness.state !== "not_ready",
              ).length,
            })
          : "not_ready",
      reasons:
        linkedDrawings.length > 0
          ? []
          : ["No drawings are linked to this submittal yet."],
      availableCount: linkedDrawings.length,
      totalCount: linkedDrawings.length,
    };

    const ocrLayer: SubmittalAIReviewReadinessLayer = {
      key: "drawing_ocr",
      label: "Drawing OCR",
      state: readinessStateFromCounts({
        total: linkedDrawings.length,
        ready: linkedDrawings.filter(
          (drawing) => drawing.readiness.ocrTextReady,
        ).length,
        failed: linkedDrawings.some(
          (drawing) => drawing.readiness.state === "failed",
        ),
      }),
      reasons:
        linkedDrawings.length === 0
          ? ["Link at least one drawing before OCR readiness can be evaluated."]
          : [],
      availableCount: linkedDrawings.filter(
        (drawing) => drawing.readiness.ocrTextReady,
      ).length,
      totalCount: linkedDrawings.length,
    };

    const visionLayer: SubmittalAIReviewReadinessLayer = {
      key: "drawing_vision",
      label: "Drawing visual AI",
      state: readinessStateFromCounts({
        total: linkedDrawings.length,
        ready: linkedDrawings.filter((drawing) => drawing.readiness.visionReady)
          .length,
      }),
      reasons:
        linkedDrawings.length === 0
          ? [
              "Link at least one drawing before visual AI readiness can be evaluated.",
            ]
          : [],
      availableCount: linkedDrawings.filter(
        (drawing) => drawing.readiness.visionReady,
      ).length,
      totalCount: linkedDrawings.length,
    };

    const retrievalLayer: SubmittalAIReviewReadinessLayer = {
      key: "retrieval",
      label: "Retrieval chunks",
      state: readinessStateFromCounts({
        total: linkedDrawings.length,
        ready: linkedDrawings.filter(
          (drawing) => drawing.readiness.embeddedReady,
        ).length,
      }),
      reasons:
        linkedDrawings.length === 0
          ? [
              "Link at least one drawing before retrieval readiness can be evaluated.",
            ]
          : [],
      availableCount: linkedDrawings.filter(
        (drawing) => drawing.readiness.embeddedReady,
      ).length,
      totalCount: linkedDrawings.length,
    };

    const specLayer: SubmittalAIReviewReadinessLayer = {
      key: "spec_context",
      label: "Specification context",
      state: specLayerFailure
        ? "failed"
        : specSources.length > 0
          ? "ready"
          : "not_ready",
      reasons: specLayerFailure
        ? [specLayerFailure]
        : specSources.length > 0
          ? []
          : ["No specification excerpts were found for this submittal."],
      availableCount: specSources.length,
      totalCount: specSources.length,
    };

    const layers = [
      submittalTextLayer,
      linkedDrawingLayer,
      ocrLayer,
      visionLayer,
      retrievalLayer,
      specLayer,
    ];

    const statusFromLayers = overallRunStatus(layers);
    const sourceCoverage = {
      submittalDocumentCount: submittalDocuments.length,
      linkedDrawingCount: linkedDrawings.length,
      ragChunkCount: linkedDrawings.filter(
        (drawing) => drawing.readiness.embeddedReady,
      ).length,
      specSourceCount: specSources.length,
    };

    const readyForSynthesis =
      submittalTextLayer.state !== "not_ready" &&
      linkedDrawingLayer.state !== "not_ready";
    await recordSubmittalAIReviewOpsStep(opsContext, {
      stepType: "source_fetch",
      status:
        readyForSynthesis && !layers.some((layer) => layer.state === "failed")
          ? "succeeded"
          : readyForSynthesis
            ? "failed_retryable"
            : "blocked",
      startedAt: contextStepStartedAt,
      metadata: {
        readiness: {
          state: statusFromLayers,
          summary: readinessSummary(layers),
          layers,
        },
        sourceCoverage,
      },
    });

    if (!readyForSynthesis || "error" in toolContext) {
      const payload = SubmittalAIReviewRunSchema.parse({
        runId,
        projectId,
        submittalId,
        status: "not_ready",
        focusArea: focusArea ?? null,
        summary: null,
        recommendation: null,
        startedAt:
          normalizeReviewRunTimestamp(runRow.started_at) ??
          (() => {
            throw new GuardrailError({
              code: "INTERNAL_ERROR",
              where: WHERE,
              message: "Stored review run timestamp is invalid.",
            });
          })(),
        completedAt: new Date().toISOString(),
        readiness: {
          state: "not_ready",
          summary:
            "Review did not run because required source layers are not ready.",
          layers,
        },
        sourceCoverage,
        linkedDrawings: linkedDrawings.map((drawing) => ({
          id: drawing.id,
          submittalId: drawing.submittalId,
          drawingId: drawing.drawingId,
          drawingNumber: drawing.drawingNumber,
          title: drawing.title,
          discipline: drawing.discipline,
          revision: drawing.revision,
          readiness: drawing.readiness,
        })),
        checks: [],
        error:
          "error" in toolContext
            ? {
                code: "TOOL_CONTEXT_NOT_READY",
                message: String(toolContext.error),
              }
            : null,
      });

      await updateRunRecord(runId, {
        status: "not_ready",
        summary: null,
        recommendation: null,
        readiness: toJson(payload.readiness),
        source_coverage: toJson(sourceCoverage),
        validated_output: toJson(payload),
        error_code: payload.error?.code ?? null,
        error_message: payload.error?.message ?? null,
        completed_at: payload.completedAt,
      });
      await completeSubmittalAIReviewOpsRun(opsContext, payload);
      opsTerminalRecorded = true;
      return payload;
    }

    const promptCatalog = buildPromptSourceCatalog([
      ...submittalDocuments
        .filter((doc) => Boolean(doc.excerpt))
        .map((doc, index) =>
          buildSourceReference({
            sourceKey: `SUB-${index + 1}`,
            sourceType: "submittal_document",
            sourceId: doc.sourceId,
            documentMetadataId: doc.documentMetadataId,
            drawingId: null,
            drawingNumber: null,
            pageNumber: null,
            chunkIndex: null,
            label: doc.label,
            excerpt: doc.excerpt,
            confidence: null,
          }),
        ),
      ...linkedDrawings
        .filter((drawing) => Boolean(drawing.promptExcerpt))
        .map((drawing, index) =>
          buildSourceReference({
            sourceKey: `DWG-${index + 1}`,
            sourceType: "drawing",
            sourceId: drawing.drawingId,
            documentMetadataId: drawing.documentMetadataId,
            drawingId: drawing.drawingId,
            drawingNumber: drawing.drawingNumber,
            pageNumber: null,
            chunkIndex: null,
            label: `${drawing.drawingNumber} - ${drawing.title}`,
            excerpt: drawing.promptExcerpt,
            confidence: null,
          }),
        ),
      ...specSources.map((source, index) =>
        buildSourceReference({
          sourceKey: `SPEC-${index + 1}`,
          sourceType: "specification",
          sourceId: source.sourceId,
          documentMetadataId: null,
          drawingId: null,
          drawingNumber: null,
          pageNumber: null,
          chunkIndex: null,
          label: source.label,
          excerpt: source.excerpt,
          confidence: null,
        }),
      ),
      ...(
        ((toolContext.comparisonContext as AnyRow | undefined)
          ?.additionalRelevantDrawingChunks as AnyRow[] | undefined) ?? []
      )
        .slice(0, 4)
        .map((chunk, index) =>
          buildSourceReference({
            sourceKey: `RAG-${index + 1}`,
            sourceType: "rag_chunk",
            sourceId: `${String(chunk.title ?? "chunk")}:${index}`,
            documentMetadataId: null,
            drawingId: null,
            drawingNumber: null,
            pageNumber: null,
            chunkIndex: index,
            label: String(chunk.title ?? "Relevant drawing chunk"),
            excerpt: compactText(chunk.excerpt as string | undefined, 450),
            confidence: null,
          }),
        ),
    ]);

    let modelOutput: SubmittalAIReviewModelOutput;
    let rawModelOutput: unknown = null;
    const synthesisStartedAt = new Date().toISOString();
    try {
      const result = await generateText({
        model: getLanguageModel(REVIEW_MODEL),
        output: Output.object({ schema: SubmittalAIReviewModelOutputSchema }),
        prompt: [
          "Review this construction submittal against the available source evidence.",
          "Use only the provided source keys. Every check must cite one or more source keys from the catalog.",
          "Use null for expectedValue, submittedValue, or recommendation when the evidence does not support them.",
          focusArea ? `Focus area: ${focusArea}` : null,
          "",
          `Submittal: ${scopedSubmittal.submittalNumber} - ${scopedSubmittal.title}`,
          scopedSubmittal.description
            ? `Description: ${scopedSubmittal.description}`
            : null,
          scopedSubmittal.specificationSection
            ? `Specification section: ${scopedSubmittal.specificationSection}`
            : null,
          "",
          "Source catalog:",
          ...promptCatalog.map((entry) => entry.promptBlock),
        ]
          .filter(Boolean)
          .join("\n"),
      });

      modelOutput = result.output;
      rawModelOutput = result.response.body ?? result.output;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Submittal AI review failed.";
      await recordSubmittalAIReviewOpsStep(opsContext, {
        stepType: "synthesis",
        status: "failed_retryable",
        startedAt: synthesisStartedAt,
        failureCode: "AI_PROVIDER_FAILED",
        failureMessage: message,
        metadata: {
          modelId: REVIEW_MODEL,
          sourceCoverage,
        },
      });
      await failSubmittalAIReviewOpsRun(opsContext, {
        code: "AI_PROVIDER_FAILED",
        message,
        sourceCoverage,
        metadata: {
          submittalReviewRunId: runId,
          projectId,
          submittalId,
        },
      });
      opsTerminalRecorded = true;
      await updateRunRecord(runId, {
        status: "failed",
        readiness: toJson({
          state: statusFromLayers,
          summary: readinessSummary(layers),
          layers,
        }),
        source_coverage: toJson(sourceCoverage),
        error_code: "AI_PROVIDER_FAILED",
        error_message: message,
        completed_at: new Date().toISOString(),
      });
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where: WHERE,
        message: "AI submittal review synthesis failed.",
        cause: error,
      });
    }
    await recordSubmittalAIReviewOpsStep(opsContext, {
      stepType: "synthesis",
      status: "succeeded",
      startedAt: synthesisStartedAt,
      metadata: {
        modelId: REVIEW_MODEL,
        checkCount: modelOutput.checks.length,
      },
    });

    const checks: SubmittalAIReviewCheck[] = modelOutput.checks.map(
      (check) => ({
        checkType: check.checkType,
        status: check.status,
        severity: check.severity,
        title: check.title,
        finding: check.finding,
        expectedValue: check.expectedValue,
        submittedValue: check.submittedValue,
        recommendation: check.recommendation,
        sourceReferences: resolvePromptSourceKeys(
          check.sourceKeys,
          promptCatalog,
        ),
        confidence: check.confidence,
        missingData: check.missingData,
        reviewerDisposition: "pending",
        reviewerNotes: null,
      }),
    );

    const payload = SubmittalAIReviewRunSchema.parse({
      runId,
      projectId,
      submittalId,
      status: statusFromLayers,
      focusArea: focusArea ?? null,
      summary: modelOutput.summary,
      recommendation: modelOutput.recommendation,
      startedAt:
        normalizeReviewRunTimestamp(runRow.started_at) ??
        (() => {
          throw new GuardrailError({
            code: "INTERNAL_ERROR",
            where: WHERE,
            message: "Stored review run timestamp is invalid.",
          });
        })(),
      completedAt: new Date().toISOString(),
      readiness: {
        state: statusFromLayers === "ready" ? "ready" : "partial",
        summary: readinessSummary(layers),
        layers,
      },
      sourceCoverage,
      linkedDrawings: linkedDrawings.map((drawing) => ({
        id: drawing.id,
        submittalId: drawing.submittalId,
        drawingId: drawing.drawingId,
        drawingNumber: drawing.drawingNumber,
        title: drawing.title,
        discipline: drawing.discipline,
        revision: drawing.revision,
        readiness: drawing.readiness,
      })),
      checks,
      error: null,
    });

    await replaceRunChecks(runId, projectId, submittalId, checks);
    await updateRunRecord(runId, {
      status: payload.status,
      summary: payload.summary,
      recommendation: payload.recommendation,
      readiness: toJson(payload.readiness),
      source_coverage: toJson(sourceCoverage),
      raw_model_output: toJson(rawModelOutput),
      validated_output: toJson(modelOutput),
      completed_at: payload.completedAt,
      error_code: null,
      error_message: null,
    });
    await completeSubmittalAIReviewOpsRun(opsContext, payload);
    opsTerminalRecorded = true;

    return payload;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Submittal AI review failed unexpectedly.";
      const code =
        error instanceof GuardrailError ? error.code : "INTERNAL_ERROR";

      await failRunIfStillRunning(runId, code, message);
      if (!opsTerminalRecorded) {
        await failSubmittalAIReviewOpsRun(opsContext, {
          code,
          message,
          metadata: {
            submittalReviewRunId: runId,
            projectId,
            submittalId,
          },
        });
      }
      throw error;
    }
  }

  return {
    parseProjectId,
    getScopedSubmittal,
    getDrawingByScope,
    getLatestReview,
    updateCheckDisposition,
    listLinkedDrawings,
    runReview,
  };
}
