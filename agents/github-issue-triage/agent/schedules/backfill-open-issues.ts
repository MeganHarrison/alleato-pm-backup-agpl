import { defineSchedule } from "eve/schedules";

import {
  ensureIssueLabels,
  findExistingTriageComment,
  getBackfillRepos,
  listOpenIssuesForBackfill,
  upsertTriageComment,
} from "../lib/github-app.js";
import { formatTriageComment, triageIssue } from "../lib/triage.js";

/**
 * Real-time triage is handled by the GitHub webhook channel (see
 * `channels/github.ts` — `onIssue` fires on opened/edited/labeled/reopened).
 * This schedule is ONLY a low-frequency safety net that catches issues which
 * existed before the webhook was installed, or that GitHub failed to deliver.
 *
 * It is deliberately conservative to avoid the runaway load this used to cause:
 *   - Daily cadence, not every 5 minutes.
 *   - Skips any issue that already carries a triage comment (idempotent).
 *   - Re-PATCHes an existing comment ONLY when the routing decision changed,
 *     so a quiet run touches the GitHub API zero extra times.
 *   - Never re-adds a label that is already present (ensureIssueLabels is a
 *     no-op when the label exists), so it does not self-trigger `labeled`
 *     webhooks on every pass.
 *
 * Override the cadence with EVE_GITHUB_TRIAGE_BACKFILL_CRON if needed.
 */
const backfillCron = process.env.EVE_GITHUB_TRIAGE_BACKFILL_CRON ?? "0 13 * * *";

export default defineSchedule({
  cron: backfillCron,
  async run() {
    const repos = getBackfillRepos();
    if (repos.length === 0) {
      console.error(
        "GitHub triage backfill blocked. Required env: EVE_GITHUB_TRIAGE_REPOS or EVE_GITHUB_TRIAGE_BACKFILL_REPOS.",
      );
      return;
    }

    for (const repoRef of repos) {
      let issues;
      try {
        issues = await listOpenIssuesForBackfill(repoRef);
      } catch (error) {
        console.error(`GitHub triage backfill issue listing failed for ${repoRef.owner}/${repoRef.repo}: ${toErrorMessage(error)}`);
        continue;
      }

      let triaged = 0;
      let skipped = 0;

      for (const issue of issues) {
        try {
          const existing = await findExistingTriageComment(repoRef, issue.issueNumber);
          const decision = triageIssue({
            body: issue.body,
            issueNumber: issue.issueNumber,
            labels: issue.labels,
            owner: repoRef.owner,
            repo: repoRef.repo,
            title: issue.title,
          });
          const desiredBody = formatTriageComment(decision);

          // Idempotent: only write when there is no triage comment yet, or when
          // the decision actually changed. A steady-state run writes nothing.
          if (existing && existing.body.trim() === desiredBody.trim()) {
            skipped += 1;
            continue;
          }

          const result = await upsertTriageComment(repoRef, issue.issueNumber, desiredBody);
          triaged += 1;
          console.info(`GitHub triage backfill ${result} comment for #${issue.issueNumber} in ${repoRef.owner}/${repoRef.repo}.`);

          // ensureIssueLabels is a no-op when the label is already present, so
          // this fires a `labeled` webhook at most once per issue (first triage),
          // not on every backfill pass.
          if (decision.route === "direct-to-main" || decision.route === "pr-required") {
            const addedLabels = await ensureIssueLabels(repoRef, issue.issueNumber, ["codex:fix"]);
            if (addedLabels.length > 0) {
              console.info(
                `GitHub triage backfill queued #${issue.issueNumber} in ${repoRef.owner}/${repoRef.repo} with labels: ${addedLabels.join(", ")}.`,
              );
            }
          }
        } catch (error) {
          console.error(`GitHub triage backfill comment failed for #${issue.issueNumber} in ${repoRef.owner}/${repoRef.repo}: ${toErrorMessage(error)}`);
        }
      }

      console.info(
        `GitHub triage backfill for ${repoRef.owner}/${repoRef.repo}: ${issues.length} open, ${triaged} written, ${skipped} unchanged.`,
      );
    }
  },
});

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
