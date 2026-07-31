# Backlog System — the single ranked queue

**One place for every unit of work — build, fix, test, audit, improve — so freed
bandwidth converts to progress instantly and the "what needs Megan" slice is never
buried.** This is the spine of the Aledo optimization plan (slice 1).

## Canonical store: GitHub Issues

GitHub Issues in `MeganHarrison/alleato-pm` is the backlog. Not a new tracker —
GitHub because the Codex/Claude automation lane, this agent, and the GitHub mobile app
(with push notifications) already read and write it. Everything else (the `/errors`
tracker, `/testing/parity`, the feedback inbox, `WORKING_CONTEXT.md` follow-ups) is a
**source** that flows *into* issues; the in-app Command Center (a later slice) is a
read-optimized *view* of them.

## The label schema — four axes + one flag

Small and fixed. Harmonized with the labels already in use (`admin-feedback`,
`codex:fix`, `area:frontend`, `priority:medium`, `feedback:*`).

### Axis 1 — Type (every issue gets exactly one)
| Label | Meaning |
|-------|---------|
| `type:fix` | A bug — something is wrong and should work. |
| `type:build` | New feature, capability, page, or guardrail that doesn't exist yet. |
| `type:test` | Add or repair test coverage / seed data / E2E. |
| `type:audit` | Investigate & verify — parity, security, FK, UI, performance, dead code. May spawn `type:fix` children. |
| `type:improve` | Refactor, debt paydown, polish, DX. Works today; make it better. |

### Axis 2 — Priority
`priority:high` · `priority:medium` · `priority:low`. Rank the whole queue by this,
then by blast radius (auth/RLS/money/RAG bias up), then by effort (quick wins first).

### Axis 3 — State (the "where are we" answer)
`state:backlog` (unscoped) → `state:ready` (scoped, safe to start) →
`state:in-progress` → `state:in-review` (PR + preview up) → **closed = done**.
`state:blocked` when waiting on something external.

### Axis 4 — Source (provenance, optional)
`admin-feedback` (client feedback, existing) · `source:working-context` ·
`source:error-tracker` · `source:parity` · `source:audit`.

### The flag — `needs-megan`
Orthogonal to everything else. Apply whenever an item is waiting on a decision,
approval, secret value, or judgment **only Megan can give**. This is the label the
Command Center's top lane and the `🙋 Needs you` report section filter on. An item can
be `state:in-progress` **and** `needs-megan` at the same time.

> Do not confuse with `autofix:needs-human` — that is the automation lane saying "a bot
> shouldn't auto-merge this," a routing decision. `needs-megan` means "Megan is the
> blocker." They can co-occur.

## How the existing feedback labels map in

The 28 open client-feedback issues already carry their own workflow labels; **do not
relabel them in bulk** — the Codex automation keys off `codex:fix` / `autofix:needs-human`.
Instead, a unified view maps them:

| Existing | Canonical type |
|----------|----------------|
| `feedback:bug`, `bug` | `type:fix` |
| `feedback:feature_request` | `type:build` |
| `feedback:change_request` | `type:improve` |
| `feedback:question` | (client clarification — leave; not `needs-megan`) |

## Automation lane (unchanged)

`codex:fix` / `claude:fix` / `autofix` still trigger the automated fix lane described in
`CLAUDE.md` → Git Workflow. **Do not add these to a backlog item unless you want a bot to
attempt it.** Dev-backlog seeds are left un-automated so Megan promotes them deliberately.

## How work flows

1. **In:** every source (feedback, errors, parity, audits, follow-ups, the weekly
   generator in slice 2) files an issue with Type + Priority + Source, and `needs-megan`
   if it's blocked on her.
2. **Rank:** the queue is read priority-first. Anything not `needs-megan` and not
   `state:blocked` can be started by an agent without waiting on Megan.
3. **Move:** flip `state:*` as work progresses; `🔀 In review` = PR open.
4. **Out:** close on merge. The PR body carries `Closes #<n>`.
5. **Report:** every hand-back uses `.claude/rules/RESPONSE-FORMAT-CONTRACT.md`.

## Ranked view queries (GitHub search)

- Needs Megan now: `is:open label:needs-megan`
- Ready to pick up (no decision needed): `is:open label:state:ready -label:needs-megan`
- High-priority anything: `is:open label:priority:high`
- Dev backlog (non-feedback): `is:open label:source:working-context,source:error-tracker,source:audit`

## Label colors

Labels are auto-created on first use with default grey. Standardizing colors
(type=blue, priority=red-scale, state=grey, `needs-megan`=bright yellow) is a one-time
polish pass — not blocking. From a **local dev environment** it's a quick
`gh label create/edit` script (the repo already leans on `gh`). From the **remote agent
environment** there is no `gh` CLI and no create-label MCP call, so from here it's the
GitHub web UI.

## Applying labels when filing

Issue **forms** (`.github/ISSUE_TEMPLATE/*.yml`) write dropdown answers into the issue
body only — they do **not** set labels. So the ranked queries above depend on labels
being applied explicitly:

- **Agents** (this session, Codex) apply `type:*`/`priority:*`/`state:*`/`needs-megan`
  directly via the issue-write API at creation — no manual step. This is the primary path.
- **Humans** using the web form must add the matching labels via the label picker after
  filing (the template reminds them).
- **Durable fix:** a small label-sync Action that reads the form answers and applies the
  labels automatically — blocked until GitHub Actions is re-enabled (billing lock).

## Related

- `.claude/rules/RESPONSE-FORMAT-CONTRACT.md` — how work is reported back.
- `.github/ISSUE_TEMPLATE/backlog-item.yml` — the form encoding this schema.
- `CLAUDE.md` → Git Workflow — branch/PR/merge rules and the Codex automation lane.
