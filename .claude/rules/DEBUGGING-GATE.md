# Debugging Gate

**Full documentation:** `docs/patterns/debugging-philosophy.md` — the philosophy,
worked example, enforcement architecture, and maintenance guide. This gate is its
condensed, enforced form.

**Trigger:** Any bug, test failure, regression, crash, or unexpected behavior — BEFORE
proposing or applying any fix. This is the process rule that replaces symptom-specific
guardrails: it targets *how* to debug, so it generalizes to every future bug.

## The Iron Law

**No product-code edit until the fault is localized to a layer boundary, with the
observation that proves it.**

If you cannot state "the divergence is between layer X and layer Y, and here is the
evidence," you are not debugging — you are guessing. Every speculative edit also
contaminates the next observation, which makes failures look intermittent and
timing-related when they are not.

## The workflow (this is the 10-minute path)

1. **Observe the running system first — never debug by re-reading source.**
   Reproduce once and capture the actual state at every layer: DB row → API response →
   client state → DOM/UI (adapt the chain to the stack: request → handler → service →
   DB, etc.). Use browser tools, logs, breakpoints, and DB reads — not code reasoning.
   External interference (dev overlays, portals, MutationObservers, globals) is
   invisible to code-reading; only observation finds it.

2. **Find the FIRST boundary where expected ≠ observed.**
   Everything upstream of that boundary is *provably* innocent — stop investigating it.
   Example: React state holds 6 annotations, the SVG holds 0 → APIs, persistence,
   IDs, and hydration are all excluded by that single observation.

3. **Instrument that boundary and nothing else.**
   State-vs-DOM divergence → DOM subtree-modification breakpoint (DevTools pauses in
   whatever code removes the nodes and hands you the call stack). API-vs-state →
   log the state transition. Request-vs-DB → read the row back.

4. **Suspect the environment? Run the isolation split.**
   Same component/flow in a minimal context (unit test, bare route, production-like
   build with dev tooling off) vs. the full app. Works isolated + breaks in app =
   the environment is the culprit — inventory what else is mounted before touching
   product code. This one binary test halves the search space in ~5 minutes.

5. **Stop-loss: after 2 failed hypotheses, the code is not the problem — an assumption is.**
   Stop. List every assumption you are relying on ("nothing else mutates this DOM",
   "hiding the toolbar disables the runtime", "this only runs once") and test the
   assumptions, not a third hypothesis. After 3+ failed fixes, question the
   architecture and report to Megan instead of attempting fix #4.

## Forbidden while debugging

- Speculative edits ("maybe it's hydration") — no edit without a stated prediction of
  what it will prove.
- Multiple changes per hypothesis — you cannot isolate what worked.
- Declaring a root cause without the controlled comparison that proves it (A/B with
  the suspect disabled). Correlation + a plausible story is still a hypothesis.
- Fixing by special-case exclusion (route bans, one-off guards) when the real fix is
  one global boundary (e.g., dev instrumentation off by default during verification,
  enabled via one explicit switch).

## Completion contract

A bug-fix report must state: (1) the localized boundary + the evidence, (2) the
confirmed root cause and how it was confirmed, (3) the minimal fix, (4) the guardrail
per CLAUDE.md Core Principles. "Fixed" without the localization evidence is the
debugging equivalent of "done" without visual proof — it does not count.

## Relation to skills

When the `superpowers:systematic-debugging` skill is available, invoke it at the start
of any debugging task — it is the long-form version of this gate. This gate exists
because skill invocation is advisory (a judgment call the model can rationalize past);
the gate puts the law in every session's context, and the `UserPromptSubmit` hook
(`scripts/hooks/debugging-gate-reminder.mjs`) re-injects it at the moment a debugging
prompt arrives.

## Why this gate exists

2026-07-13: two hours were spent debugging disappearing drawing annotations by editing
reconciliation, ID-handling, and hydration code — while React state and the DOM
disagreed the entire time. A dev overlay (Agentation) was mutating the application's
SVG. A layer walk (step 2) would have excluded the persistence stack in two minutes; a
DOM mutation breakpoint (step 3) or an isolation split (step 4) would have produced the
culprit's call stack in ten. The failure was not a missing rule about Agentation — it
was debugging by code-reading instead of observation, and editing before localizing.
