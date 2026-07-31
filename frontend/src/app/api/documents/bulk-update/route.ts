import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-error";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";

const ALLOWED_FIELDS = new Set([
  "title",
  "type",
  "category",
  "source",
  "status",
  "project_id",
  "tags",
  "access_level",
]);

const MAX_BULK_SIZE = 500;

export const PATCH = withApiGuardrails(
  "documents/bulk-update#PATCH",
  async ({ request }) => {
    const supabase = await createClient();
    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "documents/bulk-update#PATCH",
        message: "Authentication required.",
      });
    }

    const body = await request.json();
    const docIds = body?.doc_ids;
    const fields = body?.fields;

    if (!Array.isArray(docIds) || docIds.length === 0) {
      return NextResponse.json(
        { error: "doc_ids must be a non-empty array" },
        { status: 400 },
      );
    }

    if (docIds.length > MAX_BULK_SIZE) {
      return NextResponse.json(
        { error: `Cannot update more than ${MAX_BULK_SIZE} records at once` },
        { status: 400 },
      );
    }

    if (!docIds.every((id) => typeof id === "string" && id.length > 0)) {
      return NextResponse.json(
        { error: "doc_ids must be strings" },
        { status: 400 },
      );
    }

    if (!fields || typeof fields !== "object") {
      return NextResponse.json(
        { error: "fields object is required" },
        { status: 400 },
      );
    }

    const updates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(fields)) {
      if (ALLOWED_FIELDS.has(key)) {
        updates[key] = value;
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

        if (projectError) return apiErrorResponse(projectError);
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

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 },
      );
    }

    const { error, count } = await supabase
      .from("document_metadata")
      .update(updates, { count: "exact" })
      .in("id", docIds);

    if (error) return apiErrorResponse(error);

    return NextResponse.json({
      success: true,
      updated: count ?? docIds.length,
    });
  },
);
