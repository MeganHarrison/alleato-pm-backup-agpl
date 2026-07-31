import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { apiErrorResponse } from "@/lib/api-error";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

interface RouteParams {
  params: Promise<{ projectId: string; documentId: string }>;
}

const updateDocumentSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  folder: z.string().nullable().optional(),
  file_name: z.string().min(1).optional(),
  file_url: z.string().min(1).optional(),
  file_size: z.number().nullable().optional(),
  content_type: z.string().nullable().optional(),
  version: z.number().nullable().optional(),
  status: z.enum(["Draft", "Published", "Superseded", "Archived"]).optional(),
  category: z.string().nullable().optional(),
  is_private: z.boolean().nullable().optional(),
  reviewed_by: z.string().nullable().optional(),
  reviewed_at: z.string().nullable().optional(),
});

type ProjectDocumentDeleteRow = {
  id: number;
  storage_bucket: string | null;
  storage_path: string | null;
};

// =============================================================================
// GET - Fetch a single document
// =============================================================================

export const GET = withApiGuardrails(
  "projects/[projectId]/documents/[documentId]#GET",
  async ({ request, params }) => {
  
    const { projectId, documentId } = await params;
    const supabase = await createClient();

    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/documents/[documentId]#GET", message: "Authentication required." });
    }

    const { data, error } = await supabase
      .from("project_documents")
      .select("*")
      .eq("id", Number(documentId))
      .eq("project_id", Number(projectId))
      .is("deleted_at", null)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        throw new GuardrailError({
          code: "NOT_FOUND",
          where: "projects/[projectId]/documents/[documentId]#GET",
          message: "Document not found.",
          status: 404,
        });
      }
      return apiErrorResponse(error);
    }

    return NextResponse.json(data);
    },
);

// =============================================================================
// PUT - Update a document
// =============================================================================

export const PUT = withApiGuardrails(
  "projects/[projectId]/documents/[documentId]#PUT",
  async ({ request, params }) => {
  
    const { projectId, documentId } = await params;
    const supabase = await createClient();

    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/documents/[documentId]#PUT", message: "Authentication required." });
    }

    const body = await request.json();
    const validated = updateDocumentSchema.parse(body);

    const { data, error } = await supabase
      .from("project_documents")
      .update({
        ...validated,
        updated_at: new Date().toISOString(),
      })
      .eq("id", Number(documentId))
      .eq("project_id", Number(projectId))
      .is("deleted_at", null)
      .select()
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        throw new GuardrailError({
          code: "NOT_FOUND",
          where: "projects/[projectId]/documents/[documentId]#PUT",
          message: "Document not found.",
          status: 404,
        });
      }
      return apiErrorResponse(error);
    }

    return NextResponse.json(data);
    },
);

// =============================================================================
// DELETE - Soft delete a document
// =============================================================================

export const DELETE = withApiGuardrails(
  "projects/[projectId]/documents/[documentId]#DELETE",
  async ({ request, params }) => {
    const { projectId, documentId } = await params;
    const supabase = await createClient();

    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/documents/[documentId]#DELETE", message: "Authentication required." });
    }

    const { data: document, error: lookupError } = await supabase
      .from("project_documents")
      .select("id, storage_bucket, storage_path")
      .eq("id", Number(documentId))
      .eq("project_id", Number(projectId))
      .is("deleted_at", null)
      .single<ProjectDocumentDeleteRow>();

    if (lookupError) {
      if (lookupError.code === "PGRST116") {
        throw new GuardrailError({
          code: "NOT_FOUND",
          where: "projects/[projectId]/documents/[documentId]#DELETE",
          message: "Document not found.",
          status: 404,
        });
      }
      return apiErrorResponse(lookupError);
    }

    if (document.storage_bucket && document.storage_path) {
      const serviceClient = createServiceClient();
      const { error: storageDeleteError } = await serviceClient.storage
        .from(document.storage_bucket)
        .remove([document.storage_path]);

      if (storageDeleteError) {
        throw new GuardrailError({
          code: "UPSTREAM_FAILURE",
          where: "projects/[projectId]/documents/[documentId]#DELETE",
          message: `Failed to remove document file from storage: ${storageDeleteError.message}`,
          status: 502,
        });
      }
    }

    const { data, error } = await supabase
      .from("project_documents")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", Number(documentId))
      .eq("project_id", Number(projectId))
      .is("deleted_at", null)
      .select()
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        throw new GuardrailError({
          code: "NOT_FOUND",
          where: "projects/[projectId]/documents/[documentId]#DELETE",
          message: "Document not found.",
          status: 404,
        });
      }
      return apiErrorResponse(error);
    }

    return NextResponse.json({ success: true, id: data.id });
    },
);
