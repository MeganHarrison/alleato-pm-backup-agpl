import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { z } from "zod";
import { apiErrorResponse } from "@/lib/api-error";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";

const createDocumentSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().nullable().optional(),
  folder: z.string().nullable().optional().default("Root"),
  file_name: z.string().min(1, "File name is required"),
  file_url: z.string().min(1, "File URL is required"),
  file_size: z.number().nullable().optional(),
  content_type: z.string().nullable().optional(),
  version: z.number().nullable().optional().default(1),
  status: z.enum(["Draft", "Published", "Superseded", "Archived"]).optional().default("Draft"),
  category: z.string().nullable().optional(),
  is_private: z.boolean().nullable().optional().default(false),
  uploaded_by: z.string().nullable().optional(),
  reviewed_by: z.string().nullable().optional(),
  reviewed_at: z.string().nullable().optional(),
  storage_bucket: z.string().nullable().optional(),
  storage_path: z.string().nullable().optional(),
});

const MAX_PROJECT_DOCUMENT_UPLOAD_BYTES = 100 * 1024 * 1024;
const DOCUMENTS_BUCKET = "documents";

type CreateDocumentValues = z.infer<typeof createDocumentSchema>;

function safeStorageFileName(fileName: string): string {
  const cleaned = fileName
    .replace(/[/\\?%*:|"<>]/g, "-")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned || "document";
}

function formValue(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

async function parseCreateDocumentRequest(
  request: Request,
  projectId: number,
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<{
  values: CreateDocumentValues;
  uploadedStoragePath: string | null;
}> {
  const contentType = request.headers.get("content-type") ?? "";

  if (!contentType.includes("multipart/form-data")) {
    const body = await request.json();
    return {
      values: createDocumentSchema.parse(body),
      uploadedStoragePath: null,
    };
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    throw new GuardrailError({
      code: "INVALID_PAYLOAD",
      where: "projects/[projectId]/documents#POST",
      message: "Select a file before uploading.",
      status: 400,
    });
  }

  if (file.size <= 0) {
    throw new GuardrailError({
      code: "INVALID_PAYLOAD",
      where: "projects/[projectId]/documents#POST",
      message: "The selected file is empty.",
      status: 400,
    });
  }

  if (file.size > MAX_PROJECT_DOCUMENT_UPLOAD_BYTES) {
    throw new GuardrailError({
      code: "INVALID_PAYLOAD",
      where: "projects/[projectId]/documents#POST",
      message: "Project document uploads are limited to 100 MB.",
      status: 413,
    });
  }

  const safeFileName = safeStorageFileName(file.name);
  const storagePath = `projects/${projectId}/documents/${crypto.randomUUID()}-${safeFileName}`;
  const fileBuffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .upload(storagePath, fileBuffer, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });

  if (uploadError) {
    throw new GuardrailError({
      code: "UPSTREAM_FAILURE",
      where: "projects/[projectId]/documents#POST",
      message: `Failed to upload document to storage: ${uploadError.message}`,
      status: 502,
    });
  }

  return {
    uploadedStoragePath: storagePath,
    values: createDocumentSchema.parse({
      title: formValue(formData, "title") ?? safeFileName,
      description: formValue(formData, "description") ?? null,
      folder: formValue(formData, "folder") ?? "Root",
      file_name: safeFileName,
      file_url: `supabase://${DOCUMENTS_BUCKET}/${storagePath}`,
      file_size: file.size,
      content_type: file.type || "application/octet-stream",
      status: formValue(formData, "status") ?? "Draft",
      category: formValue(formData, "category") ?? null,
      is_private: formValue(formData, "is_private") === "true",
      storage_bucket: DOCUMENTS_BUCKET,
      storage_path: storagePath,
    }),
  };
}

// =============================================================================
// GET - List documents with filters
// =============================================================================

export const GET = withApiGuardrails(
  "projects/[projectId]/documents#GET",
  async ({ request, params }) => {
  
    const { projectId } = await params;
    const supabase = await createClient();

    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/documents#GET", message: "Authentication required." });
    }

    const { searchParams } = new URL(request.url);
    const folder = searchParams.get("folder");
    const status = searchParams.get("status");
    const category = searchParams.get("category");
    const search = searchParams.get("search");

    let query = supabase
      .from("project_documents")
      .select("*")
      .eq("project_id", Number(projectId))
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (folder) {
      query = query.eq("folder", folder);
    }

    if (status) {
      query = query.eq("status", status);
    }

    if (category) {
      query = query.eq("category", category);
    }

    if (search) {
      query = query.or(
        `title.ilike.%${search}%,file_name.ilike.%${search}%,description.ilike.%${search}%`,
      );
    }

    const { data, error } = await query;

    if (error) {
      return apiErrorResponse(error);
    }

    return NextResponse.json(data ?? []);
    },
);

// =============================================================================
// POST - Create a document record
// =============================================================================

export const POST = withApiGuardrails(
  "projects/[projectId]/documents#POST",
  async ({ request, params }) => {
    const { projectId } = await params;
    const numericProjectId = Number(projectId);
    const supabase = await createClient();

    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/documents#POST", message: "Authentication required." });
    }

    const { values: validated, uploadedStoragePath } =
      await parseCreateDocumentRequest(request, numericProjectId, supabase);

    const { data, error } = await supabase
      .from("project_documents")
      .insert({
        ...validated,
        project_id: numericProjectId,
        created_by: user.id,
        uploaded_by: validated.uploaded_by ?? user.email,
      })
      .select()
      .single();

    if (error) {
      if (uploadedStoragePath) {
        const { error: cleanupError } = await supabase.storage
          .from(DOCUMENTS_BUCKET)
          .remove([uploadedStoragePath]);

        if (cleanupError) {
          console.error(
            JSON.stringify({
              event: "project_document_upload_cleanup_failed",
              project_id: numericProjectId,
              storage_bucket: DOCUMENTS_BUCKET,
              storage_path: uploadedStoragePath,
              error: cleanupError.message,
            }),
          );
        }
      }
      return apiErrorResponse(error);
    }

    return NextResponse.json(data, { status: 201 });
  },
);
