import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { getApiRouteUser } from "@/lib/supabase/server";
import {
  createRagServiceClient,
  createServiceClient,
} from "@/lib/supabase/service";
import { serviceDb } from "@/lib/supabase/service-db";

const WHERE = "projects/[projectId]/drawings/[drawingId]/intelligence#GET";

type ReadinessState = "ready" | "partial" | "not_ready" | "failed";

function textPreview(value: string | null | undefined, length = 4000) {
  const text = value?.trim() ?? "";
  return text ? text.slice(0, length) : null;
}

function processingState(args: {
  hasMetadata: boolean;
  metadataStatus: string | null;
  ocrTextReady: boolean;
  visionReady: boolean;
}): ReadinessState {
  if (!args.hasMetadata) return "not_ready";
  if (args.metadataStatus === "ocr_failed" || args.metadataStatus === "error") {
    return "failed";
  }
  if (args.ocrTextReady && args.visionReady) return "ready";
  if (args.ocrTextReady || args.visionReady) return "partial";
  return "not_ready";
}

function readinessReasons(args: {
  hasMetadata: boolean;
  metadataStatus: string | null;
  ocrTextReady: boolean;
  visionReady: boolean;
  embeddedReady: boolean;
  pageCount: number;
  chunkCount: number;
}) {
  const reasons: string[] = [];

  if (!args.hasMetadata) {
    reasons.push(
      "This drawing has no document metadata record, so the OCR and visual AI pipeline has no source file to process.",
    );
    return reasons;
  }

  if (args.metadataStatus === "no_text") {
    reasons.push("OCR has not produced extracted text yet.");
  }
  if (args.metadataStatus === "ocr_failed" || args.metadataStatus === "error") {
    reasons.push("OCR or document processing is marked failed.");
  }
  if (!args.ocrTextReady) {
    reasons.push("No OCR/raw extracted text is stored on the document record.");
  }
  if (!args.visionReady) {
    reasons.push(
      "No page-level visual AI summaries are stored for this drawing.",
    );
  }
  if (!args.embeddedReady) {
    reasons.push(
      "No embedded drawing chunks were found for retrieval-backed AI review.",
    );
  }
  if (args.pageCount > 0 && args.visionReady) {
    reasons.push(
      `${args.pageCount} page-level visual AI record(s) are available.`,
    );
  }
  if (args.chunkCount > 0) {
    reasons.push(
      `${args.chunkCount} retrieval chunk(s) were found for this drawing.`,
    );
  }

  return reasons;
}

