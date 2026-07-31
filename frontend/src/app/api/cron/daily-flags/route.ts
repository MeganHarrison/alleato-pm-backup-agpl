/**
 * POST /api/cron/daily-flags
 *
 * Daily cron job that scans all active projects and auto-creates Pipeline B
 * `insight_cards` records for:
 *   1. Budget variances exceeding 10%        → card_type=financial_exposure
 *   2. Past-due RFIs                          → card_type=schedule_risk
 *   3. Late schedule tasks                    → card_type=schedule_risk
 *   4. Stale change events (unresolved > 7 days) → card_type=change_management
 *
 * Secured via CRON_SECRET env var (set in Vercel).
 * Vercel cron schedule: "0 6 * * *" (daily at 6am UTC)
 */

import { createServiceClient } from "@/lib/supabase/service";
import type { Database } from "@/types/database.types";
import { NextResponse } from "next/server";
import { GuardrailError } from "@/lib/guardrails/errors";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { logEvent } from "@/lib/guardrails/observability";
import { logger } from "@/lib/logger";
import {
  resolveTargetIdsForProjects,
  severityToConfidence,
} from "@/lib/ai/insight-cards";

export const maxDuration = 120;

type InsightCardInsert = Database["public"]["Tables"]["insight_cards"]["Insert"];

interface FlagStats {
  budgetFlags: number;
  rfiFlags: number;
  scheduleFlags: number;
  changeEventFlags: number;
}

// Per-flag metadata so we can dedupe on (target, alert_subtype) without
// requiring exact title matches.
type FlagSubtype =
  | "budget_variance"
  | "past_due_rfi"
  | "schedule_slippage"
  | "unresolved_change_event";

type FlagDraft = {
  subtype: FlagSubtype;
  insert: InsightCardInsert;
};

const BATCH_SIZE = 10;

