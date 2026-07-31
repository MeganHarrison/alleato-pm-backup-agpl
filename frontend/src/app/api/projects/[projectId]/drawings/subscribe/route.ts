import { NextResponse } from "next/server";

import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import {
  isAuthError,
  verifyProjectAccess,
} from "@/lib/supabase/auth-guard";

type DrawingSubscriptionRouteParams = { projectId: string };

function parseProjectId(projectId: string, where: string): number {
  const projectIdNum = Number.parseInt(projectId, 10);
  if (!Number.isFinite(projectIdNum)) {
    throw new GuardrailError({
      code: "VALIDATION_ERROR",
      where,
      message: "Invalid project ID.",
    });
  }
  return projectIdNum;
}

export const GET = withApiGuardrails<DrawingSubscriptionRouteParams>(
  "projects/[projectId]/drawings/subscribe#GET",
  async ({ params }) => {
    const { projectId } = await params;
    const projectIdNum = parseProjectId(
      projectId,
      "projects/[projectId]/drawings/subscribe#GET",
    );
    const access = await verifyProjectAccess(projectIdNum);
    if (isAuthError(access)) return access;

    const { data, error } = await access.serviceClient
      .from("user_email_notifications")
      .select("drawings_default")
      .eq("project_id", projectIdNum)
      .eq("person_id", access.membership.personId)
      .maybeSingle();

    if (error) {
      throw new GuardrailError({
        code: "DATABASE_ERROR",
        where: "projects/[projectId]/drawings/subscribe#GET",
        message: `Failed to load drawing subscription: ${error.message}`,
      });
    }

    return NextResponse.json({
      subscribed: data?.drawings_default ?? false,
    });
  },
);

export const POST = withApiGuardrails<DrawingSubscriptionRouteParams>(
  "projects/[projectId]/drawings/subscribe#POST",
  async ({ params }) => {
    const { projectId } = await params;
    const projectIdNum = parseProjectId(
      projectId,
      "projects/[projectId]/drawings/subscribe#POST",
    );
    const access = await verifyProjectAccess(projectIdNum);
    if (isAuthError(access)) return access;

    const { error } = await access.serviceClient
      .from("user_email_notifications")
      .upsert(
        {
          project_id: projectIdNum,
          person_id: access.membership.personId,
          drawings_default: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "person_id,project_id" },
      );

    if (error) {
      throw new GuardrailError({
        code: "DATABASE_ERROR",
        where: "projects/[projectId]/drawings/subscribe#POST",
        message: `Failed to subscribe to drawing updates: ${error.message}`,
      });
    }

    return NextResponse.json({ subscribed: true });
  },
);

export const DELETE = withApiGuardrails<DrawingSubscriptionRouteParams>(
  "projects/[projectId]/drawings/subscribe#DELETE",
  async ({ params }) => {
    const { projectId } = await params;
    const projectIdNum = parseProjectId(
      projectId,
      "projects/[projectId]/drawings/subscribe#DELETE",
    );
    const access = await verifyProjectAccess(projectIdNum);
    if (isAuthError(access)) return access;

    const { error } = await access.serviceClient
      .from("user_email_notifications")
      .upsert(
        {
          project_id: projectIdNum,
          person_id: access.membership.personId,
          drawings_default: false,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "person_id,project_id" },
      );

    if (error) {
      throw new GuardrailError({
        code: "DATABASE_ERROR",
        where: "projects/[projectId]/drawings/subscribe#DELETE",
        message: `Failed to unsubscribe from drawing updates: ${error.message}`,
      });
    }

    return NextResponse.json({ subscribed: false });
  },
);
