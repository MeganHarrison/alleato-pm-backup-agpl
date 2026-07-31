import { tool } from "ai";
import { z } from "zod";
import {
  buildFeedbackPullRequestIndex,
  findPullRequestPreviewUrl,
  getRepoIssueSnapshot,
  type FeedbackPullRequestIndex,
} from "@/lib/admin-feedback/github";
import { withTrace as _withTrace } from "../tool-utils";
import type {
  CreateOperationalToolsOptions,
  OperationalToolInternals,
} from "./operational-internals";
import {
  AUTOFIX_NEEDS_HUMAN_LABEL,
  deriveImplementationPhase,
  describeImplementationPhase,
  extractDispatchRecords,
  type DispatchAuditRow,
} from "./implementation-status";

function withTrace<TInput extends Record<string, unknown>, TResult>(
  name: string,
  options: CreateOperationalToolsOptions,
  execute: (input: TInput) => Promise<TResult>,
) {
  return _withTrace(
    name,
    options,
    execute,
    "The implementation-status lookup failed. Report the failure plainly instead of guessing pipeline state.",
  );
}

/**
 * Companion READ tool to the `dispatchImplementationRequest` write tool:
 * answers "what happened to the fixes you dispatched?" by joining the
 * `ai_tool_write_audits` dispatch trail with live GitHub issue + PR state.
 *
 * GitHub calls stay off the 30-req/min Search API: PR linkage comes from one
 * `buildFeedbackPullRequestIndex()` bulk pass, and each issue costs one plain
 * REST GET (see the rate-limit warning in `admin-feedback/github.ts`).
 */
export function createImplementationStatusReadTools(
  internals: OperationalToolInternals,
) {
  const { userId, options, supabase } = internals;

  return {
    getImplementationStatus: tool({
      description:
        "Report what happened to implementation requests previously dispatched to the " +
        "automated build pipeline via dispatchImplementationRequest. For each dispatched " +
        "GitHub issue: whether it is queued, blocked on a human (autofix:needs-human), " +
        "in review with a linked pull request (with state and Vercel preview URL), merged, " +
        "closed without a fix, or deleted. Use when asked things like 'what happened to " +
        "the fixes you dispatched?', 'did that change ship?', or for the status of a " +
        "specific dispatched issue number.",
      inputSchema: z.object({
        issueNumber: z
          .number()
          .optional()
          .describe("Check one specific dispatched GitHub issue number"),
        limit: z
          .number()
          .min(1)
          .max(20)
          .default(10)
          .describe("How many recent dispatches to report when no issueNumber is given"),
      }),
      execute: withTrace(
        "getImplementationStatus",
        options,
        async ({ issueNumber, limit }: { issueNumber?: number; limit: number }) => {
          const { data, error } = await supabase
            .from("ai_tool_write_audits")
            .select("created_at, request_payload, response_payload")
            .eq("user_id", userId)
            .eq("tool_name", "dispatchImplementationRequest")
            .eq("status", "success")
            .order("created_at", { ascending: false })
            .limit(50);

          if (error) {
            return { error: `Could not read the dispatch audit trail: ${error.message}` };
          }

          const records = extractDispatchRecords((data ?? []) as DispatchAuditRow[]);
          const scoped = issueNumber
            ? records.filter((record) => record.issueNumber === issueNumber)
            : records.slice(0, limit);

          if (scoped.length === 0) {
            return {
              dispatches: [],
              message: issueNumber
                ? `No successful implementation dispatch found for issue #${issueNumber} in the audit trail.`
                : "No implementation requests have been dispatched yet.",
            };
          }

          // One bulk pass builds issue→PR linkage without the Search API.
          let prIndex: FeedbackPullRequestIndex | null = null;
          let githubDegraded: string | null = null;
          try {
            prIndex = await buildFeedbackPullRequestIndex();
            if (!prIndex) {
              githubDegraded =
                "GitHub is not configured (GITHUB_FEEDBACK_REPO_OWNER/NAME/TOKEN missing); reporting dispatch records without live pipeline state.";
            }
          } catch (indexError) {
            githubDegraded = `GitHub PR lookup failed (${indexError instanceof Error ? indexError.message : String(indexError)}); pull-request linkage is unverified.`;
          }

          const dispatches = await Promise.all(
            scoped.map(async (record) => {
              const snapshot = await getRepoIssueSnapshot(record.issueNumber);
              const linked = prIndex?.get(record.issueNumber);
              const pullRequest = linked?.mergedPr ?? linked?.openPr ?? null;
              const phase = deriveImplementationPhase({
                snapshot,
                mergedPr: linked?.mergedPr,
                openPr: linked?.openPr,
              });
              const previewUrl =
                linked?.openPr && !linked.mergedPr
                  ? await findPullRequestPreviewUrl(linked.openPr.number)
                  : null;

              return {
                issueNumber: record.issueNumber,
                issueUrl: record.issueUrl,
                title: record.title,
                dispatchedAt: record.dispatchedAt,
                triggerLabel: record.triggerLabel,
                phase,
                phaseDetail: describeImplementationPhase(phase),
                issueState: snapshot.state,
                blockedNeedsHuman: snapshot.labels.includes(AUTOFIX_NEEDS_HUMAN_LABEL),
                pullRequest: pullRequest
                  ? {
                      number: pullRequest.number,
                      url: pullRequest.url,
                      state: pullRequest.state,
                      merged: pullRequest.merged,
                      previewUrl,
                    }
                  : null,
              };
            }),
          );

          return {
            dispatches,
            ...(githubDegraded ? { warning: githubDegraded } : {}),
          };
        },
      ),
    }),
  };
}
