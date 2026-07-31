import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-error";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";

const ALLOWED_FIELDS = new Set([
  "title",
  "type",
  "document_type",
  "category",
  "source",
  "status",
  "project_id",
  "tags",
  "access_level",
]);

export const PATCH = withApiGuardrails<{ docId: string }>(
  "documents/[docId]/assign-project#PATCH",
  async ({ request, params }) => {
    const supabase = await createClient();
    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "documents/[docId]/assign-project#PATCH",
        message: "Authentication required.",
      });
    }

    const { docId } = await params;
    const body = await request.json();

    // Filter to only allowed fields.
    const updates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(body)) {
      if (ALLOWED_FIELDS.has(key)) {
        updates[key] = value;
      }
    }

    if ("access_level" in updates) {
      const access = updates.access_level;
      if (access === null || access === "") {
        updates.access_level = null;
      } else if (typeof access !== "string") {
        return NextResponse.json(
          { error: "access_level must be a string or null" },
          { status: 400 },
        );
      } else {
        const trimmed = access.trim();
        updates.access_level = trimmed.length === 0 ? null : trimmed;
      }
    }

    if ("category" in updates) {
      const category = updates.category;
      if (category === null || category === "") {
        updates.category = null;
      } else if (typeof category !== "string") {
        return NextResponse.json(
          { error: "category must be a string or null" },
          { status: 400 },
        );
      } else {
        const trimmed = category.trim();
        if (trimmed.length === 0) {
          updates.category = null;
        } else if (trimmed.length > 100) {
          return NextResponse.json(
            { error: "category must be 100 characters or fewer" },
            { status: 400 },
          );
        } else {
          updates.category = trimmed;
        }
      }
    }

    if ("document_type" in updates) {
      const documentType = updates.document_type;
      if (documentType === null || documentType === "") {
        updates.document_type = null;
      } else if (typeof documentType !== "string") {
        return NextResponse.json(
          { error: "document_type must be a string or null" },
          { status: 400 },
        );
      } else {
        const trimmed = documentType.trim();
        if (trimmed.length === 0) {
          updates.document_type = null;
        } else if (trimmed.length > 100) {
          return NextResponse.json(
            { error: "document_type must be 100 characters or fewer" },
            { status: 400 },
          );
        } else {
          updates.document_type = trimmed;
        }
      }
    }

    if ("project_id" in updates) {
      const projectId = updates.project_id;
      if (projectId === null || projectId === "") {
        updates.project_id = null;
        updates.project = null;
      } else if (typeof projectId === "number" && Number.isInteger(projectId)) {
        const { data: project, error: projectError } = await supabase
          .from("projects")
          .select("id, name")
          .eq("id", projectId)
          .single();

        if (projectError) {
          return apiErrorResponse(projectError);
        }

        if (!project) {
          return NextResponse.json(
            { error: "Selected project does not exist" },
            { status: 400 },
          );
        }

        updates.project_id = project.id;
        updates.project = project.name;
      } else {
        return NextResponse.json(
          { error: "project_id must be an integer or null" },
          { status: 400 },
        );
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 },
      );
    }

    const { data: updated, error } = await supabase
      .from("document_metadata")
      .update(updates)
      .eq("id", docId)
      .select("id");

    if (error) {
      return apiErrorResponse(error);
    }

    // Fail loudly: an RLS-blocked or non-existent row updates 0 rows WITHOUT
    // an error, which previously returned a false success.
    if (!updated || updated.length === 0) {
      return NextResponse.json(
        {
          error:
            "Document was not updated. It may not exist, or you may not have permission to change it.",
        },
        { status: 403 },
      );
    }

    return NextResponse.json({ success: true });
  },
);
