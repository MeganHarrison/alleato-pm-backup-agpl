export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { parseJsonBody, withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import {
  getTrainingDoc,
  mergeTrainingDocMetadata,
  normalizeTrainingDocInput,
  updateTrainingDocSchema,
} from "@/lib/training-docs/server";

import { requireTrainingDocsAdmin } from "../_shared";

const WHERE_PATCH = "admin/training-docs/[docId]#PATCH";
const WHERE_DELETE = "admin/training-docs/[docId]#DELETE";

export const PATCH = withApiGuardrails(
  WHERE_PATCH,
  async ({ request, params }) => {
    const { userId, service } = await requireTrainingDocsAdmin(WHERE_PATCH);
    const body = await parseJsonBody(
      request,
      updateTrainingDocSchema,
      WHERE_PATCH,
    );
    const docId = params.docId;

    if (body.id !== docId) {
      throw new GuardrailError({
        code: "INVALID_PAYLOAD",
        where: WHERE_PATCH,
        message: "Training doc id mismatch.",
        status: 400,
      });
    }

    const existingDoc = await getTrainingDoc(service, docId);
    if (!existingDoc) {
      throw new GuardrailError({
        code: "NOT_FOUND",
        where: WHERE_PATCH,
        message: "Training doc not found.",
        status: 404,
      });
    }

    const normalized = normalizeTrainingDocInput({
      title: body.title ?? existingDoc.title,
      slug: body.slug ?? existingDoc.slug,
      summary: body.summary ?? existingDoc.summary,
      body_markdown: body.body_markdown ?? existingDoc.body_markdown,
      audience: body.audience ?? existingDoc.audience,
      status: body.status ?? existingDoc.status,
      source_route: body.source_route ?? existingDoc.source_route,
      app_tool_category:
        body.app_tool_category ??
        getTrainingDocMetadataString(existingDoc.metadata, "appToolCategory"),
      review_notes: body.review_notes ?? existingDoc.review_notes,
      target_collection:
        body.target_collection ?? existingDoc.target_collection,
    });
    const { data, error } = await service
      .from("training_docs")
      .update({
        ...normalized,
        metadata: mergeTrainingDocMetadata(existingDoc.metadata, body),
        updated_by: userId,
      })
      .eq("id", docId)
      .select("*")
      .single();

    if (error) {
      const isUnique = error.code === "23505";
      throw new GuardrailError({
        code: isUnique ? "INVALID_PAYLOAD" : "UPSTREAM_FAILURE",
        where: WHERE_PATCH,
        message: isUnique
          ? "A training doc with this slug already exists."
          : "Failed to update training doc.",
        status: isUnique ? 409 : 500,
        details: error.message,
      });
    }

    const doc = await getTrainingDoc(service, data.id);
    return NextResponse.json({ doc });
  },
);

function getTrainingDocMetadataString(
  metadata: Record<string, unknown>,
  key: string,
) {
  const value = metadata[key];
  return typeof value === "string" ? value : null;
}

export const DELETE = withApiGuardrails(WHERE_DELETE, async ({ params }) => {
  const { service } = await requireTrainingDocsAdmin(WHERE_DELETE);
  const docId = params.docId;
  const doc = await getTrainingDoc(service, docId);

  if (!doc) {
    throw new GuardrailError({
      code: "NOT_FOUND",
      where: WHERE_DELETE,
      message: "Training doc not found.",
      status: 404,
    });
  }

  for (const asset of doc.assets) {
    const { error: storageError } = await service.storage
      .from(asset.storage_bucket)
      .remove([asset.storage_path]);

    if (storageError) {
      throw new GuardrailError({
        code: "UPSTREAM_FAILURE",
        where: WHERE_DELETE,
        message: `Failed to remove asset ${asset.file_name} from storage.`,
        status: 500,
        details: storageError.message,
      });
    }
  }

  const { error } = await service
    .from("training_docs")
    .delete()
    .eq("id", docId);
  if (error) {
    throw new GuardrailError({
      code: "UPSTREAM_FAILURE",
      where: WHERE_DELETE,
      message: "Failed to delete training doc.",
      status: 500,
      details: error.message,
    });
  }

  return NextResponse.json({ success: true });
});
