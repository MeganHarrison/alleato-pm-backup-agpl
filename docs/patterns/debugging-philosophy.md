# The Debugging Philosophy: Localize Before You Fix

**Status:** Active · **Since:** 2026-07-14 · **Enforced by:** `.claude/rules/DEBUGGING-GATE.md` + `UserPromptSubmit` hook
**Audience:** Every agent (Claude Code, Codex, subagents) and every human debugging in this codebase.

---

## Why this document exists

On 2026-07-13 an agent spent two hours debugging disappearing drawing annotations.
It edited reconciliation logic, ID handling, and hydration code — none of which were
broken. The actual cause was a development overlay (Agentation) silently mutating the
application's SVG DOM. The information that would have solved it in ten minutes was
available the entire time: **React state said six annotations existed while the DOM
held zero.** That single observation proves the fault lies between React rendering and
the DOM — and proves the API, persistence, and hydration layers innocent.

The failure was not a missing rule about Agentation. It was a debugging *method*:
reasoning over source code and guessing, instead of observing the running system and
localizing. This document is the method that replaces it, and a map of how it is
enforced so it cannot quietly be skipped.

---

## The philosophy in one paragraph

Debugging is **binary search over layer boundaries, driven by observation**. Every
system is a chain of layers (database → API → client state → DOM/UI; or request →
handler → service → database). A bug lives at exactly one boundary: the first place
where *expected* diverges from *observed*. The job is to find that boundary with
evidence, instrument it, and only then change code. Everything upstream of the first
divergence is provably innocent; everything you edit before localizing is a guess that
contaminates your next observation.

## The Iron Law

> **No product-code edit until the fault is localized to a layer boundary, with the
> observation that proves it.**

If you cannot complete the sentence *"the divergence is between layer X and layer Y,
and here is the evidence"*, you are not debugging yet.

---

## The workflow

### 1. Observe the running system — never debug by re-reading source

Reproduce the bug once and capture the actual state at every layer: the DB row, the
API response, the client state, the DOM. Use browser DevTools, logs, breakpoints, and
DB reads. Agents especially default to re-reading code and forming hypotheses inside
the code they can see — but external interference (dev overlays, portals,
MutationObservers, other scripts) is invisible to code-reading. Only observation
finds it.

### 2. Find the first boundary where expected ≠ observed

Walk the chain until reality diverges from expectation. Then stop investigating
everything upstream — it is excluded by evidence, not by opinion.

```text
DB row exists?          ✓  →
API returned it?        ✓  →
React state has it?     ✓  →
DOM renders it?         ✗  ← the fault is HERE, between state and DOM
```

In the annotation incident, half the two hours was spent in territory (APIs, IDs,
persistence) that this two-minute walk had already ruled out.

### 3. Instrument that boundary — and nothing else

- State vs DOM disagree → **DOM subtree-modification breakpoint** in DevTools. The
  debugger pauses inside whatever code removes the nodes and hands you the call stack.
- API vs state disagree → log the state transition.
- Request vs DB disagree → read the row back after the write.

### 4. Suspect the environment? Run the isolation split

Run the same component or flow in a minimal context (unit test, bare route, or a
production-like build with dev tooling off) versus the full app.

- Works isolated + breaks in the app → **the environment is the culprit.** Inventory
  what else is mounted (overlays, dev tooling, portals, globals) before touching
  product code.
- Breaks in both → the fault is in the component; keep bisecting inside it.

One binary test, ~5 minutes, halves the search space.

### 5. Stop-loss: two failed hypotheses means an assumption is wrong

After two failed hypotheses, the problem is no longer the code — it is something you
believe that isn't true ("nothing else mutates this DOM", "hiding the toolbar disables
the runtime", "this effect only runs once"). Stop generating hypothesis #3. List your
assumptions explicitly and test *them*. After three failed **fixes**, question the
architecture and report to Megan rather than attempting fix #4.

### Forbidden while debugging

- **Speculative edits** ("maybe it's hydration") — no edit without a stated prediction
  of what it will prove. Speculative edits make failures look intermittent.
- **Multiple changes per hypothesis** — you can't isolate what worked.
- **Declaring a root cause without the controlled comparison that proves it** — an A/B
  with the suspect disabled. Correlation plus a plausible story is still a hypothesis.
- **Fixing by special-case exclusion** (route bans, one-off guards) when the real fix
  is one global boundary — e.g. dev instrumentation off by default during
  verification, enabled by one explicit switch.

