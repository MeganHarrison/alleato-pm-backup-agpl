import { NextResponse } from "next/server";

import { apiErrorResponse } from "@/lib/api-error";
import { crmDateOnly, evaluateCrmDealAttention } from "@/lib/crm/rules";
import { requireCrmAccess } from "@/lib/crm/server";
import type { CrmDealStatus, CrmFollowUp } from "@/lib/crm/types";
import { withApiGuardrails } from "@/lib/guardrails/api";

export const GET = withApiGuardrails("crm/attention#GET", async () => {
  const { db } = await requireCrmAccess("read");
  const now = new Date();
  const [accountsResult, dealsResult, tasksResult, settingsResult] =
    await Promise.all([
      db
        .from("crm_account_profiles")
        .select("*")
        .in("health_status", ["watch", "stale", "unknown"])
        .is("archived_at", null),
      db
        .from("crm_deals")
        .select("*")
        .eq("status", "open")
        .is("archived_at", null),
      db
        .from("tasks")
        .select("*")
        .not("company_id", "is", null)
        .not("due_date", "is", null)
        .in("status", ["open", "in_progress", "blocked"]),
      db
        .from("crm_settings")
        .select("key, value")
        .in("key", ["stale_deal_threshold_days", "default_reporting_timezone"]),
    ]);
  const firstError =
    accountsResult.error ??
    dealsResult.error ??
    tasksResult.error ??
    settingsResult.error;
  if (firstError) return apiErrorResponse(firstError);
  const tasks = tasksResult.data ?? [];
  const followUps = tasks.map((task) => ({
    dealId: task.crm_deal_id,
    dueDate: task.due_date!,
    status: task.status as CrmFollowUp["status"],
  }));
  const settings = new Map(
    (settingsResult.data ?? []).map((setting) => [setting.key, setting.value]),
  );
  const configuredStaleDays = settings.get("stale_deal_threshold_days");
  const configuredTimezone = settings.get("default_reporting_timezone");
  const staleDealDays =
    typeof configuredStaleDays === "number" ? configuredStaleDays : 30;
  const reportingTimezone =
    typeof configuredTimezone === "string"
      ? configuredTimezone
      : "America/Indianapolis";
  const today = crmDateOnly(now, reportingTimezone);
  const dealAttention = (dealsResult.data ?? []).flatMap((deal) =>
    evaluateCrmDealAttention({
      deal: {
        id: deal.id,
        status: deal.status as CrmDealStatus,
        expectedCloseDate: deal.expected_close_date,
        updatedAt: deal.updated_at,
      },
      followUps,
      staleDealDays,
      reportingTimezone,
      now,
    }).map((item) => ({
      type: "deal",
      id: deal.id,
      reason_code: item.code,
      reason: item.reason,
      href: `/crm/deals/${deal.id}`,
    })),
  );

  return NextResponse.json({
    data: [
      ...(accountsResult.data ?? []).map((account) => ({
        type: "account",
        id: account.company_id,
        reason_code: `relationship_${account.health_status}`,
        reason: account.health_reason,
        href: `/directory/companies/${account.company_id}?tab=crm`,
      })),
      ...dealAttention,
      ...tasks
        .filter((task) => task.due_date! < today)
        .map((task) => ({
          type: "follow_up",
          id: task.id,
          reason_code: "follow_up_overdue",
          reason: `Follow-up was due ${task.due_date}.`,
          href: task.crm_deal_id
            ? `/crm/deals/${task.crm_deal_id}`
            : `/directory/companies/${task.company_id}?tab=crm`,
        })),
    ],
  });
});