export const GET = withApiGuardrails<{
  projectId: string;
  drawingId: string;
}>(WHERE, async ({ params }) => {
  const { projectId, drawingId } = await params;
  const pid = Number.parseInt(projectId, 10);
  if (!Number.isFinite(pid)) {
    throw new GuardrailError({
      code: "BAD_REQUEST",
      where: WHERE,
      message: "Project ID must be a valid number.",
    });
  }

  const user = await getApiRouteUser();

  if (!user) {
    throw new GuardrailError({
      code: "UNAUTHORIZED",
      where: WHERE,
      message: "You must be signed in to inspect drawing AI extraction.",
    });
  }

  const service = createServiceClient();

  const { data: drawing, error: drawingError } = await serviceDb.from("drawings")
    .select(
      "id, project_id, drawing_number, title, document_metadata_id, current_revision_id",
    )
    .eq("id", drawingId)
    .eq("project_id", pid)
    .maybeSingle();

  if (drawingError) {
    throw new GuardrailError({
      code: "DB_ERROR",
      where: WHERE,
      message: `Could not load drawing intelligence source: ${drawingError.message}`,
    });
  }

  if (!drawing) {
    throw new GuardrailError({
      code: "NOT_FOUND",
      where: WHERE,
      message: "Drawing not found for this project.",
    });
  }

  const { data: revisions, error: revisionsError } = await serviceDb.from("drawing_revisions")
    .select(
      "id, revision_number, status, is_current_revision, document_metadata_id, ocr_confidence_label, ocr_confidence_score, ocr_confidence_source, created_at",
    )
    .eq("drawing_id", drawingId)
    .order("created_at", { ascending: false });

  if (revisionsError) {
    throw new GuardrailError({
      code: "DB_ERROR",
      where: WHERE,
      message: `Could not load drawing revisions for intelligence inspection: ${revisionsError.message}`,
    });
  }

  const revisionRows = revisions ?? [];
  const currentRevision =
    revisionRows.find(
      (revision) => revision.id === drawing.current_revision_id,
    ) ??
    revisionRows.find((revision) => revision.is_current_revision) ??
    revisionRows[0] ??
    null;

  const documentMetadataId =
    currentRevision?.document_metadata_id ??
    drawing.document_metadata_id ??
    null;

  if (!documentMetadataId) {
    return Response.json({
      drawing: {
        id: drawing.id,
        number: drawing.drawing_number,
        title: drawing.title,
      },
      revision: currentRevision,
      documentMetadata: null,
      ocr: {
        ready: false,
        textLength: 0,
        textPreview: null,
      },
      vision: {
        ready: false,
        pageCount: 0,
        pages: [],
      },
      retrieval: {
        ready: false,
        chunkCount: 0,
        chunks: [],
      },
      readiness: {
        state: "not_ready" satisfies ReadinessState,
        ocrTextReady: false,
        visionReady: false,
        embeddedReady: false,
        aiReviewReady: false,
        reasons: readinessReasons({
          hasMetadata: false,
          metadataStatus: null,
          ocrTextReady: false,
          visionReady: false,
          embeddedReady: false,
          pageCount: 0,
          chunkCount: 0,
        }),
      },
    });
  }

  const { data: metadata, error: metadataError } = await serviceDb.from("document_metadata")
    .select(
      "id, title, status, document_type, source_system, file_name, storage_bucket, source_path, url, source_web_url, content, raw_text, created_at",
    )
    .eq("id", documentMetadataId)
    .maybeSingle();

  if (metadataError) {
    throw new GuardrailError({
      code: "DB_ERROR",
      where: WHERE,
      message: `Could not load OCR metadata for drawing: ${metadataError.message}`,
    });
  }

  const { data: pages, error: pagesError } = await serviceDb.from("document_page_intelligence")
    .select(
      "page_number, sheet_number, sheet_title, discipline, scale, detail_references, implied_submittals, notes_and_requirements, ai_summary, raw_extraction, vision_model, processed_at",
    )
    .eq("document_metadata_id", documentMetadataId)
    .order("page_number", { ascending: true });

  if (pagesError) {
    throw new GuardrailError({
      code: "DB_ERROR",
      where: WHERE,
      message: `Could not load visual AI extraction for drawing: ${pagesError.message}`,
    });
  }

  const rag = createRagServiceClient();
  const { data: chunks, error: chunksError } = await rag
    .from("document_chunks")
    .select("text, chunk_index")
    .eq("document_id", documentMetadataId)
    .order("chunk_index", { ascending: true })
    .limit(20);

  if (chunksError) {
    throw new GuardrailError({
      code: "DB_ERROR",
      where: WHERE,
      message: `Could not load drawing retrieval chunks: ${chunksError.message}`,
    });
  }

  const rawText = metadata?.content ?? metadata?.raw_text ?? null;
  const extractedText = rawText?.trim() ?? "";
  const pageRows = pages ?? [];
  const chunkRows = chunks ?? [];
  const ocrTextReady = extractedText.length > 0;
  const visionReady = pageRows.some((page) => Boolean(page.ai_summary?.trim()));
  const embeddedReady = chunkRows.length > 0;
  const state = processingState({
    hasMetadata: Boolean(metadata),
    metadataStatus: metadata?.status ?? null,
    ocrTextReady,
    visionReady,
  });

  return Response.json({
    drawing: {
      id: drawing.id,
      number: drawing.drawing_number,
      title: drawing.title,
    },
    revision: currentRevision,
    documentMetadata: metadata
      ? {
          id: metadata.id,
          title: metadata.title,
          status: metadata.status,
          documentType: metadata.document_type,
          sourceSystem: metadata.source_system,
          fileName: metadata.file_name,
          storageBucket: metadata.storage_bucket,
          sourcePath: metadata.source_path,
          url: metadata.url ?? metadata.source_web_url,
          createdAt: metadata.created_at,
        }
      : null,
    ocr: {
      ready: ocrTextReady,
      textLength: extractedText.length,
      textPreview: textPreview(extractedText),
    },
    vision: {
      ready: visionReady,
      pageCount: pageRows.length,
      pages: pageRows.map((page) => ({
        pageNumber: page.page_number,
        sheetNumber: page.sheet_number,
        sheetTitle: page.sheet_title,
        discipline: page.discipline,
        scale: page.scale,
        detailReferences: page.detail_references ?? [],
        impliedSubmittals: page.implied_submittals ?? [],
        notesAndRequirements: page.notes_and_requirements ?? [],
        aiSummary: page.ai_summary,
        rawExtraction: page.raw_extraction,
        visionModel: page.vision_model,
        processedAt: page.processed_at,
      })),
    },
    retrieval: {
      ready: embeddedReady,
      chunkCount: chunkRows.length,
      chunks: chunkRows.slice(0, 5).map((chunk) => ({
        chunkIndex: chunk.chunk_index,
        docType: null,
        textPreview: textPreview(chunk.text, 800),
      })),
    },
    readiness: {
      state,
      ocrTextReady,
      visionReady,
      embeddedReady,
      aiReviewReady: state === "ready" || state === "partial",
      reasons: readinessReasons({
        hasMetadata: Boolean(metadata),
        metadataStatus: metadata?.status ?? null,
        ocrTextReady,
        visionReady,
        embeddedReady,
        pageCount: pageRows.length,
        chunkCount: chunkRows.length,
      }),
    },
  });
});
