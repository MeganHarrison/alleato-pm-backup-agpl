# Visual Proof Gate

**Trigger:** Any time you are about to mark a task completed, tell the user a fix
is done, close out a feedback item, or summarize finished work. This applies to
every task — bug fixes, features, UI changes, API changes.

## The rule

**A task cannot be closed out without visual proof that the fix works.** Saying
"done", "fixed", or "verified" without attaching the evidence below does NOT
count as completing the task.

Proof requirements, in strict order of preference:

1. **Screenshot(s) of the fixed behavior in the running app** (default —
   applies to virtually everything). The screenshot must show the actual
   outcome the user asked for, not just that the page renders. If the fix is
   about data correctness, the screenshot must show the corrected values in
   context so the user can compare them (e.g. a drilldown panel next to or
   after the table value it must match). One screenshot **per fixed item** —
   a six-item feedback batch needs proof for each item, not one generic page
   shot.
2. **A link to the live page** demonstrating the fix — only when the change
   genuinely cannot be captured in a screenshot (rare: e.g. a download,
   an email send, a background job). Include what to click and what the user
   should expect to see.
3. **A link to the changed file plus a screenshot of the edited code** — last
   resort, only when there is nothing user-visible at all (e.g. pure infra
   or config). Explain why no visual/behavioral proof exists.

## What counts as the right screenshot

- Taken from the environment the user will actually use (production after
  merge, or the preview/local build when reporting pre-merge) — say which.
- Shows the specific fixed element, not a distant full-page view where the
  fix is illegible.
- For data-parity fixes (column ↔ drilldown, form ↔ detail page, export ↔
  screen): capture **both sides** so the match is visible, or capture them
  back-to-back and state the values being compared.
- For "X should no longer appear" fixes: capture the state where it used to
  appear, showing it gone.

## Worked example (the case that created this rule)

Budget page feedback, 2026-07-01 (PR #621): the Approved COs column showed
$700 but the sidebar showed $0. Closing that task required screenshots of:
the budget table row (baseline values), the Approved COs sidebar showing
$700/PPCO-001, the Committed Costs sidebar showing the rows summing to the
column's $56,500, the JTD and Direct Costs panels matching their columns,
and the Forecast modal opening on the locked budget. A text summary alone —
even with passing tests and green CI — was not sufficient to close it.

## How this composes with existing gates

- `agent-browser` verification (CLAUDE.md "Browser Verification") already
  requires taking and reading a screenshot before claiming UI work complete.
  This gate adds: those screenshots (or fresh ones from the deployed fix)
  must be **shown to the user in the completion report**, item by item.
- `verify-feature` / BATCHING-GATE deep verification produce evidence as a
  by-product — attach it; do not re-derive claims from memory.
- Tests and CI passing are necessary but never sufficient: they are not
  visual proof.

## Why this gate exists

A six-item budget feedback batch was reported "complete, merged, live" with a
text summary. The user had no way to confirm the drilldown side panels
actually matched the budget table without re-testing everything herself.
Completion claims without visible evidence shift the verification burden back
onto the user — the opposite of what "done" means.
