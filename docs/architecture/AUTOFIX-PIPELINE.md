# Autofix Pipeline — Feedback → Issue → Fix → Review → Merge

Last verified: 2026-07-23

End-to-end automation that takes client feedback from the frontend all the way to a
merged fix with zero required human touchpoints (humans can intervene at any stage).

## Flow

```
Client feedback (feedback form / Velt comment / Agentation annotation)
  │  POST /api/admin/feedback  (auto-creates GitHub issue when GITHUB_FEEDBACK_* env set)
  ▼
GitHub issue  · labels: admin-feedback + feedback:<type>
  │  Issue Handler triage (.github/workflows/issue-handler.yml → /label-issue)
  │  runs an LLM on every new issue: applies type/priority/area labels AND, for
  │  actionable self-contained frontend feedback, applies the `codex:fix` label
  │  + posts a friendly acknowledgement so the reporter sees it's picked up.
  │  (This replaced the Eve triage agent, which gated on HITL approval and was a
  │  single point of failure — a disabled/stalled Eve silently stopped dispatch.)
  │  The label is applied with AUTOFIX_GITHUB_TOKEN so it triggers the fix lane.
  ▼
Autofix Issue workflow (.github/workflows/autofix-issue.yml)
  │  · label `autofix`     → engine = AUTOFIX_ENGINE repo variable (codex | claude | off)
  │  · label `codex:fix`   → Codex   (remapped to Claude when AUTOFIX_ENGINE=claude)
  │  · label `claude:fix`  → Claude Code (always explicit)
  │  · scope guard: only frontend/src/** + frontend/tests/** may change
  │  · validation: full pnpm quality + check:routes
  │  · every fix lands via PR — never a direct push to main (the ruleset's
  │    required checks make bot pushes impossible; see PR #620)
  ├── low-risk (Eve direct-to-main + diff-risk gate agrees: no risky surfaces,
  │   ≤6 files, ≤400 lines) → PR with auto-merge enabled at creation
  └── risky / pr-required (default, incl. missing Eve triage) → PR gated on
        the Autofix PR Manager's review approval
      (both: branch autofix/issue-N-*, labels automated-pr + engine,
       body "Resolves #N", author MeganHarrison)
  ▼
Autofix PR Manager (.github/workflows/autofix-pr-manager.yml) — automated PRs only
  │  1. marks drafts ready
  │  2. reviews with a structured verdict (blocking defects only)
  │  3. request_changes → fixes feedback in-place, pushes to the PR branch,
  │     re-reviews on the resulting synchronize event (max 3 rounds, then
  │     labels `autofix:needs-human` and stops). External changes_requested
  │     reviews (human or CodeRabbit) also trigger a fix round.
  │  4. approve → approves + enables auto-merge (squash)
  ▼
GitHub auto-merge waits for required checks (main ruleset):
  changed-quality · guardrails · design-system-guardrails
  │  CI Failure Handler (.github/workflows/ci-handler.yml) watches those three
  │  workflows: flaky → rerun; real failure → fix pushed to the same PR branch
  │
  │  In parallel: Vercel preview deploy of the autofix/* branch succeeds
  │  → Autofix Visual Proof (.github/workflows/autofix-visual-proof.yml, on
  │    deployment_status) signs in to the preview as the app test user
  │    (TEST_USER_1, same auth pattern as frontend/tests/auth.setup.ts, Vercel
  │    protection crossed via VERCEL_AUTOMATION_BYPASS_SECRET), screenshots the
  │    route(s) named in the issue's Reproduction/Location section (desktop +
  │    mobile), uploads them to the public `autofix-proof` Supabase Storage
  │    bucket (unguessable per-run path), and posts them as a PR comment —
  │    the VISUAL-PROOF-GATE.md evidence for the automated lane. Capture
  │    failures post a loud ⚠️ comment on the PR instead of failing silently.
  ▼
Merge → "Resolves #N" closes the issue → notify comment on the PR
  │
  └─ Feedback inbox status syncs via /api/cron/sync-feedback-pr-status (15 min)
```

## Engine toggle

Repository Actions variable **`AUTOFIX_ENGINE`** (Settings → Secrets and variables →
Actions → Variables, or `gh variable set AUTOFIX_ENGINE --body codex`):

| Value    | Behavior |
|----------|----------|
| `codex`  | (default) `autofix` and `codex:fix` labels run Codex (gpt-5.4, openai/codex-action) |
| `claude` | `autofix` and `codex:fix` labels run Claude Code (claude-code-action); Eve's `codex:fix` labels are remapped with an explanatory comment |
| `off`    | Nothing runs; the label gets a comment explaining autofix is disabled |

`claude:fix` always runs Claude Code regardless of the variable (explicit override),
unless the variable is `off`.

## Manual entry points

- Label any issue `autofix` (engine picked by the variable), `codex:fix`, or `claude:fix`.
- Feedback Inbox → Dispatch button (`/api/admin/feedback/dispatch`) — creates/reuses the
  issue, comments the full dispatch context, applies the engine label.
- `@claude` mentions on issues/PRs still work via claude.yml for ad-hoc asks (it no
  longer fires on every new issue or PR comment).
