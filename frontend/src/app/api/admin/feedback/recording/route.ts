/**
 * Returns a Supabase Storage signed upload URL for screen-recording videos.
 *
 * Videos uploaded by the feedback widget can exceed the 4.5 MB Vercel
 * serverless body limit, so we bypass our own API route on the upload itself.
 * Flow:
 *   1. Client calls POST /api/admin/feedback/recording → server returns a
 *      signed upload URL + the eventual public URL of the file.
 *   2. Client uploads the blob directly to Supabase Storage.
 *   3. Client includes the public URL in the feedback submission payload
 *      (metadata.videoRecordingUrl).
 */

import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { ADMIN_FEEDBACK_BUCKET } from "@/lib/admin-feedback/constants";
import {
  deleteAdminFeedbackObject,
  ensureAdminFeedbackBucket,
} from "@/lib/admin-feedback/storage";
import { getApiRouteUser } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

const MAX_RECORDING_BYTES = 100 * 1024 * 1024; // 100 MB cap per recording.

const ALLOWED_MIME_TYPES = new Set([
  "video/webm",
  "video/mp4",
  "video/webm;codecs=vp8",
  "video/webm;codecs=vp9",
  "video/webm;codecs=vp8,opus",
  "video/webm;codecs=vp9,opus",
]);

const requestSchema = z.object({
  contentType: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .refine((value) => ALLOWED_MIME_TYPES.has(value), {
      message: "Unsupported video MIME type",
    }),
  fileSize: z.number().int().positive().max(MAX_RECORDING_BYTES),
});

export const POST = withApiGuardrails(
  "/api/admin/feedback/recording#POST",
  async ({ request }) => {
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "UNAUTHORIZED",
        where: "/api/admin/feedback/recording#POST",
        message: "Authentication required.",
        status: 401,
      });
    }

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      throw new GuardrailError({
        code: "INVALID_PAYLOAD",
        where: "/api/admin/feedback/recording#POST",
        message: "Request body is not valid JSON.",
      });
    }

    const parsed = requestSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    await ensureAdminFeedbackBucket("/api/admin/feedback/recording#POST");

    const { contentType } = parsed.data;
    const extension = contentType.includes("mp4") ? "mp4" : "webm";
    const day = new Date().toISOString().slice(0, 10);
    const path = `recordings/${user.id}/${day}/${randomUUID()}.${extension}`;

    const serviceSupabase = createServiceClient();
    const { data: uploadData, error: uploadError } = await serviceSupabase
      .storage.from(ADMIN_FEEDBACK_BUCKET)
      .createSignedUploadUrl(path);

    if (uploadError || !uploadData?.signedUrl) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where: "/api/admin/feedback/recording#POST",
        message: uploadError?.message ?? "Could not create signed upload URL.",
      });
    }

    const { data: publicData } = serviceSupabase
      .storage.from(ADMIN_FEEDBACK_BUCKET)
      .getPublicUrl(path);

    return NextResponse.json({
      uploadUrl: uploadData.signedUrl,
      token: uploadData.token,
      path,
      publicUrl: publicData.publicUrl,
      contentType,
      maxBytes: MAX_RECORDING_BYTES,
    });
  },
);

// ---------------------------------------------------------------------------
// DELETE — Remove an orphaned recording.
//
// The widget calls this when the user discards a recording or closes the
// composer before submitting feedback. Without it, every cancelled recording
// would leak as a permanent blob in Supabase Storage.
// ---------------------------------------------------------------------------

const deleteSchema = z.object({
  path: z
    .string()
    .trim()
    .min(1)
    .max(500)
    .regex(/^recordings\/[a-f0-9-]{36}\/\d{4}-\d{2}-\d{2}\/[a-f0-9-]{36}\.(webm|mp4)$/, {
      message: "Path is not a recording owned by the admin-feedback bucket",
    }),
});

export const DELETE = withApiGuardrails(
  "/api/admin/feedback/recording#DELETE",
  async ({ request }) => {
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "UNAUTHORIZED",
        where: "/api/admin/feedback/recording#DELETE",
        message: "Authentication required.",
        status: 401,
      });
    }

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      throw new GuardrailError({
        code: "INVALID_PAYLOAD",
        where: "/api/admin/feedback/recording#DELETE",
        message: "Request body is not valid JSON.",
      });
    }

    const parsed = deleteSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { path } = parsed.data;

    // Path-level ownership check: recordings live at recordings/{userId}/...
    // so the user can only delete their own.
    if (!path.startsWith(`recordings/${user.id}/`)) {
      throw new GuardrailError({
        code: "AUTH_FORBIDDEN",
        where: "/api/admin/feedback/recording#DELETE",
        message: "You can only delete your own recordings.",
        status: 403,
      });
    }

    const result = await deleteAdminFeedbackObject(path);
    return NextResponse.json({
      deleted: result.ok,
      warning: result.ok ? null : result.details,
    });
  },
);
