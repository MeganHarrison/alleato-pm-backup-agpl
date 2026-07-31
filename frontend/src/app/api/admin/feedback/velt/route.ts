import { NextResponse } from "next/server";
import { z } from "zod";

import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { getApiRouteUser } from "@/lib/supabase/server";
import { mirrorVeltCommentToFeedback } from "@/lib/admin-feedback/velt-feedback";

const userSchema = z.object({
  userId: z.string().trim().min(1).nullable().optional(),
  name: z.string().trim().nullable().optional(),
  email: z.string().trim().nullable().optional(),
});

const attachmentSchema = z.object({
  attachmentId: z.union([z.number(), z.string()]).nullable().optional(),
  name: z.string().trim().nullable().optional(),
  url: z.string().trim().nullable().optional(),
  mimeType: z.string().trim().nullable().optional(),
  previewImages: z.array(z.string()).nullable().optional(),
  thumbnail: z.string().trim().nullable().optional(),
});

const payloadSchema = z.object({
  annotationId: z.string().trim().min(1),
  commentId: z.union([z.number(), z.string()]),
  documentId: z.string().trim().min(1),
  pageUrl: z.string().url(),
  pageTitle: z.string().trim().nullable().optional(),
  commentText: z.string().trim().nullable().optional(),
  commentHtml: z.string().trim().nullable().optional(),
  createdAt: z.union([z.string(), z.number()]).nullable().optional(),
  lastUpdated: z.union([z.string(), z.number()]).nullable().optional(),
  attachments: z.array(attachmentSchema).optional(),
  author: userSchema,
  taggedUsers: z.array(userSchema).optional(),
  targetElementId: z.string().trim().nullable().optional(),
  targetElementPath: z.string().trim().nullable().optional(),
  taggedElementPath: z.string().trim().nullable().optional(),
  taggedElementRect: z.unknown().optional(),
  annotationContext: z.record(z.string(), z.unknown()).nullable().optional(),
  createIssue: z.boolean().optional().default(false),
  source: z.enum(["velt_comment_annotation", "velt_comment_reply"]),
});

export const POST = withApiGuardrails(
  "/api/admin/feedback/velt#POST",
  async ({ request }) => {
    const requestUser = await getApiRouteUser();
    if (!requestUser) {
      throw new GuardrailError({
        code: "UNAUTHORIZED",
        where: "/api/admin/feedback/velt#POST",
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
        where: "/api/admin/feedback/velt#POST",
        message: "Request body is not valid JSON.",
        status: 400,
      });
    }

    const parsed = payloadSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid Velt feedback payload",
          details: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    const payload = parsed.data;
    if (!payload.author.userId || payload.author.userId !== requestUser.id) {
      throw new GuardrailError({
        code: "FORBIDDEN",
        where: "/api/admin/feedback/velt#POST",
        message: "Velt feedback author does not match the authenticated user.",
        status: 403,
      });
    }

    const result = await mirrorVeltCommentToFeedback(payload);
    return NextResponse.json(result);
  },
);
