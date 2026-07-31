import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { v4 as uuidv4 } from "uuid";
import { triggerDocumentPipeline } from "@/lib/documents/pipeline-trigger";
import { logger } from "@/lib/logger";

/**
 * POST /api/documents/upload
 *
 * Upload a document (PDF, DOCX, TXT, MD) for RAG ingestion.
 *
 * Flow:
 *   1. Upload file to Supabase storage bucket "documents"
 *   2. Create a document_metadata row
 *   3. DB trigger auto-creates fireflies_ingestion_jobs row
 *   4. API explicitly queues the FastAPI pipeline
 *   5. Pipeline runs: document_parser → embedder → extractor
 *
 * FormData fields:
 *   - file: File (required)
 *   - title: string (optional, defaults to file name)
 *   - category: string (optional, defaults to "document")
 *   - project_id: number (optional, associate with a project)
 *   - tags: string (optional, comma-separated)
 */
export const POST = withApiGuardrails(
  "documents/upload#POST",
  async ({ request }) => {
  
    const supabase = await createClient();
    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "documents/upload#POST", message: "Authentication required." });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 },
      );
    }

    // Validate file type
    const allowedExtensions = [
      ".pdf",
      ".docx",
      ".doc",
      ".txt",
      ".md",
      ".markdown",
    ];
    const fileName = file.name.toLowerCase();
    const ext = fileName.substring(fileName.lastIndexOf("."));
    if (!allowedExtensions.includes(ext)) {
      return NextResponse.json(
        {
          error: `Unsupported file type: ${ext}. Allowed: ${allowedExtensions.join(", ")}`,
        },
        { status: 400 },
      );
    }

    // Validate file size (50MB max)
    const MAX_SIZE = 50 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "File too large. Maximum 50MB." },
        { status: 400 },
      );
    }

    // Extract form fields
    const title =
      (formData.get("title") as string) ||
      file.name.replace(/\.[^/.]+$/, ""); // Remove extension
    const category = (formData.get("category") as string) || "document";
    const projectIdStr = formData.get("project_id") as string;
    const projectId = projectIdStr ? parseInt(projectIdStr, 10) : null;
    const tagsStr = formData.get("tags") as string;
    const tags = tagsStr
      ? tagsStr.split(",").map((t) => t.trim()).filter(Boolean)
      : [];

    // Generate unique file path in storage
    const metadataId = uuidv4();
    const storagePath = `uploads/${metadataId}/${file.name}`;

    // 1. Upload file to Supabase storage
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const { error: uploadError } = await supabase.storage
      .from("documents")
      .upload(storagePath, fileBuffer, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });

    if (uploadError) {
      logger.error({ msg: "Storage upload error:", data: uploadError });
      return NextResponse.json(
        { error: `Failed to upload file: ${uploadError.message}` },
        { status: 500 },
      );
    }

    // 2. Create document_metadata row
    const { error: insertError } = await supabase
      .from("document_metadata")
      .insert({
        id: metadataId,
        title,
        category,
        type: "document",
        source: "upload",
        status: "uploaded",
        file_name: file.name,
        file_path: storagePath,
        storage_bucket: "documents",
        project_id: projectId,
        date: new Date().toISOString().split("T")[0],
      })
      .select()
      .single();

    if (insertError) {
      logger.error({ msg: "Metadata insert error:", data: insertError });
      // Clean up uploaded file
      await supabase.storage.from("documents").remove([storagePath]);
      return NextResponse.json(
        { error: `Failed to create metadata: ${insertError.message}` },
        { status: 500 },
      );
    }

    const pipeline = await triggerDocumentPipeline(metadataId);

    return NextResponse.json({
      success: true,
      document: {
        id: metadataId,
        title,
        category,
        fileName: file.name,
        fileSize: file.size,
        storagePath,
        projectId,
        tags,
        status: "uploaded",
        pipelineStatus: pipeline.queued ? "queued" : "enqueue_failed",
      },
      pipelineQueued: pipeline.queued,
      pipelineMessage: pipeline.message,
    });
    },
);
