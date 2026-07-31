# Feature Implementation Workflow

- Applies to: All Procore feature implementations (UI, API, DB, tests)

## Purpose

This workflow defines the minimum effective process required to implement a Procore feature correctly, verifiably, and repeatably.

The goal is shipping real, working features—not producing paperwork.

## Core Principles (Non-Negotiable)
	1.	The feature folder is the single source of truth
	2.	No proof = not done
	3.	Tests + quality checks are mandatory
	4.	Verification is skeptical and independent
	5.	If it’s confusing, simplify

## Canonical Feature Folder

Every feature lives in exactly one place:

```
docs/project-mgmt/{feature}/
```

Everything related to the feature goes here.

Nothing critical goes in .claude/, temp folders, or agent memory.

## Required Files

```
docs/project-mgmt//{feature}/
├── STATUS.md           # Current state + what’s next
├── TASKS.md            # Checklist of work (single source of tasks)
├── PLAN.md             # Short implementation plan
├── TEST-RESULTS.md     # Real test output (latest run)
├── VERIFICATION.md     # Evidence-based verification
├── crawl-{feature}/    # Procore reference artifacts (if available)
└── reports/            # Optional (screenshots, html reports, notes)
```

If a file does not exist, that step is not complete.

## The 4-Step Workflow (This Is the Whole Process)

### Step 1 — Understand (Research)

**Goal: Know what exists and what’s missing.**

- **Action:**
    - Read the codebase
    - Review Procore crawl artifacts (if present)
    - Identify gaps vs. desired feature parity

- **Required Update:**
    - Update STATUS.md with:
    - What already exists
    - What is missing
    - What you will work on next

**Rule:** Do not create a separate research doc. Research lives in STATUS.md.


### Step 2 — Plan (Decide, Don’t Speculate)

- **Goal:** Decide how the feature will be implemented.
- **Output:** PLAN.md (short, decisive)

- **PLAN.md must include:**
    - Pages/routes involved
    - API endpoints involved (or “none”)
    - Database tables involved (or “none”)
    - UI components/patterns used
    - Tests that will be written

- **Constraints:**
    - No essays
    - No future hypotheticals
    - If unsure, choose the simplest viable approach


### Step 3 — Implement (Work the Checklist)

**Goal: Execute the plan.**

**Action:**
- Implement tasks listed in TASKS.md
- Check items off only after code exists
- Add a link to the completed file path and/or url

**Rules:**
- If you touch DB → verify schema + regenerate types
- If you touch UI → follow existing design system
- If you add behavior → add tests
- Do not claim completion in chat—only via files


### Step 4 — Prove (Gates)

A feature is not complete until all gates pass.

This step produces evidence, not opinions.

## Gates (Mandatory and Enforceable)

### Gate 1 — Code Quality

Run from repo root:
```
npm run quality --prefix frontend
```

Requirement:
- Zero TypeScript errors
- Zero lint errors

Evidence:
- Paste actual terminal output into TEST-RESULTS.md


### Gate 2 — Tests

Run feature tests:
```
npx playwright test frontend/tests/e2e/{feature}*.spec.ts
```

Requirement:
- All tests pass
- No skipped tests
- No retries hiding failures

Evidence:
- Paste actual test output into TEST-RESULTS.md
- If Playwright HTML report is generated, link or reference it


## Gate 3 — Verification (Independent & Skeptical)

Output: VERIFICATION.md

The verifier assumes nothing is correct without proof.

**VERIFICATION.md Template**

```
# Verification: {feature}

## Quality Check
Command:
npm run quality --prefix frontend

Result:
PASS / FAIL

Evidence:
[paste actual output]

## Test Results
Command:
npx playwright test frontend/tests/e2e/{feature}*.spec.ts

Result:
PASS / FAIL

Evidence:
[paste actual output]

## Functional Verification
- [ ] Feature works as described in PLAN.md
- [ ] Matches Procore reference (if available)
- [ ] No console errors
- [ ] Responsive at 375px width
- [ ] No obvious UX regressions

Notes:
[brief, concrete observations]

## Final Verdict
VERIFIED / FAILED
```

If any section fails → fix the issue → re-run gates → update files.


Definition of “Complete”

A feature is COMPLETE only when all are true:
- All tasks checked in TASKS.md
- PLAN.md exists and reflects implementation
- TEST-RESULTS.md contains real, recent output
- VERIFICATION.md ends in VERIFIED
- STATUS.md updated to “Complete” with next action

Anything less = not done.


## STATUS.md Contract (Important)

STATUS.md must always answer one question:

What is the current state, and what happens next?

**Example**

```
Status: In Progress

Completed:
- List page implemented
- API GET endpoint added
- Basic tests written

In Progress:
- Edit form validation

Next:
- Finish edit form
- Run tests
- Verification
```

No history logs. No essays. Just truth.


## Known Pitfalls (Read Before Testing)

- Do not rely on waitForLoadState('networkidle') in SPAs
- Prefer:
    * domcontentloaded
    * explicit locator waits

**Do not claim “tests should pass”**

Paste real output or it didn’t happen.

**Do not stop when something fails**

Fix → re-run → prove.


## Codex Compatibility Notes

This workflow:
- Uses no slash commands
- Assumes no Claude-specific routing
- Works with:
- Codex CLI
- Codex in VS Code
- GitHub PR reviews
- Human execution

Invocation is explicit:

“Follow .agents/workflows/feature-implementation.md exactly.”


## When to Stop and Ask

Stop only if:
- Required credentials/access are missing
- A core architectural decision is ambiguous
- You are blocked after multiple concrete attempts

Do not stop to:
- Ask permission to continue
- Report failures without fixing
- Ask “should I do X?” — decide and do


## Final Reminder
- Files are the system
- Evidence beats confidence
- Simple processes ship faster

If this workflow feels heavy, something is wrong with the work—not the process.