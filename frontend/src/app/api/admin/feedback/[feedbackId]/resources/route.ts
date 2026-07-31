import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  ADMIN_FEEDBACK_BUCKET,
} from "@/lib/admin-feedback/constants";
import {
  deleteAdminFeedbackObject,
  ensureAdminFeedbackBucket,
} from "@/lib/admin-feedback/storage";
import { requireAppAdmin } from "@/lib/auth/require-app-admin";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { getApiRouteUser } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { serviceDb } from "@/lib/supabase/service-db";
import type { Json } from "@/types/database.types";

const MAX_RESOURCE_BYTES = 100 * 1024 * 1024;
const RESOURCE_METADATA_KEY = "resources";

const createUploadSchema = z.object({
  action: z.literal("create-upload"),
  fileName: z.string().trim().min(1).max(240),
  contentType: z.string().trim().max(180).optional(),
  sizeBytes: z.number().int().positive().max(MAX_RESOURCE_BYTES),
});

const commitUploadSchema = z.object({
  action: z.literal("commit-upload"),
  resource: z.object({
    id: z.string().uuid(),
    label: z.string().trim().min(1).max(180),
    url: z.string().url(),
    path: z.string().trim().min(1).max(600),
    fileName: z.string().trim().min(1).max(240),
    mimeType: z.string().trim().max(180).nullable().optional(),
    sizeBytes: z.number().int().positive().max(MAX_RESOURCE_BYTES),
  }),
});

const addLinkSchema = z.object({
  action: z.literal("add-link"),
  label: z.string().trim().min(1).max(180),
  url: z.string().url(),
});

const postSchema = z.discriminatedUnion("action", [
  createUploadSchema,
  commitUploadSchema,
  addLinkSchema,
]);

const deleteSchema = z.object({
  resourceId: z.string().uuid(),
});

type FeedbackResource = {
  id: string;
  kind: "file" | "link";
  label: string;
  url: string;
  path: string | null;
  fileName: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  createdAt: string;
  createdBy: string | null;
};

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^\w.\- ]+/g, "").replace(/\s+/g, "-").slice(0, 120);
}

function fileExtension(fileName: string) {
  const extension = fileName.split(".").pop()?.toLowerCase();
  return extension && extension !== fileName.toLowerCase()
    ? extension.replace(/[^a-z0-9]/g, "").slice(0, 12)
    : "bin";
}

function normalizeMetadata(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function normalizeResource(value: unknown): FeedbackResource | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const resource = value as Record<string, unknown>;
  const kind = resource.kind === "file" || resource.kind === "link" ? resource.kind : null;
  if (!kind) return null;
  if (
    typeof resource.id !== "string" ||
    typeof resource.label !== "string" ||
    typeof resource.url !== "string" ||
    typeof resource.createdAt !== "string"
  ) {
    return null;
  }

  return {
    id: resource.id,
    kind,
    label: resource.label,
    url: resource.url,
    path: typeof resource.path === "string" ? resource.path : null,
    fileName: typeof resource.fileName === "string" ? resource.fileName : null,
    mimeType: typeof resource.mimeType === "string" ? resource.mimeType : null,
    sizeBytes: typeof resource.sizeBytes === "number" ? resource.sizeBytes : null,
    createdAt: resource.createdAt,
    createdBy: typeof resource.createdBy === "string" ? resource.createdBy : null,
  };
}

function normalizeResources(metadata: Record<string, unknown>) {
  const resources = metadata[RESOURCE_METADATA_KEY];
  return Array.isArray(resources)
    ? resources.flatMap((resource) => {
        const normalized = normalizeResource(resource);
        return normalized ? [normalized] : [];
      })
    : [];
}

async function loadFeedbackMetadata(feedbackId: string) {
  const supabase = createServiceClient();
  const { data, error } = await serviceDb.from("admin_feedback_items")
    .select("id, metadata")
    .eq("id", feedbackId)
    .maybeSingle();

  if (error) {
    throw new GuardrailError({
      code: "INTERNAL_ERROR",
      where: "admin/feedback/[feedbackId]/resources#load",
      message: error.message,
    });
  }
  if (!data) {
    throw new GuardrailError({
      code: "NOT_FOUND",
      where: "admin/feedback/[feedbackId]/resources#load",
      message: "Feedback item not found.",
      status: 404,
    });
  }

  return normalizeMetadata(data.metadata);
}

async function saveResources(feedbackId: string, metadata: Record<string, unknown>, resources: FeedbackResource[]) {
  const supabase = createServiceClient();
  const nextMetadata = {
    ...metadata,
    [RESOURCE_METADATA_KEY]: resources,
  } satisfies Record<string, unknown>;

  const { error } = await serviceDb.from("admin_feedback_items")
    .update({
      metadata: nextMetadata as Json,
      updated_at: new Date().toISOString(),
    })
    .eq("id", feedbackId);

  if (error) {
    throw new GuardrailError({
      code: "INTERNAL_ERROR",
      where: "admin/feedback/[feedbackId]/resources#save",
      message: error.message,
    });
  }
}

