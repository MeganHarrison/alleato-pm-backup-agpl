import { NextResponse } from "next/server";
import { z } from "zod";
import { withApiGuardrails, parseJsonBody } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { getApiRouteUser } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { serviceDb } from "@/lib/supabase/service-db";
import type { Database } from "@/types/database.types";
import {
  buildAppErrorFixPacket,
  classifyAppError,
  type AppErrorEventForPacket,
  type AppErrorGroupForClassification,
} from "@/lib/app-error-classification";
import { createLinearIssue } from "@/lib/linear/issues";

type AppErrorGroupRow = Database["public"]["Tables"]["app_error_groups"]["Row"];

const updateErrorGroupSchema = z.object({
  status: z.enum(["new", "triaged", "in_progress", "fixed", "ignored", "needs_human"]).optional(),
  linearIssueId: z.string().trim().max(120).nullable().optional(),
  linearIssueUrl: z.string().trim().url().nullable().optional(),
});

const GROUP_SELECT = [
  "id",
  "created_at",
  "first_seen_at",
  "last_seen_at",
  "signature",
  "source",
  "severity",
  "status",
  "event_count",
  "affected_user_count",
  "affected_project_count",
  "latest_message",
  "latest_route",
  "latest_action",
  "latest_error_code",
  "latest_request_id",
  "latest_user_id",
  "latest_project_id",
  "linear_issue_id",
  "linear_issue_url",
  "metadata",
].join(",");

function buildLinearIssueTitle(
  group: AppErrorGroupForClassification,
  category: string,
): string {
  const location = group.latest_route ?? group.latest_action ?? "Application error";
  const title = `[${group.severity.toUpperCase()}] ${category}: ${location}`;
  return title.length > 180 ? `${title.slice(0, 177)}...` : title;
}

export const GET = withApiGuardrails<{ groupId: string }>(
  "/api/admin/app-errors/[groupId]#GET",
  async ({ request, params }) => {
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "/api/admin/app-errors/[groupId]#GET",
        message: "Authentication required.",
        status: 401,
      });
    }

    const supabase = createServiceClient();
    const { data: group, error: groupError } = await serviceDb.from("app_error_groups")
      .select(GROUP_SELECT)
      .eq("id", params.groupId)
      .maybeSingle();

    if (groupError) {
      throw new GuardrailError({
        code: "DB_ERROR",
        where: "/api/admin/app-errors/[groupId]#GET",
        message: groupError.message,
        status: 500,
      });
    }

    if (!group) {
      throw new GuardrailError({
        code: "NOT_FOUND",
        where: "/api/admin/app-errors/[groupId]#GET",
        message: "Application error group was not found.",
        status: 404,
      });
    }

    const { data: events, error: eventsError } = await serviceDb.from("app_error_events")
      .select("id, created_at, source, severity, route, action, error_code, error_message, request_id, status_code, page_path, stack, component_stack")
      .eq("group_id", params.groupId)
      .order("created_at", { ascending: false })
      .limit(25);

    if (eventsError) {
      throw new GuardrailError({
        code: "DB_ERROR",
        where: "/api/admin/app-errors/[groupId]#GET",
        message: eventsError.message,
        status: 500,
      });
    }

    const appUrl = new URL(request.url).origin;
    const classifiedGroup = group as unknown as AppErrorGroupForClassification;
    const recentEvents = (events ?? []) as AppErrorEventForPacket[];

    return NextResponse.json({
      group,
      events: recentEvents,
      classification: classifyAppError(classifiedGroup),
      fixPacket: buildAppErrorFixPacket({
        group: classifiedGroup,
        events: recentEvents,
        appUrl,
      }),
    });
  },
);

