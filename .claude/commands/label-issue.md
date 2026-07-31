# Label Issue

Triage a newly opened GitHub issue: apply the right labels so the autofix
pipeline can route it. Arguments provide `REPO` and `ISSUE_NUMBER`.

## Steps

1. Read the issue: `gh issue view $ISSUE_NUMBER --repo $REPO --json title,body,labels,author`
2. Classify and apply labels with `gh issue edit $ISSUE_NUMBER --repo $REPO --add-label "<labels>"`:
   - **Type** (pick one): `feedback:bug`, `feedback:change_request`, or `feedback:question`.
     Use `bug` / `enhancement` instead when the issue is developer-authored rather than
     client feedback.
   - **Priority** (pick one): `priority:high` for broken core workflows, data loss, money
     math, auth; `priority:medium` for everything else. Skip for questions.
   - **Area**: add `area:frontend` when the issue is clearly about the Next.js app UI.
3. Dispatch to the autofix pipeline — but only when the issue is a safe, self-contained
   frontend job. Apply the trigger label with `gh issue edit $ISSUE_NUMBER --repo $REPO
   --add-label "<label>"`:
   - **Client feedback** (labeled `admin-feedback`): add `codex:fix` when the item is an
     actionable, self-contained request to change frontend UI or behavior — i.e. it names
     a surface and a concrete expected outcome. This is the primary path and replaces the
     retired Eve triage routing; the fix workflow's admin-feedback branch builds its own
     task context from the issue's `## Feedback` / `## Location` sections.
   - **Developer-authored issues on the Codex form**: add `autofix` ONLY when ALL hold —
     the body has non-empty `### Automation scope` (= `Frontend`), `### Problem statement`,
     `### Expected behavior`, `### Reproduction`, `### Acceptance criteria`,
     `### Allowed edit paths` (every path under `frontend/src/` or `frontend/tests/`),
     `### Required guardrail`.
   - **Never dispatch** (add no `codex:fix`/`autofix`) when the issue: is a
     `feedback:question`; is a discussion reply or acknowledgement rather than a fresh
     request (body is essentially "done", "updated", "thanks", or only an @mention with no
     described change); lacks a clear surface or expected behavior; or touches migrations,
     auth, RLS, payments/money math, provider/deployment config, or anything backend or
     ambiguous. When unsure, do NOT dispatch — leave it for a human. The downstream
     diff-risk gate and PR review are backstops, not a license to over-dispatch.
4. If the issue is a question with no code change implied, comment asking for the missing
   detail (what surface, what expected behavior) and add `feedback:question`.
5. **Acknowledge dispatched work so the reporter sees it's being handled.** When — and only
   when — you added `codex:fix` or `autofix` in step 3, post one short, friendly,
   non-technical comment, e.g.: "Thanks for flagging this — it's been picked up and an
   automated fix is in progress. You'll get an update here when it ships." Do not promise a
   timeline, and do not post this comment when you did not dispatch.

## Rules

- Never remove existing labels.
- Never close the issue.
- Keep any comment to 1-3 sentences; do not restate the issue back to the author.
