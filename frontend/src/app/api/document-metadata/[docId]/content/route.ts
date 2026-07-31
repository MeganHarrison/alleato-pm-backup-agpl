import { NextResponse } from "next/server";

import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import {
  buildDocumentContentResponse,
  joinChunkText,
  normalizeDocumentText,
} from "@/lib/document-metadata/content-response";
import { createClient } from "@/lib/supabase/server";
import {
  createRagServiceClient,
  isRagDatabaseReadsEnabled,
} from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

export const GET = withApiGuardrails<{ docId: string }>(
  "document-metadata/[docId]/content#GET",
  async ({ params }) => {
    const { docId } = params;
    const checkedSources: string[] = ["document_metadata.content"];

    if (!docId) {
      throw new GuardrailError({
        code: "INVALID_INPUT",
        where: "document-metadata/[docId]/content#GET",
        message: "Document metadata id is required.",
        status: 400,
      });
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("document_metadata")
      .select("id, content")
      .eq("id", docId)
      .maybeSingle();

    if (error) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where: "document-metadata/[docId]/content#GET",
        message: "Failed to load document content.",
        details: error.message,
        status: 500,
      });
    }

    if (!data) {
      throw new GuardrailError({
        code: "NOT_FOUND",
        where: "document-metadata/[docId]/content#GET",
        message: "Document metadata record was not found.",
        status: 404,
      });
    }

    const appContent = normalizeDocumentText(data.content);
    if (appContent) {
      return NextResponse.json(
        buildDocumentContentResponse({
          id: data.id,
          content: appContent,
          contentSource: "document_metadata.content",
          checkedSources,
        }),
      );
    }

    if (isRagDatabaseReadsEnabled()) {
      let ragSupabase: ReturnType<typeof createRagServiceClient>;
      try {
        ragSupabase = createRagServiceClient();
      } catch (error) {
        throw new GuardrailError({
          code: "CONFIGURATION_ERROR",
          where: "document-metadata/[docId]/content#GET",
          message: "RAG content lookup is enabled but the RAG database client is not configured.",
          details: error instanceof Error ? error.message : "Unknown RAG client configuration error.",
          status: 500,
        });
      }

      checkedSources.push("rag_document_metadata.content", "rag_document_metadata.raw_text");
      const { data: ragById, error: ragByIdError } = await ragSupabase
        .from("rag_document_metadata")
        .select("id, content, raw_text")
        .eq("id", docId)
        .maybeSingle();

      if (ragByIdError) {
        throw new GuardrailError({
          code: "INTERNAL_ERROR",
          where: "document-metadata/[docId]/content#GET",
          message: "Failed to load RAG document content.",
          details: ragByIdError.message,
          status: 500,
        });
      }

      let ragDocument = ragById;
      if (!ragDocument) {
        const { data: ragByAppId, error: ragByAppIdError } = await ragSupabase
          .from("rag_document_metadata")
          .select("id, content, raw_text")
          .eq("app_document_id", docId)
          .maybeSingle();

        if (ragByAppIdError) {
          throw new GuardrailError({
            code: "INTERNAL_ERROR",
            where: "document-metadata/[docId]/content#GET",
            message: "Failed to load RAG document content by app document id.",
            details: ragByAppIdError.message,
            status: 500,
          });
        }
        ragDocument = ragByAppId;
      }

      const ragMetadataContent = normalizeDocumentText(ragDocument?.content);
      const ragRawText = normalizeDocumentText(ragDocument?.raw_text);
      const ragContent = ragMetadataContent ?? ragRawText;
      const ragContentSource = ragMetadataContent
        ? "rag_document_metadata.content"
        : "rag_document_metadata.raw_text";

      if (ragContent) {
        return NextResponse.json(
          buildDocumentContentResponse({
            id: data.id,
            content: ragContent,
            contentSource: ragContentSource,
            checkedSources,
          }),
        );
      }

      checkedSources.push("document_chunks.text");
      const { data: chunks, error: chunksError } = await ragSupabase
        .from("document_chunks")
        .select("text, chunk_index")
        .eq("document_id", ragDocument?.id ?? docId)
        .order("chunk_index", { ascending: true });

      if (chunksError) {
        throw new GuardrailError({
          code: "INTERNAL_ERROR",
          where: "document-metadata/[docId]/content#GET",
          message: "Failed to load RAG document chunks.",
          details: chunksError.message,
          status: 500,
        });
      }

      const chunkContent = joinChunkText(chunks ?? []);
      if (chunkContent) {
        return NextResponse.json(
          buildDocumentContentResponse({
            id: data.id,
            content: chunkContent,
            contentSource: "document_chunks.text",
            checkedSources,
          }),
        );
      }
    } else {
      checkedSources.push("RAG database reads disabled");
    }

    return NextResponse.json(
      buildDocumentContentResponse({
        id: data.id,
        content: null,
        contentSource: null,
        checkedSources,
      }),
    );
  },
);
