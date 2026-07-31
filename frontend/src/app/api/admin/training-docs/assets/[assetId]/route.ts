export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { parseJsonBody, withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import {
  getTrainingDocAsset,
  updateTrainingDocAssetSchema,
} from "@/lib/training-docs/server";

import { requireTrainingDocsAdmin } from "../../_shared";

const WHERE_PATCH = "admin/training-docs/assets/[assetId]#PATCH";
const WHERE_DELETE = "admin/training-docs/assets/[assetId]#DELETE";

export const PATCH = withApiGuardrails(
  WHERE_PATCH,
  async ({ request, params }) => {
    const { service } = await requireTrainingDocsAdmin(WHERE_PATCH);
    const assetId = params.assetId;
    const body = await parseJsonBody(
      request,
      updateTrainingDocAssetSchema,
      WHERE_PATCH,
    );

    const { error } = await service
      .from("training_doc_assets")
      .update(body)
      .eq("id", assetId);

    if (error) {
      throw new GuardrailError({
        code: "UPSTREAM_FAILURE",
        where: WHERE_PATCH,
        message: "Failed to update screenshot metadata.",
        status: 500,
        details: error.message,
      });
    }

    const asset = await getTrainingDocAsset(service, assetId);
    return NextResponse.json({ asset });
  },
);

export const DELETE = withApiGuardrails(WHERE_DELETE, async ({ params }) => {
  const { service } = await requireTrainingDocsAdmin(WHERE_DELETE);
  const assetId = params.assetId;
  const asset = await getTrainingDocAsset(service, assetId);

  if (!asset) {
    throw new GuardrailError({
      code: "NOT_FOUND",
      where: WHERE_DELETE,
      message: "Training doc asset not found.",
      status: 404,
    });
  }

  const { error: storageError } = await service.storage
    .from(asset.storage_bucket)
    .remove([asset.storage_path]);

  if (storageError) {
    throw new GuardrailError({
      code: "UPSTREAM_FAILURE",
      where: WHERE_DELETE,
      message: "Failed to remove screenshot asset from storage.",
      status: 500,
      details: storageError.message,
    });
  }

  const { error } = await service
    .from("training_doc_assets")
    .delete()
    .eq("id", assetId);

  if (error) {
    throw new GuardrailError({
      code: "UPSTREAM_FAILURE",
      where: WHERE_DELETE,
      message: "Failed to delete screenshot metadata.",
      status: 500,
      details: error.message,
    });
  }

  return NextResponse.json({ success: true });
});
