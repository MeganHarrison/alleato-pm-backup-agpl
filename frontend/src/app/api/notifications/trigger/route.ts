import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { getApiRouteUser } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import {
  notifyCriticalIssue,
  notifyDeadline,
  notifyStatusChange,
  notifyBudgetAlert,
  notifyWeeklyDigest,
  notifyAssignment,
  notifyApprovalRequest,
  notifyBallInCourt,
} from "@/services/notificationService";

/**
 * POST /api/notifications/trigger
 *
 * Trigger a notification to one or more users.
 * Requires authentication. Can also be called with a service key for cron jobs.
 *
 * Body:
 * {
 *   kind: "$criticalIssue" | "$deadline" | "$statusChange" | "$budgetAlert" | "$weeklyDigest" | "$assignment" | "$approvalRequest" | "$ballInCourt",
 *   userIds: string | string[],
 *   data: { ... kind-specific data }
 * }
 */
export const POST = withApiGuardrails(
  "notifications/trigger#POST",
  async ({ request }) => {
  // Check for service key (for cron jobs / AI agents)
  const authHeader = request.headers.get("authorization");
  const serviceKey = process.env.NOTIFICATION_SERVICE_KEY;

  let isAuthorized = false;

  if (serviceKey && authHeader === `Bearer ${serviceKey}`) {
    isAuthorized = true;
  } else {
    const user = await getApiRouteUser();
    if (user) {
      isAuthorized = true;
    }
  }

  if (!isAuthorized) {
    throw new GuardrailError({ code: "AUTH_EXPIRED", where: "notifications/trigger#POST", message: "Authentication required." });
  }

  try {
    const body = await request.json();
    const { kind, userIds, data } = body;

    if (!kind || !userIds || !data) {
      return NextResponse.json(
        { error: "Missing required fields: kind, userIds, data" },
        { status: 400 }
      );
    }

    switch (kind) {
      case "$criticalIssue":
        await notifyCriticalIssue(userIds, data);
        break;
      case "$deadline":
        await notifyDeadline(userIds, data);
        break;
      case "$statusChange":
        await notifyStatusChange(userIds, data);
        break;
      case "$budgetAlert":
        await notifyBudgetAlert(userIds, data);
        break;
      case "$weeklyDigest":
        await notifyWeeklyDigest(userIds, data);
        break;
      case "$assignment":
        await notifyAssignment(userIds, data);
        break;
      case "$approvalRequest":
        await notifyApprovalRequest(userIds, data);
        break;
      case "$ballInCourt":
        await notifyBallInCourt(userIds, data);
        break;
      default:
        return NextResponse.json(
          { error: `Unknown notification kind: ${kind}` },
          { status: 400 }
        );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error({ msg: "[notifications/trigger] Error:", error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: "Failed to send notification" },
      { status: 500 }
    );
  }
  },
);