export const POST = withApiGuardrails<{ groupId: string }>(
  "/api/admin/app-errors/[groupId]#POST",
  async ({ request, params }) => {
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "/api/admin/app-errors/[groupId]#POST",
        message: "Authentication required.",
        status: 401,
      });
    }

    const supabase = createServiceClient();
    const { data: group, error: groupError } = await serviceDb.from("app_error_groups")
      .select(GROUP_SELECT)
      .eq("id", params.groupId)
      .maybeSingle();

    if (groupError) {
      throw new GuardrailError({
        code: "DB_ERROR",
        where: "/api/admin/app-errors/[groupId]#POST",
        message: groupError.message,
        status: 500,
      });
    }

    if (!group) {
      throw new GuardrailError({
        code: "NOT_FOUND",
        where: "/api/admin/app-errors/[groupId]#POST",
        message: "Application error group was not found.",
        status: 404,
      });
    }

    const appErrorGroup = group as unknown as AppErrorGroupRow;

    if (appErrorGroup.linear_issue_id && appErrorGroup.linear_issue_url) {
      return NextResponse.json({
        group: appErrorGroup,
        issue: {
          identifier: appErrorGroup.linear_issue_id,
          url: appErrorGroup.linear_issue_url,
          created: false,
        },
      });
    }

    const { data: events, error: eventsError } = await serviceDb.from("app_error_events")
      .select("id, created_at, source, severity, route, action, error_code, error_message, request_id, status_code, page_path, stack, component_stack")
      .eq("group_id", params.groupId)
      .order("created_at", { ascending: false })
      .limit(25);

    if (eventsError) {
      throw new GuardrailError({
        code: "DB_ERROR",
        where: "/api/admin/app-errors/[groupId]#POST",
        message: eventsError.message,
        status: 500,
      });
    }

    const appUrl = new URL(request.url).origin;
    const classifiedGroup = appErrorGroup as unknown as AppErrorGroupForClassification;
    const recentEvents = (events ?? []) as AppErrorEventForPacket[];
    const classification = classifyAppError(classifiedGroup);
    const fixPacket = buildAppErrorFixPacket({
      group: classifiedGroup,
      events: recentEvents,
      appUrl,
    });
    let issue: Awaited<ReturnType<typeof createLinearIssue>>;
    try {
      issue = await createLinearIssue({
        title: buildLinearIssueTitle(classifiedGroup, classification.category),
        description: fixPacket,
      });
    } catch (error) {
      throw new GuardrailError({
        code: "UPSTREAM_FAILURE",
        where: "/api/admin/app-errors/[groupId]#POST",
        message: error instanceof Error ? error.message : "Linear issue creation failed.",
        status: 502,
      });
    }

    const { data: updatedGroup, error: updateError } = await serviceDb.from("app_error_groups")
      .update({
        linear_issue_id: issue.identifier,
        linear_issue_url: issue.url,
        status: appErrorGroup.status === "new" ? "triaged" : appErrorGroup.status,
      })
      .eq("id", params.groupId)
      .select(GROUP_SELECT)
      .maybeSingle();

    if (updateError || !updatedGroup) {
      throw new GuardrailError({
        code: "DB_ERROR",
        where: "/api/admin/app-errors/[groupId]#POST",
        message: updateError?.message ?? `Linear issue ${issue.identifier} was created, but the error group could not be updated.`,
        status: 500,
      });
    }

    return NextResponse.json({
      group: updatedGroup,
      issue: {
        id: issue.id,
        identifier: issue.identifier,
        title: issue.title,
        url: issue.url,
        created: true,
      },
    });
  },
);

export const PATCH = withApiGuardrails<{ groupId: string }>(
  "/api/admin/app-errors/[groupId]#PATCH",
  async ({ request, params }) => {
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "/api/admin/app-errors/[groupId]#PATCH",
        message: "Authentication required.",
        status: 401,
      });
    }

    const body = await parseJsonBody(
      request,
      updateErrorGroupSchema,
      "/api/admin/app-errors/[groupId]#PATCH",
    );

    const updates: Database["public"]["Tables"]["app_error_groups"]["Update"] = {};
    if (body.status) updates.status = body.status;
    if (typeof body.linearIssueId !== "undefined") updates.linear_issue_id = body.linearIssueId;
    if (typeof body.linearIssueUrl !== "undefined") updates.linear_issue_url = body.linearIssueUrl;

    if (Object.keys(updates).length === 0) {
      throw new GuardrailError({
        code: "INVALID_PAYLOAD",
        where: "/api/admin/app-errors/[groupId]#PATCH",
        message: "No supported app error group fields were provided.",
        status: 400,
      });
    }

    const supabase = createServiceClient();
    const { data, error } = await serviceDb.from("app_error_groups")
      .update(updates)
      .eq("id", params.groupId)
      .select(GROUP_SELECT)
      .maybeSingle();

    if (error) {
      throw new GuardrailError({
        code: "DB_ERROR",
        where: "/api/admin/app-errors/[groupId]#PATCH",
        message: error.message,
        status: 500,
      });
    }

    if (!data) {
      throw new GuardrailError({
        code: "NOT_FOUND",
        where: "/api/admin/app-errors/[groupId]#PATCH",
        message: "Application error group was not found.",
        status: 404,
      });
    }

    return NextResponse.json({ group: data });
  },
);