export const POST = withApiGuardrails<{ feedbackId: string }>(
  "admin/feedback/[feedbackId]/resources#POST",
  async ({ request, params }) => {
    await requireAppAdmin("admin/feedback/[feedbackId]/resources#POST");
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "admin/feedback/[feedbackId]/resources#POST",
        message: "Sign in before adding feedback resources.",
        status: 401,
      });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new GuardrailError({
        code: "INVALID_PAYLOAD",
        where: "admin/feedback/[feedbackId]/resources#POST",
        message: "Request body is not valid JSON.",
      });
    }

    const parsed = postSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid resource payload", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const metadata = await loadFeedbackMetadata(params.feedbackId);
    const resources = normalizeResources(metadata);

    if (parsed.data.action === "create-upload") {
      await ensureAdminFeedbackBucket("admin/feedback/[feedbackId]/resources#create-upload");
      const cleanName = sanitizeFileName(parsed.data.fileName) || "feedback-resource";
      const extension = fileExtension(cleanName);
      const day = new Date().toISOString().slice(0, 10);
      const path = `resources/${params.feedbackId}/${day}/${randomUUID()}.${extension}`;
      const contentType = parsed.data.contentType?.trim() || "application/octet-stream";
      const supabase = createServiceClient();
      const { data, error } = await supabase.storage
        .from(ADMIN_FEEDBACK_BUCKET)
        .createSignedUploadUrl(path);

      if (error || !data?.signedUrl) {
        throw new GuardrailError({
          code: "INTERNAL_ERROR",
          where: "admin/feedback/[feedbackId]/resources#create-upload",
          message: error?.message ?? "Could not create feedback resource upload URL.",
        });
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from(ADMIN_FEEDBACK_BUCKET).getPublicUrl(path);

      return NextResponse.json({
        uploadUrl: data.signedUrl,
        token: data.token,
        path,
        publicUrl,
        contentType,
        maxBytes: MAX_RESOURCE_BYTES,
        resource: {
          id: randomUUID(),
          kind: "file",
          label: cleanName,
          url: publicUrl,
          path,
          fileName: parsed.data.fileName,
          mimeType: contentType,
          sizeBytes: parsed.data.sizeBytes,
          createdAt: new Date().toISOString(),
          createdBy: user.id,
        } satisfies FeedbackResource,
      });
    }

    const nextResource: FeedbackResource =
      parsed.data.action === "add-link"
        ? {
            id: randomUUID(),
            kind: "link",
            label: parsed.data.label,
            url: parsed.data.url,
            path: null,
            fileName: null,
            mimeType: null,
            sizeBytes: null,
            createdAt: new Date().toISOString(),
            createdBy: user.id,
          }
        : {
            id: parsed.data.resource.id,
            kind: "file",
            label: parsed.data.resource.label,
            url: parsed.data.resource.url,
            path: parsed.data.resource.path,
            fileName: parsed.data.resource.fileName,
            mimeType: parsed.data.resource.mimeType ?? null,
            sizeBytes: parsed.data.resource.sizeBytes,
            createdAt: new Date().toISOString(),
            createdBy: user.id,
          };

    if (
      nextResource.kind === "file" &&
      !nextResource.path?.startsWith(`resources/${params.feedbackId}/`)
    ) {
      throw new GuardrailError({
        code: "INVALID_PAYLOAD",
        where: "admin/feedback/[feedbackId]/resources#commit-upload",
        message: "Resource path does not belong to this feedback item.",
        status: 400,
      });
    }

    const nextResources = [
      nextResource,
      ...resources.filter((resource) => resource.id !== nextResource.id),
    ];
    await saveResources(params.feedbackId, metadata, nextResources);

    return NextResponse.json({ resources: nextResources });
  },
);

export const DELETE = withApiGuardrails<{ feedbackId: string }>(
  "admin/feedback/[feedbackId]/resources#DELETE",
  async ({ request, params }) => {
    await requireAppAdmin("admin/feedback/[feedbackId]/resources#DELETE");

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new GuardrailError({
        code: "INVALID_PAYLOAD",
        where: "admin/feedback/[feedbackId]/resources#DELETE",
        message: "Request body is not valid JSON.",
      });
    }

    const parsed = deleteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid delete payload", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const metadata = await loadFeedbackMetadata(params.feedbackId);
    const resources = normalizeResources(metadata);
    const resourceToDelete = resources.find(
      (resource) => resource.id === parsed.data.resourceId,
    );
    if (!resourceToDelete) {
      throw new GuardrailError({
        code: "NOT_FOUND",
        where: "admin/feedback/[feedbackId]/resources#DELETE",
        message: "Feedback resource not found.",
        status: 404,
      });
    }

    const nextResources = resources.filter(
      (resource) => resource.id !== parsed.data.resourceId,
    );
    await saveResources(params.feedbackId, metadata, nextResources);

    const storageWarning =
      resourceToDelete.path && resourceToDelete.path.startsWith(`resources/${params.feedbackId}/`)
        ? await deleteAdminFeedbackObject(resourceToDelete.path)
        : { ok: true as const };

    return NextResponse.json({
      resources: nextResources,
      warning: storageWarning.ok ? null : storageWarning.details,
    });
  },
);
