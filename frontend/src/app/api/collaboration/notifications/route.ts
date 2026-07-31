import { NextResponse } from "next/server";
import { z } from "zod";

import { withApiGuardrails, parseJsonBody } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createActionTools } from "@/lib/ai/tools/action-tools";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  cursor: z.string().datetime().optional(),
  kind: z.string().trim().min(1).max(80).optional(),
  projectId: z.coerce.number().int().positive().optional(),
  unreadOnly: z.coerce.boolean().optional(),
});

const patchSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("mark-read"), id: z.string().uuid() }),
  z.object({
    action: z.literal("mark-reviewed"),
    id: z.string().uuid(),
    review: z
      .object({
        checkedIds: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
        checkedLabels: z.array(z.string().trim().min(1).max(200)).max(20).default([]),
      })
      .optional(),
  }),
  z.object({
    action: z.literal("confirm-ai-change-event"),
    id: z.string().uuid(),
    review: z
      .object({
        checkedIds: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
        checkedLabels: z.array(z.string().trim().min(1).max(200)).max(20).default([]),
      })
      .optional(),
  }),
  z.object({ action: z.literal("mark-all-read") }),
  z.object({ action: z.literal("delete"), id: z.string().uuid() }),
  z.object({ action: z.literal("delete-all") }),
]);

function getMetadataRecord(metadata: unknown): Record<string, unknown> {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return {};
  }

  return metadata as Record<string, unknown>;
}

function getRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function getString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function getNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function getBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function buildChangeEventConfirmInput(params: {
  notificationId: string;
  projectId: number | null;
  metadata: Record<string, unknown>;
}) {
  if (getString(params.metadata.eventType) !== "ai_change_event_awaiting_approval") {
    throw new GuardrailError({
      code: "INVALID_PAYLOAD",
      where: "collaboration/notifications#PATCH",
      message: "This AI approval is not a change-event draft.",
    });
  }

  const preview = getRecord(params.metadata.preview);
  if (getString(preview.table) !== "change_events") {
    throw new GuardrailError({
      code: "INVALID_PAYLOAD",
      where: "collaboration/notifications#PATCH",
      message: "This AI approval does not contain a change-event preview.",
    });
  }

  const fields = getRecord(preview.fields);
  const projectId = getNumber(fields.project_id) ?? params.projectId ?? undefined;
  const title = getString(fields.title);
  if (!projectId || !title) {
    throw new GuardrailError({
      code: "INVALID_PAYLOAD",
      where: "collaboration/notifications#PATCH",
      message: "The change-event preview is missing project or title fields.",
    });
  }

  return {
    projectId,
    title,
    description: getString(fields.description),
    scope: getString(fields.scope),
    type: getString(fields.type),
    status: getString(fields.status),
    reason: getString(fields.reason),
    origin: getString(fields.origin),
    expectingRevenue: getBoolean(fields.expecting_revenue),
    lineItemRevenueSource: getString(fields.line_item_revenue_source),
    confirmed: true,
    idempotencyKey:
      getString(params.metadata.eventKey) ?? `ai-approval:${params.notificationId}`,
  };
}

function getCreatedRecordId(output: unknown): string | null {
  const record = getRecord(getRecord(output).record);
  const id = record.id;
  if (typeof id === "string" && id.trim()) return id;
  if (typeof id === "number" && Number.isFinite(id)) return String(id);
  return null;
}

