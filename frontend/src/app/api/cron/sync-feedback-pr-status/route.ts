/**
 * POST /api/cron/sync-feedback-pr-status
 *
 * Reconciles feedback-inbox item status against GitHub PRs without needing a
 * live webhook:
 *   - A linked PR is open           → status = 'pr_created'
 *   - A linked PR is merged         → status = 'resolved'
 *   - The linked GitHub issue was deleted (410) and no PR references it
 *                                   → metadata.githubIssueMissing = true (so
 *                                     the inbox surfaces the broken link
 *                                     instead of freezing at 'submitted')
 *
 * It builds a single issue→PR index from a handful of PR list pages rather
 * than one Search API call per item. The previous per-item search blew the
 * GitHub Search rate limit (30/min) across a full inbox, so every update
 * silently failed and items stayed 'submitted' forever.
 *
 * Secured via CRON_SECRET env var (set in Vercel).
 * Vercel cron schedule: every 15 minutes.
 */

import { NextResponse } from "next/server";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { logEvent } from "@/lib/guardrails/observability";
import { logger } from "@/lib/logger";
import { serviceDb } from "@/lib/supabase/service-db";
import type { Database, Json } from "@/types/database.types";
import {
  buildFeedbackPullRequestIndex,
  checkGitHubIssueExistence,
} from "@/lib/admin-feedback/github";

export const maxDuration = 60;

const TERMINAL_STATUSES = ["resolved", "closed", "archived"];

// Cap how many missing-issue probes we make per run so a large backlog of
// deleted issues can't blow the REST rate limit. The rest are picked up on
// subsequent runs.
const MAX_MISSING_ISSUE_PROBES = 40;

export const POST = withApiGuardrails(
  "/api/cron/sync-feedback-pr-status#POST",
  async ({ request, requestId }) => {
    const cronSecret = request.headers.get("authorization")?.replace("Bearer ", "");
    if (!process.env.CRON_SECRET || cronSecret !== process.env.CRON_SECRET) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "/api/cron/sync-feedback-pr-status#POST",
        message: "Unauthorized cron invocation.",
        status: 401,
        severity: "medium",
      });
    }

        const { data: items, error } = await serviceDb.from("admin_feedback_items")
      .select("id, status, github_issue_number, metadata")
      .not("github_issue_number", "is", null)
      .not("status", "in", `(${TERMINAL_STATUSES.join(",")})`);

    if (error) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where: "/api/cron/sync-feedback-pr-status#POST",
        message: "Failed to load feedback items for PR status sync.",
        details: { reason: error.message },
        cause: error,
      });
    }

    // One bounded index for the whole inbox — no per-item Search calls.
    const prIndex = await buildFeedbackPullRequestIndex();
    if (!prIndex) {
      // GitHub not configured — nothing to reconcile.
      logEvent({
        event: "background_job_completed",
        requestId,
        where: "/api/cron/sync-feedback-pr-status#POST",
        details: { checked: 0, prCreated: 0, resolved: 0, missing: 0, failed: 0, skipped: "not_configured" },
      });
      return NextResponse.json({ success: true, checked: 0, prCreated: 0, resolved: 0, missing: 0, failed: 0 });
    }

    let checked = 0;
    let prCreated = 0;
    let resolved = 0;
    let missing = 0;
    let failed = 0;
    let missingProbes = 0;

    const applyUpdate = async (
      id: string,
      status: string | null,
      metadata: Record<string, Json>,
    ) => {
      const payload: Database["public"]["Tables"]["admin_feedback_items"]["Update"] = { metadata };
      if (status) payload.status = status;
      const { error: updateError } = await serviceDb.from("admin_feedback_items")
        .update(payload)
        .eq("id", id);
      if (updateError) {
        failed++;
        logger.error({
          msg: "[cron/sync-feedback-pr-status] status update failed",
          data: { id, error: updateError.message },
        });
        return false;
      }
      return true;
    };

    for (const item of items ?? []) {
      if (!item.github_issue_number) continue;
      checked++;

      const existingMetadata =
        item.metadata && typeof item.metadata === "object" && !Array.isArray(item.metadata)
          ? (item.metadata as Record<string, Json>)
          : {};

      try {
        const linked = prIndex.get(item.github_issue_number);
        const targetPull = linked?.mergedPr ?? linked?.openPr;

        if (targetPull) {
          const nextStatus = linked?.mergedPr ? "resolved" : "pr_created";
          if (item.status === nextStatus) continue;
          const ok = await applyUpdate(item.id, nextStatus, {
            ...existingMetadata,
            linkedPrNumber: targetPull.number,
            linkedPrUrl: targetPull.url,
            githubIssueMissing: false,
          });
          if (!ok) continue;
          if (nextStatus === "resolved") resolved++;
          else prCreated++;
          continue;
        }

        // No PR references this item. If it's already flagged missing, skip the
        // probe. Otherwise verify the linked issue still exists — a deleted
        // issue (410) is the recurring cause of permanently-stuck items.
        if (existingMetadata.githubIssueMissing === true) continue;
        if (missingProbes >= MAX_MISSING_ISSUE_PROBES) continue;
        missingProbes++;
        const existence = await checkGitHubIssueExistence(item.github_issue_number);
        if (existence === "deleted") {
          const ok = await applyUpdate(item.id, null, {
            ...existingMetadata,
            githubIssueMissing: true,
          });
          if (ok) missing++;
        }
      } catch (err) {
        failed++;
        logger.error({
          msg: "[cron/sync-feedback-pr-status] reconcile failed",
          data: { id: item.id, error: err instanceof Error ? err.message : String(err) },
        });
      }
    }

    logEvent({
      event: "background_job_completed",
      requestId,
      where: "/api/cron/sync-feedback-pr-status#POST",
      details: { checked, prCreated, resolved, missing, failed },
    });

    return NextResponse.json({ success: true, checked, prCreated, resolved, missing, failed });
  },
);

// Vercel cron invocations are HTTP GET (vercel.com/docs/cron-jobs); auth still requires CRON_SECRET.
export const GET = POST;
