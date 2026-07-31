import { NextResponse } from "next/server";
import { z } from "zod";

import { withApiGuardrails, parseJsonBody } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { serviceDb } from "@/lib/supabase/service-db";
import { entityTypeLabel, type CommentableEntityType } from "@/lib/collaboration/rooms";

const getQuerySchema = z.object({
  entityType: z.string().min(1),
  entityId: z.string().min(1),
  projectId: z.coerce.number().int().positive().optional(),
});

const createCommentSchema = z.object({
  entityType: z.string().min(1),
  entityId: z.string().min(1),
  projectId: z.number().int().positive().optional(),
  body: z.string().min(1),
  parentCommentId: z.string().uuid().nullable().optional(),
});

type TeamMember = {
  email: string;
};

export const GET = withApiGuardrails(
  "collaboration/comments#GET",
  async ({ request }) => {
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "collaboration/comments#GET",
        message: "Authentication required.",
      });
    }

    const parsed = getQuerySchema.safeParse(
      Object.fromEntries(request.nextUrl.searchParams),
    );

    if (!parsed.success) {
      throw new GuardrailError({
        code: "INVALID_PAYLOAD",
        where: "collaboration/comments#GET",
        details: parsed.error.issues,
      });
    }

    const { entityType, entityId, projectId: parsedProjectId } = parsed.data;

    const supabase = await createClient();

    let query = supabase
      .from("collaboration_comments")
      .select("id, body, parent_comment_id, author_id, created_at")
      .eq("entity_type", entityType)
      .eq("entity_id", entityId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true });

    if (typeof parsedProjectId === "number") {
      query = query.eq("project_id", parsedProjectId);
    }

    const { data, error } = await query;

    if (error) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where: "collaboration/comments#GET",
        message: `Failed to load comments: ${error.message}`,
        details: error,
      });
    }

    const authorIds = Array.from(new Set((data ?? []).map((row) => row.author_id)));

    const { data: profiles } = authorIds.length
      ? await supabase
          .from("user_profiles")
          .select("id, full_name, email")
          .in("id", authorIds)
      : { data: [] as { id: string; full_name: string | null; email: string }[] };

    const nameById = new Map(
      (profiles ?? []).map((profile) => [
        profile.id,
        profile.full_name ?? profile.email ?? "Unknown user",
      ]),
    );

    return NextResponse.json({
      comments: (data ?? []).map((row) => ({
        id: row.id,
        body: row.body,
        parentCommentId: row.parent_comment_id,
        authorId: row.author_id,
        authorName: nameById.get(row.author_id) ?? "Unknown user",
        createdAt: row.created_at,
      })),
    });
  },
);

export const POST = withApiGuardrails(
  "collaboration/comments#POST",
  async ({ request }) => {
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "collaboration/comments#POST",
        message: "Authentication required.",
      });
    }

    const payload = await parseJsonBody(
      request,
      createCommentSchema,
      "collaboration/comments#POST",
    );

    const supabase = await createClient();
    const serviceClient = createServiceClient();

    const body = payload.body.trim();
    if (!body) {
      throw new GuardrailError({
        code: "INVALID_PAYLOAD",
        where: "collaboration/comments#POST",
        message: "Comment body cannot be empty.",
      });
    }

    const { data: inserted, error: insertError } = await supabase
      .from("collaboration_comments")
      .insert({
        entity_type: payload.entityType,
        entity_id: payload.entityId,
        project_id: payload.projectId ?? null,
        parent_comment_id: payload.parentCommentId ?? null,
        body,
        author_id: user.id,
      })
      .select("id, created_at")
      .single();

    if (insertError || !inserted) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where: "collaboration/comments#POST",
        message: `Failed to create comment: ${insertError?.message ?? "Unknown insert failure"}`,
        details: insertError,
      });
    }

    const actorName =
      (await supabase
        .from("user_profiles")
        .select("full_name, email")
        .eq("id", user.id)
        .single()).data?.full_name ??
      user.email ??
      "A teammate";

    const notificationRecipients = new Set<string>();

    if (payload.parentCommentId) {
      const { data: parentComment } = await serviceDb.from("collaboration_comments")
        .select("author_id")
        .eq("id", payload.parentCommentId)
        .single();

      if (parentComment?.author_id && parentComment.author_id !== user.id) {
        notificationRecipients.add(parentComment.author_id);
      }
    }

    if (typeof payload.projectId === "number") {
      const { data: team, error: teamError } = await serviceClient.rpc("get_project_team", {
        p_project_id: payload.projectId,
      });

      if (teamError) {
        return NextResponse.json(
          {
            comment: {
              id: inserted.id,
              createdAt: inserted.created_at,
            },
            warning: `Comment saved, but project team notifications could not be resolved: ${teamError.message}`,
          },
          { status: 201 },
        );
      }

      const emails = Array.from(
        new Set(
          (team as TeamMember[] | null)
            ?.map((member) => member.email)
            .filter((email): email is string => Boolean(email)) ?? [],
        ),
      );

      if (emails.length > 0) {
        const { data: recipientProfiles } = await serviceDb.from("user_profiles")
          .select("id, email")
          .in("email", emails);

        (recipientProfiles ?? []).forEach((profile) => {
          if (profile.id !== user.id) {
            notificationRecipients.add(profile.id);
          }
        });
      }
    }

    if (notificationRecipients.size > 0) {
      const recipients = Array.from(notificationRecipients);
      const kind = payload.parentCommentId ? "comment_reply" : "comment";

      const { error: notificationError } = await serviceDb.from("collaboration_notifications")
        .insert(
          recipients.map((recipientId) => ({
            user_id: recipientId,
            actor_id: user.id,
            project_id: payload.projectId ?? null,
            entity_type: payload.entityType,
            entity_id: payload.entityId,
            comment_id: inserted.id,
            kind,
            title: `${actorName} commented on ${entityTypeLabel(payload.entityType as CommentableEntityType)}`,
            body: body.length > 140 ? `${body.slice(0, 137)}...` : body,
            metadata: {
              entityType: payload.entityType,
              entityId: payload.entityId,
              projectId: payload.projectId ?? null,
            },
          })),
        );

      if (notificationError) {
        return NextResponse.json(
          {
            comment: {
              id: inserted.id,
              createdAt: inserted.created_at,
            },
            warning: `Comment saved, but notifications failed: ${notificationError.message}`,
          },
          { status: 201 },
        );
      }
    }

    return NextResponse.json(
      {
        comment: {
          id: inserted.id,
          createdAt: inserted.created_at,
        },
      },
      { status: 201 },
    );
  },
);