export const GET = withApiGuardrails(
  "collaboration/notifications#GET",
  async ({ request }) => {
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "collaboration/notifications#GET",
        message: "Authentication required.",
      });
    }

    const parsed = querySchema.safeParse(
      Object.fromEntries(request.nextUrl.searchParams),
    );

    if (!parsed.success) {
      throw new GuardrailError({
        code: "INVALID_PAYLOAD",
        where: "collaboration/notifications#GET",
        details: parsed.error.issues,
      });
    }

    const { limit, cursor, kind, projectId, unreadOnly } = parsed.data;
    const supabase = await createClient();

    let query = supabase
      .from("collaboration_notifications")
      .select(
        "id, kind, title, body, metadata, created_at, read_at, entity_type, entity_id, project_id, actor_id",
      )
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(limit + 1);

    if (kind) {
      query = query.eq("kind", kind);
    }

    if (projectId) {
      query = query.eq("project_id", projectId);
    }

    if (unreadOnly) {
      query = query.is("read_at", null);
    }

    if (cursor) {
      query = query.lt("created_at", cursor);
    }

    const { data, error } = await query;

    if (error) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where: "collaboration/notifications#GET",
        message: `Failed to load notifications: ${error.message}`,
        details: error,
      });
    }

    const hasMore = (data?.length ?? 0) > limit;
    const page = hasMore ? data!.slice(0, limit) : data ?? [];

    let unreadQuery = supabase
      .from("collaboration_notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .is("read_at", null);

    if (kind) {
      unreadQuery = unreadQuery.eq("kind", kind);
    }

    if (projectId) {
      unreadQuery = unreadQuery.eq("project_id", projectId);
    }

    const { count: unreadCount, error: unreadError } = await unreadQuery;

    if (unreadError) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where: "collaboration/notifications#GET",
        message: `Failed to count unread notifications: ${unreadError.message}`,
        details: unreadError,
      });
    }

    return NextResponse.json({
      notifications: page.map((row) => ({
        id: row.id,
        kind: row.kind,
        title: row.title,
        body: row.body,
        metadata: row.metadata,
        createdAt: row.created_at,
        readAt: row.read_at,
        entityType: row.entity_type,
        entityId: row.entity_id,
        projectId: row.project_id,
        actorId: row.actor_id,
      })),
      unreadCount: unreadCount ?? 0,
      hasMore,
    });
  },
);