### The completion contract

A bug-fix report must state: (1) the localized boundary and its evidence, (2) the
confirmed root cause and how it was confirmed, (3) the minimal fix, (4) the guardrail
per CLAUDE.md Core Principles. "Fixed" without localization evidence is the debugging
equivalent of "done" without visual proof.

---

## How it is enforced (the architecture)

The central design decision: **one process rule instead of N symptom rules**, and
**deterministic injection instead of advisory text alone**. Skills and instructions
are judgment calls a model can rationalize past under momentum — that is exactly how
the two-hour incident happened *despite* an installed systematic-debugging skill. So
the law lives in layers with different strengths:

| Layer | Where | Mechanism | Covers | Strength |
|---|---|---|---|---|
| Gate rule | `.claude/rules/DEBUGGING-GATE.md` | Injected into every session's context in this repo | All Claude Code sessions | Always in context |
| Prompt hook (repo) | `scripts/hooks/debugging-gate-reminder.mjs` via `UserPromptSubmit` in `.claude/settings.json` | Harness runs it on every prompt; injects the law when the prompt matches debugging language | Anyone working in this repo, incl. cloud/CI sessions | **Deterministic** |
| Prompt hook (user) | `~/.claude/hooks/debugging-gate-reminder.mjs` via `~/.claude/settings.json` | Same, machine-wide; defers to the repo copy when present to avoid double injection | Every repo on Megan's machine | **Deterministic** |
| CLAUDE.md section | `CLAUDE.md` → "Debugging (Mandatory)" | Project instructions loaded every session | Claude Code agents | Always in context |
| AGENTS.md Rule 10 | `AGENTS.md` | Codex instruction file | Codex automation lane | Always in context |
| Long-form skill | `superpowers:systematic-debugging` (plugin) | Invoked at the start of debugging tasks | Claude Code agents | Advisory |

**What fires when:** you type a prompt containing debugging-shaped language ("bug",
"broken", "not working", "failing", "error", "regression", "crash", "disappears",
"why is/doesn't"…) → the hook prints the condensed iron law, and the harness attaches
it to your prompt as context. Non-debugging prompts pass through silently. False
positives cost a few lines of context; a false negative is the two-hour failure mode,
so the regex errs eager.

## Maintaining it

- **Change the philosophy** → edit `.claude/rules/DEBUGGING-GATE.md` (single source of
  truth), then mirror the condensed text inside the two hook scripts if the core steps
  changed.
- **Tune the trigger** → edit the `debugSignals` regex in
  `scripts/hooks/debugging-gate-reminder.mjs` (and the `~/.claude/hooks/` copy).
- **Disable temporarily** → `/hooks` in an interactive session, or remove the
  `UserPromptSubmit` entry from the relevant `settings.json`.
- **Other repos** → copy the gate file + hook script + settings entry (alleato-pm
  mirror tracked separately); the user-level hook already covers any repo on this
  machine in the meantime.

## FAQ

**Why isn't the Superpowers skill enough on its own?**
Skill invocation is a model judgment call: only the skill's one-line description is in
context, and under debugging momentum models rationalize skipping it ("this one's
simple"). The gate puts the law in context permanently; the hook re-asserts it at the
exact moment a debugging task starts. The skill remains the long-form reference.

**Why one rule instead of guardrails per culprit (e.g. "Agentation off on drawing
routes")?**
Content rules encode conclusions of past failures and don't transfer; they accumulate
forever. A process rule targets the behavior (guess-and-edit) and covers every future
culprit. The only content-shaped companion is environmental hygiene: dev
instrumentation off by default during verification, behind one explicit switch.

**Does this slow down simple fixes?**
No — for a genuinely simple bug the layer walk takes a minute and usually *is* the
fix. Systematic is faster than thrashing precisely when the bug looks simple and
isn't.

## Related

- `.claude/rules/DEBUGGING-GATE.md` — the enforced rule (condensed form of this doc)
- `docs/patterns/error-patterns.md`, `docs/patterns/PATTERNS.md` — known concrete error patterns
- `.claude/rules/BATCHING-GATE.md` — deep-verify-once-per-slice; produces the evidence this workflow consumes
- `.claude/rules/VISUAL-PROOF-GATE.md` — the completion-evidence twin of the completion contract above
- `superpowers:systematic-debugging` skill — long-form four-phase method