- **AI assistant chat** — the `dispatchImplementationRequest` write tool
  (`frontend/src/lib/ai/tools/write/implementation-dispatch-tools.ts`). After the
  assistant recommends a solution and the user confirms (standard preview → approval
  contract), it files a GitHub issue in the exact `Autofix Frontend Bug` issue-form
  shape and applies the engine label (`autofix` / `claude:fix` / `codex:fix`),
  which starts this pipeline. Frontend-only scope is mirrored client-side; a label
  failure is reported loudly in chat because an unlabeled issue never starts the lane.

## Safety rails

- **Scope**: agents may only touch `frontend/src/**` and `frontend/tests/**`; any other
  changed file rejects the run before publish.
- **No direct pushes to main** — every fix is a PR and the ruleset's required checks are
  the gate. The low-risk lane (Eve `direct-to-main` + diff-risk gate agreement) just gets
  auto-merge enabled at creation; anything risky waits for the automated review approval.
- **Review gate**: merge-gating review blocks on correctness/security/contract/guardrail
  defects only; 3 failed fix rounds → `autofix:needs-human` label and a human takes over.
- **Required checks** (main ruleset): `changed-quality`, `guardrails`,
  `design-system-guardrails`. Repo admins can bypass for manual emergency pushes;
  the automation never does.
- **Identity**: all automated commits/PRs use the `AUTOFIX_GITHUB_TOKEN` secret
  (MeganHarrison PAT). This is required because PRs created with the default
  `GITHUB_TOKEN` cannot trigger other workflows (checks would never run → auto-merge
  would never fire). (A prior version of this doc also cited a Vercel Hobby-plan
  deployment restriction as a second reason; the project is on Vercel Pro, which has
  no such restriction, so that reasoning no longer applies — 2026-07-23.)

## Conflict auto-resolution (zero-touch PR upkeep)

`.github/workflows/pr-conflict-resolver.yml` (added 2026-07-23): every push to `main`
scans open PRs (polling GitHub's lazy `mergeable` computation), and for up to 3 newly
conflicted PRs per run merges `main` into the branch — Claude resolves the hunks under
a preserve-both-intents contract — verifies zero conflict markers remain, pushes, and
comments. Combined with auto-merge armed on the PR (`gh pr merge --auto --squash`),
a PR goes conflict → resolved → merged with no human touches. Guardrails: draft PRs
skipped; opt out per-PR with the `no-auto-resolve` label; unresolvable conflicts push
NOTHING and escalate with `autofix:needs-human` + a comment.

## Failure visibility (no silent failures, no silent limbo)

Every non-happy path posts a structured comment on the issue or PR: blocked issue
payloads, agent run failures, out-of-scope diffs, empty diffs, validation failures,
exhausted review loops, and unfixable CI failures.

Terminal failures also **escalate**: the issue gets the `autofix:needs-human` label and
the triggering engine label is removed, so a failed run can never leave an issue looking
"in progress" while nothing is running (the issue-#569 limbo). To retry after fixing the
cause: remove `autofix:needs-human`, re-apply the engine label.

The Claude engine additionally guards against claude-code-action's exit-0-on-error
behavior (rate limits can kill the run seconds in while the step reports success): the
workflow reads `is_error` from the action's execution file, retries once after 90s, and
treats a still-errored run as an agent failure — with Claude's real error message
surfaced in the issue comment.

## Related files

| Concern | File |
|---------|------|
| Issue triage labels | `.github/workflows/issue-handler.yml` + `.claude/commands/label-issue.md` |
| Engine lane | `.github/workflows/autofix-issue.yml` |
| Agent prompt / PR template | `.github/automation/prompts/fix-issue.md`, `.github/automation/templates/pr-body.md` |
| Review→fix→merge loop | `.github/workflows/autofix-pr-manager.yml` |
| Conflict auto-resolution | `.github/workflows/pr-conflict-resolver.yml` |
| Visual proof on preview deploy | `.github/workflows/autofix-visual-proof.yml` + `scripts/autofix/capture-visual-proof.mjs` + `scripts/autofix/upload-proof-assets.mjs` |
| CI failure auto-fix | `.github/workflows/ci-handler.yml` |
| Ad-hoc @claude | `.github/workflows/claude.yml` |
| Feedback → issue | `frontend/src/app/api/admin/feedback/route.ts`, `frontend/src/lib/admin-feedback/github.ts` |
| Assistant chat → issue | `frontend/src/lib/ai/tools/write/implementation-dispatch-tools.ts`, `frontend/src/lib/ai/tools/write/implementation-dispatch-issue.ts` |
| Inbox dispatch (manual) | `frontend/src/app/api/admin/feedback/dispatch/route.ts` |
| Auto-dispatch + triage | `.github/workflows/issue-handler.yml` + `.claude/commands/label-issue.md` |
| Eve triage agent (retired from critical path) | `agents/github-issue-triage/` — kept for optional risk routing; no longer required for dispatch. While no `direct-to-main` triage comment is posted, every fix takes the review-gated PR lane (safe default) and the Autofix PR Manager still auto-approves + auto-merges. |
| PR-status sync cron | `frontend/src/app/api/cron/sync-feedback-pr-status/route.ts` |
