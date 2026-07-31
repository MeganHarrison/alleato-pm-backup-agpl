import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, Json } from "@/types/database.types";

import {
  TRAINING_DOC_ASSET_TYPES,
  TRAINING_DOC_AUDIENCES,
  TRAINING_DOC_DEFAULT_COLLECTION,
  TRAINING_DOC_QA_STATUSES,
  TRAINING_DOC_STATUSES,
  normalizeTrainingDocSlug,
} from "./constants";
import type {
  TrainingDocAsset,
  TrainingDocRecord,
  TrainingDocStep,
  TrainingDocWithAssets,
} from "./types";

type ServiceClient = SupabaseClient<Database>;

export const createTrainingDocSchema = z.object({
  title: z.string().min(1, "Title is required."),
  slug: z.string().optional(),
  summary: z.string().nullable().optional(),
  body_markdown: z.string().default(""),
  audience: z.enum(TRAINING_DOC_AUDIENCES).default("internal"),
  status: z.enum(TRAINING_DOC_STATUSES).default("draft"),
  source_route: z.string().nullable().optional(),
  app_tool_category: z.string().nullable().optional(),
  review_notes: z.string().nullable().optional(),
  target_collection: z.string().default(TRAINING_DOC_DEFAULT_COLLECTION),
});

export const updateTrainingDocSchema = createTrainingDocSchema.extend({
  id: z.string().uuid(),
  title: z.string().min(1, "Title is required.").optional(),
  body_markdown: z.string().optional(),
  audience: z.enum(TRAINING_DOC_AUDIENCES).optional(),
  status: z.enum(TRAINING_DOC_STATUSES).optional(),
  target_collection: z.string().optional(),
});

export const updateTrainingDocAssetSchema = z.object({
  caption: z.string().nullable().optional(),
  alt_text: z.string().nullable().optional(),
  step_order: z.number().int().min(0).optional(),
});

export function normalizeTrainingDocInput(input: {
  title?: string;
  slug?: string | null;
  summary?: string | null;
  body_markdown?: string;
  audience?: string;
  status?: string;
  source_route?: string | null;
  tool_category?: string | null;
  tool_module?: string | null;
  task_key?: string | null;
  qa_status?: string | null;
  qa_notes?: string | null;
  app_tool_category?: string | null;
  review_notes?: string | null;
  target_collection?: string | null;
}) {
  const title = input.title?.trim() ?? "";
  const slug = normalizeTrainingDocSlug(input.slug ?? "", title);
  if (!slug) {
    throw new Error("A slug could not be generated. Add a title or slug.");
  }
  const qaStatus = input.qa_status?.trim() ?? "";
  // The `qa_status` column is NOT NULL in the database — fall back to the
  // default status rather than null when the value is missing or invalid.
  const normalizedQaStatus = (TRAINING_DOC_QA_STATUSES as readonly string[]).includes(
    qaStatus,
  )
    ? (qaStatus as (typeof TRAINING_DOC_QA_STATUSES)[number])
    : TRAINING_DOC_QA_STATUSES[0];

  return {
    title,
    slug,
    summary: input.summary?.trim() || null,
    body_markdown: input.body_markdown ?? "",
    audience: input.audience ?? "internal",
    status: input.status ?? "draft",
    tool_category: input.tool_category?.trim() || null,
    tool_module: input.tool_module?.trim() || null,
    task_key: input.task_key?.trim() || null,
    qa_status: normalizedQaStatus,
    qa_notes: input.qa_notes?.trim() || null,
    source_route: input.source_route?.trim() || null,
    review_notes: input.review_notes?.trim() || null,
    target_collection:
      input.target_collection?.trim() || TRAINING_DOC_DEFAULT_COLLECTION,
  };
}

export function mergeTrainingDocMetadata(
  currentMetadata: Record<string, unknown> | null | undefined,
  input: {
    app_tool_category?: string | null;
    tool_category?: string | null;
    tool_module?: string | null;
    task_key?: string | null;
    audit_status?: string | null;
    audit_notes?: string | null;
    blocker_type?: string | null;
    blocker_owner?: string | null;
    product_gap_issue_id?: string | null;
  },
) {
  const metadata: Record<string, Json> = {
    ...(currentMetadata as Record<string, Json>),
  };

  const assignText = (key: string, value?: string | null) => {
    if (value === undefined) return;
    if (value?.trim()) {
      metadata[key] = value.trim();
    } else {
      delete metadata[key];
    }
  };

  if ("app_tool_category" in input || "tool_category" in input) {
    const appToolCategory = (input.app_tool_category || input.tool_category)?.trim();
    assignText("appToolCategory", appToolCategory);
  }

  if ("tool_module" in input) {
    assignText("tutorialModule", input.tool_module);
  }

  if ("task_key" in input) {
    assignText("tutorialId", input.task_key);
  }

  if ("audit_status" in input) {
    assignText("lastParityStatus", input.audit_status);
  }

  if ("audit_notes" in input) {
    assignText("auditNotes", input.audit_notes);
  }

  if ("blocker_type" in input) {
    assignText("blockerType", input.blocker_type);
  }

  if ("blocker_owner" in input) {
    assignText("blockerOwner", input.blocker_owner);
  }

  if ("product_gap_issue_id" in input) {
    assignText("productGapIssueId", input.product_gap_issue_id);
  }

  return metadata as Json;
}