export const POST = withApiGuardrails("/api/cron/daily-flags#POST", async ({ request, requestId }) => {
  // OWASP A07:2021 - Identification and Authentication Failures:
  // Always require CRON_SECRET; never skip validation when env var is unset.
  const cronSecret = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!process.env.CRON_SECRET || cronSecret !== process.env.CRON_SECRET) {
    throw new GuardrailError({
      code: "AUTH_EXPIRED",
      where: "/api/cron/daily-flags#POST",
      message: "Unauthorized cron invocation.",
      status: 401,
      severity: "medium",
    });
  }

  const supabase = createServiceClient();
  const now = new Date();
  const nowIso = now.toISOString();
  const todayStr = nowIso.split("T")[0];
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // 1. Get active projects
  const { data: projects, error: projectsError } = await supabase
    .from("projects")
    .select("id, name")
    .eq("archived", false);

  if (projectsError) {
    throw new GuardrailError({
      code: "INTERNAL_ERROR",
      where: "/api/cron/daily-flags#POST",
      message: "Failed to fetch projects for daily flag job.",
      details: {
        reason: projectsError.message,
      },
      cause: projectsError,
    });
  }

  if (!projects || projects.length === 0) {
    return NextResponse.json({ success: true, projectsChecked: 0, flagsCreated: 0, breakdown: { budgetFlags: 0, rfiFlags: 0, scheduleFlags: 0, changeEventFlags: 0 } });
  }

  // Resolve intelligence_targets up front so we don't hit it inside the loop.
  const targetMap = await resolveTargetIdsForProjects(
    supabase,
    projects.map((p) => p.id),
  );

  const stats: FlagStats = { budgetFlags: 0, rfiFlags: 0, scheduleFlags: 0, changeEventFlags: 0 };
  let totalFlagsCreated = 0;

  // Process projects in batches
  for (let i = 0; i < projects.length; i += BATCH_SIZE) {
    const batch = projects.slice(i, i + BATCH_SIZE);

    await Promise.all(batch.map(async (project) => {
      const targetId = targetMap.get(project.id);
      if (!targetId) {
        // Skip projects without an active intelligence_target — we can't write
        // an insight_card without one.
        return;
      }

      const drafts: FlagDraft[] = [];

      // Run all 4 checks in parallel for this project
      const [budgetResult, rfiResult, scheduleResult, ceResult] = await Promise.all([
        // a) Budget variance > 10%
        supabase
          .from("project_health_dashboard")
          .select("budget_utilization")
          .eq("id", project.id)
          .maybeSingle(),

        // b) Past-due RFIs
        supabase
          .from("rfis")
          .select("id, number, subject, due_date, status")
          .eq("project_id", project.id)
          .not("due_date", "is", null)
          .lt("due_date", todayStr)
          .not("status", "in", "(Closed,Answered,Void)"),

        // c) Late schedule tasks
        supabase
          .from("schedule_tasks")
          .select("id, name, finish_date, percent_complete, status, is_milestone")
          .eq("project_id", project.id)
          .not("finish_date", "is", null)
          .lt("finish_date", todayStr),

        // d) Stale change events (> 7 days unresolved)
        supabase
          .from("change_events")
          .select("id, number, title, status, created_at")
          .eq("project_id", project.id)
          .is("deleted_at", null)
          .lt("created_at", sevenDaysAgo)
          .not("status", "in", "(Approved,Rejected,Void,Closed)"),
      ]);

      const makeBase = (severity: "critical" | "warning"): Pick<
        InsightCardInsert,
        | "primary_target_id"
        | "confidence"
        | "current_status"
        | "attribution_status"
        | "first_seen_at"
        | "last_seen_at"
        | "source_count"
        | "compiler_version"
      > => ({
        primary_target_id: targetId,
        confidence: severityToConfidence(severity),
        current_status: "open",
        attribution_status: "auto_assigned",
        first_seen_at: nowIso,
        last_seen_at: nowIso,
        source_count: 1,
        compiler_version: "cron_daily_flags_v1",
      });

      // Process budget variance
      if (budgetResult.data?.budget_utilization && budgetResult.data.budget_utilization > 1.1) {
        const utilization = budgetResult.data.budget_utilization;
        const variancePercent = Math.round((utilization - 1) * 100);
        const severity: "critical" | "warning" = utilization > 1.2 ? "critical" : "warning";

        drafts.push({
          subtype: "budget_variance",
          insert: {
            ...makeBase(severity),
            card_type: "financial_exposure",
            title: `Budget variance exceeds ${variancePercent}% on ${project.name}`,
            summary: `Budget utilization is at ${Math.round(utilization * 100)}% — costs have exceeded the approved budget by ${variancePercent}%. Immediate review recommended.`,
            why_it_matters:
              severity === "critical"
                ? "Costs are significantly over budget — leadership review required."
                : "Budget tracking off plan — review needed.",
            metadata: {
              alert_subtype: "budget_variance",
              budget_utilization: utilization,
              variance_percent: variancePercent,
            },
          },
        });
      }

      // Process past-due RFIs
      const overdueRfis = rfiResult.data?.filter((r) => r.due_date && r.status !== "Closed" && r.status !== "Answered" && r.status !== "Void") ?? [];
      if (overdueRfis.length > 0) {
        const rfiIds = overdueRfis.map((r) => r.id);
        const maxOverdueDays = Math.max(
          ...overdueRfis.map((r) => {
            const due = new Date(r.due_date!);
            return Math.floor((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
          })
        );
        const severity: "critical" | "warning" = maxOverdueDays > 7 ? "critical" : "warning";

        drafts.push({
          subtype: "past_due_rfi",
          insert: {
            ...makeBase(severity),
            card_type: "schedule_risk",
            title: `${overdueRfis.length} past-due RFI${overdueRfis.length > 1 ? "s" : ""} on ${project.name}`,
            summary: `${overdueRfis.length} RFI${overdueRfis.length > 1 ? "s are" : " is"} past due (longest overdue: ${maxOverdueDays} days). Subjects: ${overdueRfis.slice(0, 3).map((r) => `#${r.number} "${r.subject}"`).join(", ")}${overdueRfis.length > 3 ? ` and ${overdueRfis.length - 3} more` : ""}.`,
            why_it_matters: "Open RFIs past their due date typically block field progress.",
            metadata: {
              alert_subtype: "past_due_rfi",
              rfi_ids: rfiIds,
              count: overdueRfis.length,
              max_overdue_days: maxOverdueDays,
              timeline_impact_days: maxOverdueDays,
            },
          },
        });
      }

      // Process late schedule tasks — filter out completed ones in code
      const lateTasks = (scheduleResult.data ?? []).filter((t) => {
        const complete = t.percent_complete != null && t.percent_complete >= 100;
        const doneStatus = t.status && ["complete", "Complete", "Completed", "Done"].includes(t.status);
        return !complete && !doneStatus;
      });

      if (lateTasks.length > 0) {
        const hasMilestone = lateTasks.some((t) => t.is_milestone === true);
        const maxLateDays = Math.max(
          ...lateTasks.map((t) => {
            const finish = new Date(t.finish_date!);
            return Math.floor((now.getTime() - finish.getTime()) / (1000 * 60 * 60 * 24));
          })
        );
        const severity: "critical" | "warning" = hasMilestone ? "critical" : "warning";

        drafts.push({
          subtype: "schedule_slippage",
          insert: {
            ...makeBase(severity),
            card_type: "schedule_risk",
            title: `${lateTasks.length} late schedule task${lateTasks.length > 1 ? "s" : ""} on ${project.name}${hasMilestone ? " (includes milestones)" : ""}`,
            summary: `${lateTasks.length} task${lateTasks.length > 1 ? "s are" : " is"} past their finish date (longest: ${maxLateDays} days late).${hasMilestone ? " This includes milestone tasks which may impact downstream deliverables." : ""} Examples: ${lateTasks.slice(0, 3).map((t) => `"${t.name}"`).join(", ")}${lateTasks.length > 3 ? ` and ${lateTasks.length - 3} more` : ""}.`,
            why_it_matters: hasMilestone
              ? "Milestone slip — downstream tasks and owner commitments at risk."
              : "Schedule slipping — review recovery plan.",
            metadata: {
              alert_subtype: "schedule_slippage",
              task_ids: lateTasks.map((t) => t.id),
              count: lateTasks.length,
              has_milestone: hasMilestone,
              max_late_days: maxLateDays,
              timeline_impact_days: maxLateDays,
            },
          },
        });
      }

      // Process stale change events
      const staleCEs = ceResult.data ?? [];
      if (staleCEs.length > 0) {
        const maxStaleDays = Math.max(
          ...staleCEs.map((ce) => {
            const created = new Date(ce.created_at);
            return Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
          })
        );
        const severity: "critical" | "warning" = maxStaleDays > 30 ? "critical" : "warning";

        drafts.push({
          subtype: "unresolved_change_event",
          insert: {
            ...makeBase(severity),
            card_type: "change_management",
            title: `${staleCEs.length} unresolved change event${staleCEs.length > 1 ? "s" : ""} on ${project.name}`,
            summary: `${staleCEs.length} change event${staleCEs.length > 1 ? "s have" : " has"} been open for more than 7 days (oldest: ${maxStaleDays} days). Events: ${staleCEs.slice(0, 3).map((ce) => `#${ce.number} "${ce.title}"`).join(", ")}${staleCEs.length > 3 ? ` and ${staleCEs.length - 3} more` : ""}.`,
            why_it_matters: "Open change events delay cost/schedule certainty.",
            metadata: {
              alert_subtype: "unresolved_change_event",
              change_event_ids: staleCEs.map((ce) => ce.id),
              count: staleCEs.length,
              max_stale_days: maxStaleDays,
              timeline_impact_days: maxStaleDays,
            },
          },
        });
      }

      // Dedup and insert: skip if an open insight_card for this
      // (target, alert_subtype) already exists today.
      const todayStart = `${todayStr}T00:00:00.000Z`;
      const todayEnd = `${todayStr}T23:59:59.999Z`;

      for (const draft of drafts) {
        const { data: existing } = await supabase
          .from("insight_cards")
          .select("id, metadata")
          .eq("primary_target_id", targetId)
          .neq("current_status", "resolved")
          .gte("created_at", todayStart)
          .lte("created_at", todayEnd);

        const dup = (existing ?? []).find(
          (row) => (row.metadata as { alert_subtype?: string } | null)?.alert_subtype === draft.subtype,
        );
        if (dup) {
          continue;
        }

        const { error: insertError } = await supabase
          .from("insight_cards")
          .insert(draft.insert);

        if (insertError) {
          logger.error({ msg: `[cron/daily-flags] Failed to insert insight for project ${project.id}:`, data: insertError });
          continue;
        }

        totalFlagsCreated++;
        if (draft.subtype === "budget_variance") stats.budgetFlags++;
        else if (draft.subtype === "past_due_rfi") stats.rfiFlags++;
        else if (draft.subtype === "schedule_slippage") stats.scheduleFlags++;
        else if (draft.subtype === "unresolved_change_event") stats.changeEventFlags++;
      }
    }));
  }

  logEvent({
    event: "background_job_completed",
    requestId,
    where: "/api/cron/daily-flags#POST",
    details: {
      checked: projects.length,
      flags_created: totalFlagsCreated,
      budget_flags: stats.budgetFlags,
      rfi_flags: stats.rfiFlags,
      schedule_flags: stats.scheduleFlags,
      change_event_flags: stats.changeEventFlags,
    },
  });

  return NextResponse.json({
    success: true,
    projectsChecked: projects.length,
    flagsCreated: totalFlagsCreated,
    breakdown: stats,
    runAt: nowIso,
  });
});

// Vercel cron invocations are HTTP GET (vercel.com/docs/cron-jobs); auth still requires CRON_SECRET.
export const GET = POST;
