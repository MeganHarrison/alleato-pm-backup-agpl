# Daily Brief Design Benchmark: Shared Brief

Use this exact brief for every candidate. Do not add a section, action, or
metric just because it is available in the packet.

## Job to solve

An executive opens the Daily Brief at the start of the day. In under one
minute, they must understand what needs a decision, who owns the next move,
the cost or schedule consequence of delay, and how to open the relevant record
or source without losing their place.

## Fixed fixture

Business date: Tuesday, June 10, 2026.

Three decisions require action today:

1. Union Collective: approve change order CO-047 before Thursday's concrete
   pour. The scope addition is $38K.
2. Vermillion Rise Warehouse: decide whether to release a disputed $12K
   electrical subcontractor payment.
3. Maple Street Mixed-Use: resolve an owner-supplied-material decision before
   procurement moves forward.

Supporting information:

- Five open follow-ups, two meetings today.
- One schedule constraint tied to the concrete pour.
- Current source coverage: meetings, email, Teams, and documents.
- Each item has a canonical record path and source evidence, but the fixture
  must never invent a source, amount, owner, deadline, or workflow capability.

## Required outcome

- The first screen makes the highest-consequence decision and its next action
  unmistakable.
- A decision can be opened, assigned/escalated where supported, and traced to
  its source or canonical record.
- Supporting narrative and source coverage do not compete with the action
  queue. They appear only when they help the user decide.
- The user can return to the queue without losing context.
- Small screens preserve the decision order and usable actions without
  horizontal overflow or hover-only controls.

## Hard constraints

- Keep the canonical packet and governed-artifact contracts intact.
- Reuse existing Daily Brief, attention, button, link, detail, and error
  primitives. Do not create page-local component systems.
- No KPI row, hero metric, decorative dashboard, wrapper card, nested card,
  duplicate CTA, or invented quick action.
- Do not expose a control that has no real data/API action. Missing capability
  must be explicit and recoverable.
- Preserve an accessible, keyboard-operable path to each real action.

## Candidate deliverables

Each candidate returns only these artifacts in its isolated worktree:

1. A code patch scoped to the canonical Daily Brief composition and its shared
   owner files.
2. `candidate.json`, validated by `scripts/design-benchmark/daily-brief.mjs`.
3. Desktop and 390px screenshots on the exact fixture.
4. A short interaction transcript proving: open top decision, inspect evidence,
   take or reach the next action, and return to the queue.

## Attention brief

Primary user: executive responsible for removing cross-project blockers.

Primary job: decide and initiate the highest-value action before the next
meeting or schedule commitment.

Primary decision: which issue must move today, and what is the correct action.

Tier 1: decision title, consequence of delay, due constraint, accountable
owner, and one real next action.

Tier 2: evidence confidence, canonical record/source link, and the remaining
open decision queue.

Tier 3: supporting narrative, project context, schedule/money detail, and
source-coverage metadata.

Hide until requested: historical packet metadata, full source counts, verbose
methodology, resolved history, and technical identifiers.

Remove: duplicate summaries, contents-only navigation, decorative status pills,
or a secondary workflow that makes the next action ambiguous.

Primary action: open and progress the highest-consequence decision.

Failure-loudly behavior: a missing action or source link names what is missing
and offers the available recovery path. It never renders a convincing but dead
control.