export async function listTrainingDocs(
  service: ServiceClient,
): Promise<TrainingDocWithAssets[]> {
  const { data: docs, error: docsError } = await service
    .from("training_docs")
    .select("*")
    .order("updated_at", { ascending: false });

  if (docsError) {
    throw new Error(`Failed to load training docs: ${docsError.message}`);
  }

  const docIds = (docs ?? []).map((doc) => doc.id);
  let assets: TrainingDocAsset[] = [];
  let steps: Omit<TrainingDocStep, "screenshot_asset">[] = [];
  if (docIds.length > 0) {
    const { data: assetRows, error: assetsError } = await service
      .from("training_doc_assets")
      .select("*")
      .in("training_doc_id", docIds)
      .order("step_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (assetsError) {
      throw new Error(
        `Failed to load training doc assets: ${assetsError.message}`,
      );
    }

    assets = await Promise.all(
      (assetRows ?? []).map(async (asset) => ({
        ...(asset as Omit<TrainingDocAsset, "signed_url">),
        signed_url: await getSignedUrl(
          service,
          asset.storage_bucket,
          asset.storage_path,
        ),
      })),
    );

    const { data: stepRows, error: stepsError } = await service
      .from("training_doc_steps")
      .select("*")
      .in("training_doc_id", docIds)
      .order("step_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (stepsError) {
      throw new Error(
        `Failed to load training doc steps: ${stepsError.message}`,
      );
    }

    steps = (stepRows ?? []) as Omit<TrainingDocStep, "screenshot_asset">[];
  }

  const assetsByDocId = new Map<string, TrainingDocAsset[]>();
  const assetsById = new Map<string, TrainingDocAsset>();
  for (const asset of assets) {
    const current = assetsByDocId.get(asset.training_doc_id) ?? [];
    current.push(asset);
    assetsByDocId.set(asset.training_doc_id, current);
    assetsById.set(asset.id, asset);
  }

  const stepsByDocId = new Map<string, TrainingDocStep[]>();
  for (const step of steps) {
    const current = stepsByDocId.get(step.training_doc_id) ?? [];
    current.push({
      ...step,
      screenshot_asset: step.screenshot_asset_id
        ? (assetsById.get(step.screenshot_asset_id) ?? null)
        : null,
    });
    stepsByDocId.set(step.training_doc_id, current);
  }

  return (docs ?? []).map((doc) => ({
    ...(doc as TrainingDocRecord),
    assets: assetsByDocId.get(doc.id) ?? [],
    steps: stepsByDocId.get(doc.id) ?? [],
  }));
}

export async function getTrainingDoc(
  service: ServiceClient,
  docId: string,
): Promise<TrainingDocWithAssets | null> {
  const docs = await listTrainingDocs(service);
  return docs.find((doc) => doc.id === docId) ?? null;
}

export async function getPublishedTrainingDocBySlug(
  service: ServiceClient,
  slug: string,
): Promise<TrainingDocWithAssets | null> {
  const docs = await listTrainingDocs(service);
  return (
    docs.find(
      (doc) =>
        doc.slug === slug &&
        doc.status === "published" &&
        Boolean(doc.published_doc_path),
    ) ?? null
  );
}

export async function listPublishedTrainingDocs(service: ServiceClient) {
  const { data, error } = await service
    .from("training_docs")
    .select(
      "title, slug, summary, audience, status, source_route, published_doc_path, last_published_at, metadata",
    )
    .eq("status", "published")
    .not("published_doc_path", "is", null)
    .order("title", { ascending: true });

  if (error) {
    throw new Error(`Failed to load published training docs: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    title: row.title,
    slug: row.slug,
    summary: row.summary,
    audience: row.audience,
    status: row.status,
    sourceRoute: row.source_route,
    publishedDocPath: row.published_doc_path!,
    lastPublishedAt: row.last_published_at,
    appToolCategory: getTrainingDocAppToolCategory(row.metadata),
  }));
}

function getTrainingDocAppToolCategory(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  const value = (metadata as Record<string, unknown>).appToolCategory;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function getTrainingDocAsset(
  service: ServiceClient,
  assetId: string,
): Promise<TrainingDocAsset | null> {
  const { data, error } = await service
    .from("training_doc_assets")
    .select("*")
    .eq("id", assetId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load training doc asset: ${error.message}`);
  }

  if (!data) return null;

  return {
    ...(data as Omit<TrainingDocAsset, "signed_url">),
    signed_url: await getSignedUrl(
      service,
      data.storage_bucket,
      data.storage_path,
    ),
  };
}

async function getSignedUrl(
  service: ServiceClient,
  bucket: string,
  storagePath: string,
): Promise<string | null> {
  const { data, error } = await service.storage
    .from(bucket)
    .createSignedUrl(storagePath, 60 * 60);

  if (error) {
    return null;
  }

  return data.signedUrl;
}
