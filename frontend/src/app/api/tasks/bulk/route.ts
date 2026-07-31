import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { z } from "zod";

import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { serviceDb } from "@/lib/supabase/service-db";
import { apiErrorResponse } from "@/lib/api-error";
import type { Json } from "@/types/database.types";

interface BulkDeleteRequest {
  task_ids: string[];
}

type JsonRecord = { [key: string]: Json | undefined };

const BulkPatchBodySchema = z
  .object({
    task_ids: z.array(z.string().uuid()).min(1),
    category: z.union([z.string().trim().min(1), z.null()]).optional(),
    assignee_user_id: z.union([z.string().uuid(), z.null()]).optional(),
  })
  .strict()
  .refine(
    (body) =>
      body.category !== undefined || body.assignee_user_id !== undefined,
    { message: "At least one bulk update field is required." },
  );

function toJsonRecord(value: unknown): JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? { ...(value as JsonRecord) }
    : {};
}

async function resolveAssignee(userId: string | null) {
  if (userId === null) {
    return {
      assignee_person_id: null,
      assignee_email: null,
      assignee_name: null,
    };
  }

  const { data: profile, error: profileError } = await serviceDb
    .from("user_profiles")
    .select("id, email, full_name")
    .eq("id", userId)
    .maybeSingle();

  if (profileError || !profile) {
    throw new GuardrailError({
      code: "VALIDATION_ERROR",
      where: "tasks/bulk#PATCH",
      message: "Selected assignee was not found.",
      details: { reason: profileError?.message, userId },
      cause: profileError ?? undefined,
    });
  }

  const { data: personByAuthId, error: authPersonError } = await serviceDb
    .from("people")
    .select("id")
    .eq("auth_user_id", userId)
    .maybeSingle();

  if (authPersonError) {
    throw new GuardrailError({
      code: "INTERNAL_ERROR",
      where: "tasks/bulk#PATCH",
      message: "Failed to resolve assignee directory record.",
      details: { reason: authPersonError.message, userId },
      cause: authPersonError,
    });
  }

  const { data: personByEmail, error: emailPersonError } =
    !personByAuthId && profile.email
      ? await serviceDb
          .from("people")
          .select("id")
          .ilike("email", profile.email)
          .maybeSingle()
      : { data: null, error: null };

  if (emailPersonError) {
    throw new GuardrailError({
      code: "INTERNAL_ERROR",
      where: "tasks/bulk#PATCH",
      message: "Failed to resolve assignee email directory record.",
      details: { reason: emailPersonError.message, userId },
      cause: emailPersonError,
    });
  }

  return {
    assignee_person_id: personByAuthId?.id ?? personByEmail?.id ?? null,
    assignee_email: profile.email ?? null,
    assignee_name: profile.full_name ?? profile.email ?? null,
  };
}

export const PATCH = withApiGuardrails(
  "tasks/bulk#PATCH",
  async ({ request }) => {
    const supabase = await createClient();
    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "tasks/bulk#PATCH",
        message: "Authentication required.",
      });
    }

    const parsed = BulkPatchBodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const sharedUpdates: {
      assignee_person_id?: string | null;
      assignee_email?: string | null;
      assignee_name?: string | null;
      updated_at: string;
    } = {
      updated_at: new Date().toISOString(),
    };

    if (parsed.data.assignee_user_id !== undefined) {
      Object.assign(
        sharedUpdates,
        await resolveAssignee(parsed.data.assignee_user_id),
      );
    }

    if (parsed.data.category === undefined) {
      const { error } = await supabase
        .from("tasks")
        .update(sharedUpdates)
        .in("id", parsed.data.task_ids);

      if (error) {
        return apiErrorResponse(error);
      }

      return NextResponse.json({
        success: true,
        updated: parsed.data.task_ids.length,
      });
    }

    const { data: currentTasks, error: currentTasksError } = await supabase
      .from("tasks")
      .select("id, extraction_metadata")
      .in("id", parsed.data.task_ids);

    if (currentTasksError) {
      return apiErrorResponse(currentTasksError);
    }

    const updates = await Promise.all(
      (currentTasks ?? []).map((task) => {
        const metadata = toJsonRecord(task.extraction_metadata);
        if (parsed.data.category === null) {
          delete metadata.task_category;
        } else {
          metadata.task_category = parsed.data.category;
        }

        return supabase
          .from("tasks")
          .update({
            ...sharedUpdates,
            extraction_metadata: metadata,
          })
          .eq("id", task.id);
      }),
    );

    const failedUpdate = updates.find((result) => result.error);
    if (failedUpdate?.error) {
      return apiErrorResponse(failedUpdate.error);
    }

    return NextResponse.json({
      success: true,
      updated: currentTasks?.length ?? 0,
    });
  },
);

export const DELETE = withApiGuardrails(
  "tasks/bulk#DELETE",
  async ({ request }) => {
    const supabase = await createClient();
    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "tasks/bulk#DELETE",
        message: "Authentication required.",
      });
    }

    const body = (await request.json()) as BulkDeleteRequest;
    const taskIds = Array.isArray(body.task_ids)
      ? body.task_ids.filter((id): id is string => Boolean(id && id.trim()))
      : [];

    if (taskIds.length === 0) {
      return NextResponse.json(
        { error: "task_ids must be a non-empty array" },
        { status: 400 },
      );
    }

    const { error } = await supabase.from("tasks").delete().in("id", taskIds);

    if (error) {
      return apiErrorResponse(error);
    }

    return NextResponse.json({ success: true, deleted: taskIds.length });
  },
);
