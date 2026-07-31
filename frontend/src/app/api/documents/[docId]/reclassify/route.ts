import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { getApiRouteUser } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/documents/[docId]/reclassify
 * Re-file a document into a category from the project documents browser.
 *
 * Scoped + loud by design: the caller must be authenticated, the document must
 * belong to the given project, and the update must affect exactly one row — a
 * 0-row update returns a real error instead of a false success (the bug that
 * made drag-to-reclassify silently no-op). Uses the service client so that
 * re-filing works for any authenticated team member regardless of the
 * row-level membership policies on document_metadata; the project scope
 * (id = docId AND project_id = projectId) is the access boundary.
 */
export const PATCH = withApiGuardrails<{ docId: string }>(
  "documents/[docId]/reclassify#PATCH",
  async ({ request, params }) => {
    const { docId } = await params;

    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "documents/[docId]/reclassify#PATCH",
        message: "Authentication required.",
      });
    }

    const body = (await request.json().catch(() => null)) as {
      category?: string | null;
      projectId?: number;
    } | null;

    if (!body || typeof body.projectId !== "number" || !Number.isInteger(body.projectId)) {
      throw new GuardrailError({
        code: "BAD_REQUEST",
        where: "documents/[docId]/reclassify#PATCH",
        message: "A numeric projectId is required.",
        status: 400,
      });
    }

    const category =
      body.category === null || body.category === undefined
        ? null
        : String(body.category).trim();
    if (typeof category === "string" && category.length > 100) {
      throw new GuardrailError({
        code: "BAD_REQUEST",
        where: "documents/[docId]/reclassify#PATCH",
        message: "category must be 100 characters or fewer.",
        status: 400,
      });
    }

    // Category-only update via SECURITY DEFINER RPC. The RPC applies the
    // sanctioned transaction-local bypass for the Outlook incident guard
    // (block_outlook_ingestion_during_incident) so re-filing works for
    // Outlook-sourced docs, while still blocking every other unsanctioned write.
    // It returns the number of rows updated; 0 means the doc isn't in this project.
    // `reclassify_document_category` is a SECURITY DEFINER RPC applied directly
    // to the DB (incident remediation) and not yet in the generated types, so
    // call it through a narrowly-typed view of the client (no `any`).
    const service = createServiceClient() as unknown as {
      rpc: (
        fn: "reclassify_document_category",
        args: { p_doc_id: string; p_project_id: number; p_category: string | null },
      ) => PromiseLike<{ data: number | null; error: { message: string } | null }>;
    };
    const { data: rowsUpdated, error } = await service.rpc(
      "reclassify_document_category",
      {
        p_doc_id: docId,
        p_project_id: body.projectId,
        p_category: category || null,
      },
    );

    if (error) {
      throw new GuardrailError({
        code: "DB_ERROR",
        where: "documents/[docId]/reclassify#PATCH",
        message: error.message,
      });
    }

    if (typeof rowsUpdated !== "number" || rowsUpdated === 0) {
      throw new GuardrailError({
        code: "NOT_FOUND",
        where: "documents/[docId]/reclassify#PATCH",
        message: "Document not found in this project.",
        status: 404,
      });
    }

    return NextResponse.json({ success: true, category: category || null });
  },
);