export const PATCH = withApiGuardrails(
  "collaboration/notifications#PATCH",
  async ({ request }) => {
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "collaboration/notifications#PATCH",
        message: "Authentication required.",
      });
    }

    const payload = await parseJsonBody(
      request,
      patchSchema,
      "collaboration/notifications#PATCH",
    );

    const supabase = await createClient();

    if (payload.action === "mark-read") {
      const { error } = await supabase
        .from("collaboration_notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("id", payload.id)
        .eq("user_id", user.id)
        .is("deleted_at", null);

      if (error) {
        throw new GuardrailError({
          code: "INTERNAL_ERROR",
          where: "collaboration/notifications#PATCH",
          message: `Failed to mark notification as read: ${error.message}`,
          details: error,
        });
      }

      return NextResponse.json({ success: true });
    }

    if (payload.action === "mark-reviewed") {
      const reviewedAt = new Date().toISOString();
      const { data: existing, error: existingError } = await supabase
        .from("collaboration_notifications")
        .select("metadata")
        .eq("id", payload.id)
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .maybeSingle();

      if (existingError) {
        throw new GuardrailError({
          code: "INTERNAL_ERROR",
          where: "collaboration/notifications#PATCH",
          message: `Failed to load notification review metadata: ${existingError.message}`,
          details: existingError,
        });
      }

      const metadata = {
        ...getMetadataRecord(existing?.metadata),
        review: {
          source: "ai_approval_queue",
          reviewedAt,
          reviewedBy: user.id,
          checkedIds: payload.review?.checkedIds ?? [],
          checkedLabels: payload.review?.checkedLabels ?? [],
        },
      };

      const { error } = await supabase
        .from("collaboration_notifications")
        .update({ read_at: reviewedAt, metadata })
        .eq("id", payload.id)
        .eq("user_id", user.id)
        .is("deleted_at", null);

      if (error) {
        throw new GuardrailError({
          code: "INTERNAL_ERROR",
          where: "collaboration/notifications#PATCH",
          message: `Failed to mark notification as reviewed: ${error.message}`,
          details: error,
        });
      }

      return NextResponse.json({ success: true });
    }

    if (payload.action === "confirm-ai-change-event") {
      const reviewedAt = new Date().toISOString();
      const { data: existing, error: existingError } = await supabase
        .from("collaboration_notifications")
        .select("metadata, project_id, entity_type")
        .eq("id", payload.id)
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .maybeSingle();

      if (existingError) {
        throw new GuardrailError({
          code: "INTERNAL_ERROR",
          where: "collaboration/notifications#PATCH",
          message: `Failed to load AI approval metadata: ${existingError.message}`,
          details: existingError,
        });
      }

      if (!existing) {
        throw new GuardrailError({
          code: "NOT_FOUND",
          where: "collaboration/notifications#PATCH",
          message: "AI approval notification was not found.",
        });
      }

      if (
        existing.entity_type &&
        !["change_events", "change-events"].includes(existing.entity_type)
      ) {
        throw new GuardrailError({
          code: "INVALID_PAYLOAD",
          where: "collaboration/notifications#PATCH",
          message: "This AI approval is not linked to change events.",
        });
      }

      const metadataRecord = getMetadataRecord(existing.metadata);
      const confirmInput = buildChangeEventConfirmInput({
        notificationId: payload.id,
        projectId: existing.project_id,
        metadata: metadataRecord,
      });
      const tools = createActionTools(user.id, {
        pinnedProjectId: confirmInput.projectId,
      });
      const execute = tools.createChangeEvent.execute;
      if (!execute) {
        throw new GuardrailError({
          code: "INTERNAL_ERROR",
          where: "collaboration/notifications#PATCH",
          message: "Change-event creation tool is unavailable.",
        });
      }

      const output = await execute(confirmInput, {
        toolCallId: `ai-approval-${payload.id}`,
        messages: [],
      } as never);
      const outputRecord = getRecord(output);
      if (outputRecord.success !== true) {
        throw new GuardrailError({
          code: "INTERNAL_ERROR",
          where: "collaboration/notifications#PATCH",
          message:
            getString(outputRecord.error) ??
            "Change-event creation failed while confirming the AI approval.",
          details: outputRecord,
        });
      }

      const recordId = getCreatedRecordId(output);
      const metadata = {
        ...metadataRecord,
        review: {
          source: "ai_approval_queue",
          reviewedAt,
          reviewedBy: user.id,
          checkedIds: payload.review?.checkedIds ?? [],
          checkedLabels: payload.review?.checkedLabels ?? [],
        },
        confirmation: {
          source: "ai_approval_queue",
          confirmedAt: reviewedAt,
          confirmedBy: user.id,
          toolName: "createChangeEvent",
          recordId,
          idempotencyKey: confirmInput.idempotencyKey,
        },
      };

      const { error } = await supabase
        .from("collaboration_notifications")
        .update({
          read_at: reviewedAt,
          entity_id: recordId,
          metadata,
        })
        .eq("id", payload.id)
        .eq("user_id", user.id)
        .is("deleted_at", null);

      if (error) {
        throw new GuardrailError({
          code: "INTERNAL_ERROR",
          where: "collaboration/notifications#PATCH",
          message: `Change event was created, but the approval notification could not be updated: ${error.message}`,
          details: error,
        });
      }

      return NextResponse.json({
        success: true,
        action: "confirmed",
        recordId,
        output,
      });
    }

    if (payload.action === "mark-all-read") {
      const { error } = await supabase
        .from("collaboration_notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .is("read_at", null);

      if (error) {
        throw new GuardrailError({
          code: "INTERNAL_ERROR",
          where: "collaboration/notifications#PATCH",
          message: `Failed to mark all notifications as read: ${error.message}`,
          details: error,
        });
      }

      return NextResponse.json({ success: true });
    }

    if (payload.action === "delete") {
      const { error } = await supabase
        .from("collaboration_notifications")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", payload.id)
        .eq("user_id", user.id)
        .is("deleted_at", null);

      if (error) {
        throw new GuardrailError({
          code: "INTERNAL_ERROR",
          where: "collaboration/notifications#PATCH",
          message: `Failed to delete notification: ${error.message}`,
          details: error,
        });
      }

      return NextResponse.json({ success: true });
    }

    const { error } = await supabase
      .from("collaboration_notifications")
      .update({ deleted_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .is("deleted_at", null);

    if (error) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where: "collaboration/notifications#PATCH",
        message: `Failed to delete all notifications: ${error.message}`,
        details: error,
      });
    }

    return NextResponse.json({ success: true });
  },
);
