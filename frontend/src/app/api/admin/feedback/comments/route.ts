import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";

import { ADMIN_FEEDBACK_BUCKET } from "@/lib/admin-feedback/constants";
import { getApiRouteUser } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { serviceDb } from "@/lib/supabase/service-db";

const MAX_COMMENT_IMAGE_BYTES = 10 * 1024 * 1024;

async function requireAdminUser() {
  const requestUser = await getApiRouteUser();
  if (!requestUser) return null;

  const supabase = createServiceClient();
  const { data: profile, error } = await serviceDb.from("user_profiles")
    .select("id, is_admin")
    .eq("id", requestUser.id)
    .maybeSingle();

  if (error || !profile?.is_admin) return null;
  return requestUser;
}

// ---------------------------------------------------------------------------
// GET — List comments for a feedback item
// ---------------------------------------------------------------------------

const listSchema = z.object({
  feedbackItemId: z.string().uuid(),
});

export const GET = withApiGuardrails("/api/admin/feedback/comments#GET", async ({ request }) => {
  const user = await requireAdminUser();
  if (!user) throw new GuardrailError({ code: "FORBIDDEN", where: "/api/admin/feedback/comments#GET", message: "Admin access required.", status: 403 });

  const url = new URL(request.url);
  const parsed = listSchema.safeParse(
    Object.fromEntries(url.searchParams),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const supabase = createServiceClient();
  const { data, error } = await serviceDb.from("admin_feedback_comments")
    .select("id, feedback_item_id, author_id, body, mentions, screenshot_url, screenshot_path, created_at, updated_at")
    .eq("feedback_item_id", parsed.data.feedbackItemId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new GuardrailError({ code: "INTERNAL_ERROR", where: "/api/admin/feedback/comments#GET", message: error.message });
  }

  // Fetch author profiles for all unique author IDs
  const authorIds = [...new Set((data ?? []).map((c) => c.author_id))];
  let authors: Record<string, { id: string; email: string; full_name: string | null }> = {};

  if (authorIds.length > 0) {
    const { data: profiles } = await serviceDb.from("user_profiles")
      .select("id, email, full_name")
      .in("id", authorIds);

    if (profiles) {
      authors = Object.fromEntries(profiles.map((p) => [p.id, p]));
    }
  }

  const comments = (data ?? []).map((c) => ({
    ...c,
    author: authors[c.author_id] ?? { id: c.author_id, email: "unknown", full_name: null },
  }));

  return NextResponse.json({ comments });
});

// ---------------------------------------------------------------------------
// POST — Add a comment to a feedback item
// ---------------------------------------------------------------------------

const postSchema = z.object({
  feedbackItemId: z.string().uuid(),
  body: z.string().trim().min(1).max(5000),
  mentions: z.array(z.string().uuid()).optional(),
  screenshotDataUrl: z.string().trim().nullable().optional(),
  screenshotDataUrls: z.array(z.string().trim()).max(8).optional(),
});

function decodeScreenshot(dataUrl: string) {
  const matches = dataUrl.match(
    /^data:(image\/(?:png|jpeg|webp|gif|heic|heif|avif));base64,(.+)$/,
  );
  if (!matches) {
    throw new Error("Screenshot must be a PNG, JPEG, WEBP, GIF, or AVIF data URL");
  }
  return {
    mimeType: matches[1],
    buffer: Buffer.from(matches[2], "base64"),
  };
}

async function ensureFeedbackBucket() {
  const svc = createServiceClient();
  const { error: getBucketError } = await svc.storage.getBucket(ADMIN_FEEDBACK_BUCKET);

  if (getBucketError) {
    const msg = (getBucketError as { message?: string }).message?.toLowerCase() ?? "";
    const isNotFound = msg.includes("not found") || msg.includes("does not exist");
    if (!isNotFound) throw new Error("Unable to verify feedback screenshot bucket");

    const { error: createErr } = await svc.storage.createBucket(ADMIN_FEEDBACK_BUCKET, {
      public: true,
    });
    if (createErr) throw new Error("Unable to create feedback screenshot bucket");
  }
}

async function uploadCommentScreenshot(userId: string, screenshotDataUrl: string) {
  await ensureFeedbackBucket();
  const svc = createServiceClient();
  const screenshot = decodeScreenshot(screenshotDataUrl);
  if (screenshot.buffer.byteLength > MAX_COMMENT_IMAGE_BYTES) {
    throw new Error("Comment image must be under 10MB");
  }
  const extension = screenshot.mimeType.split("/")[1] ?? "png";
  const filePath = `comments/${userId}/${new Date().toISOString().slice(0, 10)}/${randomUUID()}.${extension}`;

  const { error: uploadError } = await svc.storage
    .from(ADMIN_FEEDBACK_BUCKET)
    .upload(filePath, screenshot.buffer, {
      contentType: screenshot.mimeType,
      cacheControl: "3600",
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Failed to upload comment screenshot: ${(uploadError as { message?: string }).message ?? "unknown"}`);
  }

  const {
    data: { publicUrl },
  } = svc.storage.from(ADMIN_FEEDBACK_BUCKET).getPublicUrl(filePath);

  return { screenshotPath: filePath, screenshotUrl: publicUrl };
}

export const POST = withApiGuardrails("/api/admin/feedback/comments#POST", async ({ request }) => {
  const user = await requireAdminUser();
  if (!user) throw new GuardrailError({ code: "FORBIDDEN", where: "/api/admin/feedback/comments#POST", message: "Admin access required.", status: 403 });

  const raw = await request.json();
  const parsed = postSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { feedbackItemId, body, mentions = [], screenshotDataUrl } = parsed.data;
  const screenshotDataUrls =
    parsed.data.screenshotDataUrls?.filter(Boolean) ??
    (screenshotDataUrl ? [screenshotDataUrl] : []);
  const supabase = createServiceClient();

  // Verify the feedback item exists
  const { data: item, error: itemError } = await serviceDb.from("admin_feedback_items")
    .select("id")
    .eq("id", feedbackItemId)
    .maybeSingle();

  if (itemError || !item) {
    return NextResponse.json({ error: "Feedback item not found" }, { status: 404 });
  }

  const uploadedScreenshots = await Promise.all(
    screenshotDataUrls.map((dataUrl) =>
      uploadCommentScreenshot(user.id, dataUrl),
    ),
  );
  const commentRows: {
    feedback_item_id: string;
    author_id: string;
    body: string;
    mentions: string[];
    screenshot_url: string | null;
    screenshot_path: string | null;
  }[] =
    uploadedScreenshots.length > 0
      ? uploadedScreenshots.map((uploaded, index) => ({
          feedback_item_id: feedbackItemId,
          author_id: user.id,
          body: index === 0 ? body : "(image)",
          mentions: index === 0 ? mentions : [],
          screenshot_url: uploaded.screenshotUrl,
          screenshot_path: uploaded.screenshotPath,
        }))
      : [
          {
            feedback_item_id: feedbackItemId,
            author_id: user.id,
            body,
            mentions,
            screenshot_url: null,
            screenshot_path: null,
          },
        ];

  const { data: comments, error: insertError } = await serviceDb.from("admin_feedback_comments")
    .insert(commentRows)
    .select("id, feedback_item_id, author_id, body, mentions, screenshot_url, screenshot_path, created_at, updated_at")
    .order("created_at", { ascending: true });

  if (insertError) {
    throw new GuardrailError({ code: "INTERNAL_ERROR", where: "/api/admin/feedback/comments#POST", message: insertError.message });
  }

  // Fetch author profile
  const { data: profile } = await serviceDb.from("user_profiles")
    .select("id, email, full_name")
    .eq("id", user.id)
    .maybeSingle();

  const commentsWithAuthor = (comments ?? []).map((comment) => ({
    ...comment,
    author: profile ?? { id: user.id, email: "unknown", full_name: null },
  }));

  return NextResponse.json({
    comment: commentsWithAuthor[0],
    comments: commentsWithAuthor,
  });
});
