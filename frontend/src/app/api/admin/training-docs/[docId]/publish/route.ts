export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { getTrainingDocToolCategory } from "@/features/knowledge/app-knowledge";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import {
  publishTrainingDocToDocsSite,
  resolveDocsSiteRoot,
  type TrainingDocAssetPublishInput,
} from "@/lib/training-docs/docs-site";
import {
  getTrainingDoc,
  listPublishedTrainingDocs,
} from "@/lib/training-docs/server";

import { requireTrainingDocsAdmin } from "../../_shared";

const WHERE_POST = "admin/training-docs/[docId]/publish#POST";

export const POST = withApiGuardrails(WHERE_POST, async ({ params }) => {
  const { userId, service } = await requireTrainingDocsAdmin(WHERE_POST);
  const docId = params.docId;
  const doc = await getTrainingDoc(service, docId);

  if (!doc) {
    throw new GuardrailError({
      code: "NOT_FOUND",
      where: WHERE_POST,
      message: "Training doc not found.",
      status: 404,
    });
  }

  if (!doc.body_markdown.trim()) {
    throw new GuardrailError({
      code: "INVALID_PAYLOAD",
      where: WHERE_POST,
      message: "Add article content before publishing.",
      status: 400,
    });
  }

  try {
    const docsRoot = resolveDocsSiteRoot();
    const stepScreenshotAssetIds = new Set(
      doc.steps
        .map((step) => step.screenshot_asset_id)
        .filter((id): id is string => Boolean(id)),
    );
    const videoAssetIds = new Set(
      doc.assets
        .filter(
          (asset) =>
            asset.asset_type === "video" || asset.mime_type.startsWith("video/"),
        )
        .map((asset) => asset.id),
    );
    const sourceAssets =
      stepScreenshotAssetIds.size > 0 || videoAssetIds.size > 0
        ? doc.assets.filter(
            (asset) =>
              stepScreenshotAssetIds.has(asset.id) || videoAssetIds.has(asset.id),
          )
        : doc.assets;
    const assets = await Promise.all(
      sourceAssets.map(async (asset): Promise<TrainingDocAssetPublishInput> => {
        const { data, error } = await service.storage
          .from(asset.storage_bucket)
          .download(asset.storage_path);

        if (error || !data) {
          throw new Error(
            `Failed to download ${asset.file_name}: ${error?.message ?? "missing asset data"}`,
          );
        }

        return {
          fileName: asset.file_name,
          assetType:
            asset.asset_type === "video" || asset.mime_type.startsWith("video/")
              ? "video"
              : asset.asset_type === "image"
                ? "image"
                : "screenshot",
          caption: asset.caption,
          altText: asset.alt_text,
          mimeType: asset.mime_type,
          stepOrder: asset.step_order,
          bytes: new Uint8Array(await data.arrayBuffer()),
        };
      }),
    );
    const publishAssetsById = new Map(
      sourceAssets.map((asset, index) => [asset.id, assets[index]]),
    );
    const steps = doc.steps.map((step) => {
      const screenshot = step.screenshot_asset_id
        ? (publishAssetsById.get(step.screenshot_asset_id) ?? null)
        : null;

      return {
        title: step.title,
        instructionMarkdown: step.instruction_markdown,
        expectedResult: step.expected_result,
        sourceUrl: step.source_url,
        stepOrder: step.step_order,
        screenshot: screenshot
          ? {
              fileName: screenshot.fileName,
              caption: screenshot.caption,
              altText: screenshot.altText,
            }
          : null,
      };
    });

    const existingPublished = await listPublishedTrainingDocs(service);
    const withoutCurrent = existingPublished.filter(
      (item) => item.slug !== doc.slug,
    );
    const appToolCategory = getTrainingDocAppToolCategory(doc.metadata);
    const currentRecord = {
      title: doc.title,
      slug: doc.slug,
      summary: doc.summary,
      audience: doc.audience,
      status: "published",
      sourceRoute: doc.source_route,
      publishedDocPath: `${doc.target_collection}/${doc.slug}.mdx`,
      lastPublishedAt: new Date().toISOString(),
      appToolCategory,
    };
    const resolvedToolCategory = getTrainingDocToolCategory(currentRecord);
    if (!resolvedToolCategory) {
      throw new GuardrailError({
        code: "INVALID_PAYLOAD",
        where: WHERE_POST,
        message: "Choose an app tool category before publishing.",
        status: 400,
        details:
          "The training doc has no metadata appToolCategory and its source route does not match a known app knowledge tool.",
      });
    }

    const result = await publishTrainingDocToDocsSite(
      docsRoot,
      {
        title: doc.title,
        slug: doc.slug,
        summary: doc.summary,
        audience: doc.audience,
        status: doc.status,
        sourceRoute: doc.source_route,
        reviewNotes: doc.review_notes,
        bodyMarkdown: doc.body_markdown,
        targetCollection: doc.target_collection,
        assets,
        steps,
      },
      [...withoutCurrent, currentRecord],
    );

    const publishedAt = new Date().toISOString();
    const { error: updateError } = await service
      .from("training_docs")
      .update({
        status: "published",
        published_doc_path: result.publishedDocPath,
        last_published_at: publishedAt,
        last_publish_error: null,
        updated_by: userId,
      })
      .eq("id", docId);

    if (updateError) {
      throw new Error(
        `Training doc published, but Supabase could not record the publish state: ${updateError.message}`,
      );
    }

    const updated = await getTrainingDoc(service, docId);
    return NextResponse.json({
      doc: updated,
      publish: {
        docPath: result.publishedDocPath,
        indexPath: result.indexPath,
        assetPaths: result.assetPaths,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown publish error.";
    await service
      .from("training_docs")
      .update({
        last_publish_error: message,
        updated_by: userId,
      })
      .eq("id", docId);

    if (error instanceof GuardrailError) {
      throw error;
    }

    throw new GuardrailError({
      code: "UPSTREAM_FAILURE",
      where: WHERE_POST,
      message: "Failed to publish the training doc to the docs site.",
      status: 500,
      details: message,
    });
  }
});

function getTrainingDocAppToolCategory(metadata: Record<string, unknown>): string | null {
  const value = metadata.appToolCategory;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
