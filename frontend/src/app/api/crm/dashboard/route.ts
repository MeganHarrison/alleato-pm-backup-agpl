import { NextResponse } from "next/server";

import { apiErrorResponse } from "@/lib/api-error";
import { requireCrmAccess } from "@/lib/crm/server";
import { withApiGuardrails } from "@/lib/guardrails/api";

const OPEN_TASK_STATUSES = ["open", "in_progress", "blocked"];

export const GET = withApiGuardrails("crm/dashboard#GET", async () => {
  const { db } = await requireCrmAccess("read");
  const weekStart = new Date();
  weekStart.setUTCDate(weekStart.getUTCDate() - ((weekStart.getUTCDay() + 6) % 7));
  weekStart.setUTCHours(0, 0, 0, 0);
  const [dealsResult, accountsResult, tasksResult, activitiesResult, timezoneResult] =
    await Promise.all([
      db.from("crm_deals").select("status, value_estimate, probability").is("archived_at", null),
      db.from("crm_account_profiles").select("health_status").is("archived_at", null),
      db.from("tasks").select("id").not("company_id", "is", null).in("status", OPEN_TASK_STATUSES).lt("due_date", new Date().toISOString().slice(0, 10)),
      db.from("crm_activities").select("id").is("deleted_at", null).gte("occurred_at", weekStart.toISOString()),
      db.from("crm_settings").select("value").eq("key", "default_reporting_timezone").maybeSingle(),
    ]);
  const firstError = dealsResult.error ?? accountsResult.error ?? tasksResult.error ??
    activitiesResult.error ?? timezoneResult.error;
  if (firstError) return apiErrorResponse(firstError);
  const deals = dealsResult.data ?? [];
  const openDeals = deals.filter((deal) => deal.status === "open");
  const closedDeals = deals.filter((deal) => deal.status !== "open");
  const wonDeals = closedDeals.filter((deal) => deal.status === "won");
  return NextResponse.json({
    data: {
      as_of: new Date().toISOString(),
      timezone: timezoneResult.data?.value ?? "America/Indianapolis",
      open_pipeline: openDeals.reduce((sum, deal) => sum + Number(deal.value_estimate), 0),
      weighted_pipeline: openDeals.reduce(
        (sum, deal) => sum + (Number(deal.value_estimate) * deal.probability) / 100,
        0,
      ),
      win_rate: closedDeals.length ? (wonDeals.length / closedDeals.length) * 100 : null,
      overdue_follow_ups: tasksResult.data?.length ?? 0,
      stale_relationships: (accountsResult.data ?? []).filter((account) => account.health_status === "stale").length,
      activity_this_week: activitiesResult.data?.length ?? 0,
    },
  });
});
