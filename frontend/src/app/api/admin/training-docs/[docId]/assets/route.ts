export const dynamic = "force-dynamic";

import path from "node:path";
import { NextResponse } from "next/server";

import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import {
  slugifyTrainingDoc,
  TRAINING_DOC_STORAGE_BUCKET,
} from "@/lib/training-docs/constants";
import { getTrainingDocAsset } from "@/lib/training-docs/server";

import { requireTrainingDocsAdmin } from "../../_shared";

const WHERE_POST = "admin/training-docs/[docId]/assets#POST";

export const POST = withApiGuardrails(
  WHERE_POST,
  async ({ request, params }) => {
    const { userId, service } = await requireTrainingDocsAdmin(WHERE_POST);
    const docId = params.docId;
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      throw new GuardrailError({
        code: "INVALID_PAYLOAD",
        where: WHERE_POST,
        message: "An image file is required.",
        status: 400,
      });
    }

    if (!file.type.startsWith("image/")) {
      throw new GuardrailError({
        code: "INVALID_PAYLOAD",
        where: WHERE_POST,
        message: "Training doc assets must be image files.",
        status: 400,
      });
    }

    const caption = String(formData.get("caption") ?? "").trim() || null;
    const altText = String(formData.get("alt_text") ?? "").trim() || null;
    const stepOrderRaw = String(formData.get("step_order") ?? "").trim();
    const stepOrder = stepOrderRaw
      ? Number.parseInt(stepOrderRaw, 10)
      : Number.NaN;

    const { data: countRows, error: countError } = await service
      .from("training_doc_assets")
      .select("step_order")
      .eq("training_doc_id", docId)
      .order("step_order", { ascending: false })
      .limit(1);

    if (countError) {
      throw new GuardrailError({
        code: "UPSTREAM_FAILURE",
        where: WHERE_POST,
        message: "Failed to determine the next screenshot order.",
        status: 500,
        details: countError.message,
      });
    }

    const resolvedOrder = Number.isFinite(stepOrder)
      ? stepOrder
      : (countRows?.[0]?.step_order ?? -1) + 1;

    const ext = path.extname(file.name) || ".png";
    const baseName =
      slugifyTrainingDoc(path.basename(file.name, ext)) || "asset";
    const storagePath = `training-docs/${docId}/${Date.now()}-${baseName}${ext.toLowerCase()}`;
    const bytes = new Uint8Array(await file.arrayBuffer());

    const { error: uploadError } = await service.storage
      .from(TRAINING_DOC_STORAGE_BUCKET)
      .upload(storagePath, bytes, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      throw new GuardrailError({
        code: "UPSTREAM_FAILURE",
        where: WHERE_POST,
        message: "Failed to upload the screenshot asset.",
        status: 500,
        details: uploadError.message,
      });
    }

    const { data, error } = await service
      .from("training_doc_assets")
      .insert({
        training_doc_id: docId,
        created_by: userId,
        storage_bucket: TRAINING_DOC_STORAGE_BUCKET,
        storage_path: storagePath,
        file_name: `${baseName}${ext.toLowerCase()}`,
        mime_type: file.type,
        caption,
        alt_text: altText,
        step_order: resolvedOrder,
      })
      .select("id")
      .single();

    if (error || !data) {
      await service.storage
        .from(TRAINING_DOC_STORAGE_BUCKET)
        .remove([storagePath]);
      throw new GuardrailError({
        code: "UPSTREAM_FAILURE",
        where: WHERE_POST,
        message: "Failed to save screenshot metadata.",
        status: 500,
        details: error?.message,
      });
    }

    const asset = await getTrainingDocAsset(service, data.id);
    return NextResponse.json({ asset });
  },
);
