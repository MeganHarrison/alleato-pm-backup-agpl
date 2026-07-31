import { GuardrailError } from "@/lib/guardrails/errors";
import {
  createRagServiceClient,
  createServiceClient,
} from "@/lib/supabase/service";

const WHERE = "submittal-linked-drawings-service";

type AnyRow = Record<string, unknown>;

export type LinkedDrawingWithReadiness = {
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

function compactText(value: string | null | undefined, maxLength = 900) {
  const text = value?.trim() ?? "";
  if (!text) return null;
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

export function parseSubmittalProjectId(projectId: string) {
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

/**
 * Standalone service for the submittal ↔ drawing linking feature.
 *
 * These helpers were previously bundled inside the (now removed) submittal AI
 * review service. They are kept here because linking drawings to a submittal is
 * a first-class capability that is independent of AI review.
 */
export function createSubmittalLinkedDrawingsService(_userId: string) {
  const service = createServiceClient();
  const rag = createRagServiceClient();

  const parseProjectId = parseSubmittalProjectId;

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

  return {
    parseProjectId,
    getScopedSubmittal,
    getDrawingByScope,
    listLinkedDrawings,
  };
}
