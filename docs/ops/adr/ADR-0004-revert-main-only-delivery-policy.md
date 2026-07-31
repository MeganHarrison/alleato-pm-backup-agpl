# ADR-0004: Revert main-only delivery policy; allow multi-agent branch + PR publishing

Date: 2026-07-23
Status: Accepted
Owner: Engineering

## Context

On 2026-07-20 (`dba80e392`, task AAI-1225), a "main-only repository delivery"
policy was installed to stop branch sprawl: six stray, unmerged remote
branches had accumulated because sessions kept publishing to feature branches
instead of the existing `npm run codex:finish` finish flow. The fix was to
hard-block every non-`main` branch push, both via a GitHub ruleset
(`main-only remote delivery`, id `19315027`) and a matching `.husky/pre-push`
check, forcing all publication through `codex:finish`.

On 2026-07-23, an interactive Claude Code session hit this policy while
trying to publish an unrelated fix (scheduling API route-budget
consolidation, see the commit below) as a normal feature branch. Investigation
found that `codex:finish` and its supporting isolated-workspace tooling
(`scripts/ops/isolated-session-workspace.mjs`) are hard-gated to a
`CODEX_THREAD_ID` environment variable set only by the Codex CLI — there is
no credential, permission, or config flag that lets any other agent tool
(Claude Code, or anything else) use that path. The main-only policy therefore
meant only Codex could publish to this repository at all.

## Decision

Revert the main-only lockdown so any agent tool (Codex, Claude Code, and
others) can publish via a normal branch + PR, exactly as documented in
CLAUDE.md's Git Workflow section. Concretely:

- GitHub ruleset `main-only remote delivery` (id `19315027`): `enforcement`
  set from `active` to `disabled` (not deleted).
- `.husky/pre-push`: removed the block rejecting any push whose remote ref
  wasn't `refs/heads/main`. The route-budget checks it also ran
  (`check:routes`, `verify:nonprod-routes`) are kept, now running on every
  push regardless of branch.
- `scripts/verify/verify_main_only_delivery_policy.mjs`: deleted — it
  asserted the now-reverted hook text and would be a stale, always-failing
  check otherwise.

`npm run codex:finish` and the isolated-session-workspace /
checkout-session-gate tooling are untouched. The automated Codex fleet keeps
using that path exactly as before; this only restores the alternative path
for everyone else.

Decided by the repo owner (bclymer), 2026-07-23, after the tradeoff above was
explained.

## Alternatives Considered

- Register this Claude Code session in the Codex-specific
  session-board/isolated-workspace system to use `codex:finish` directly:
  rejected — `codex:finish`'s workspace tooling is hard-gated to Codex's own
  thread ID with no legitimate way for another tool to authenticate into it.
- Use the GitHub-side admin bypass that already existed on the ruleset
  (`current_user_can_bypass: "always"` for the authenticated account) without
  changing the policy itself: rejected in favor of an explicit, visible
  revert — a silent bypass would leave the policy looking active to the next
  person/agent who reads it, reproducing today's confusion.

## Consequences

- Positive: any agent tool can publish work to this repository again via
  branch + PR, matching CLAUDE.md's documented workflow.
- Negative: reintroduces the original risk this policy existed to prevent —
  feature branches that never get merged or cleaned up, accumulating as
  stray remote refs.
- Operational impact: none to the Codex fleet's own delivery path
  (`codex:finish` unchanged). Existing `.github/workflows/prune-merged-branches.yml`
  automation (unchanged) continues to delete branches once fully merged;
  CLAUDE.md's "keep branches short-lived and delete them after merge"
  guidance is the human/agent-facing half of the same mitigation. No new
  guardrail was added to strengthen this further — worth revisiting if branch
  sprawl recurs.

## Rollback Plan

Re-enable in two steps if branch sprawl recurs or the decision changes:

```bash
gh api -X PUT repos/The-Alleato-Group/project-management/rulesets/19315027 \
  -f name="main-only remote delivery" -f target="branch" -f enforcement="active" \
  -f 'conditions[ref_name][exclude][]=~DEFAULT_BRANCH' \
  -f 'conditions[ref_name][include][]=~ALL' \
  -f 'rules[][type]=creation'
```

Then restore the removed block in `.husky/pre-push` (see git history of this
file prior to this ADR's commit) and recreate
`scripts/verify/verify_main_only_delivery_policy.mjs` from the same history.
