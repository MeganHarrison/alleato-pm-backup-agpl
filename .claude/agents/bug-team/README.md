# Financial Tools Agent Team — v2

A 5-teammate Claude Agent Team that systematically investigates, implements, tests, and certifies all 7 Alleato financial tools. Uses Claude Agent Teams (experimental) for true peer-to-peer coordination.

---

## The 7 Financial Tools

| Tool | URL | Priority | Status |
|------|-----|----------|--------|
| Invoicing | /67/invoices | **P0** — needs full build | 2 files, no CRUD |
| Direct Costs | /67/direct-costs | **P1** — form hang bug | Hybrid, broken form |
| Prime Contracts | /67/prime-contracts | **P2** — 3 known bugs | Complete but buggy |
| Change Events | /67/change-events | **P2** — verify CRUD | UnifiedTablePage |
| Change Orders | /67/change-orders | **P2** — verify aggregate | Complex 3-type merge |
| Budget | /67/budget | **P3** — polish | Most comprehensive |
| Commitments | /67/commitments | **P3** — reference impl | Gold standard |

---

## Team Members — v2

| Agent | File | Model | Role |
|-------|------|-------|------|
| **Team Lead** | `financial-tools-lead.md` | opus | Orchestrates all phases, tracks status |
| **Spec Auditor** | `procore-feature-expert.md` + `code-auditor.md` | sonnet | Procore reference + gap analysis |
| **Implementor Alpha** | `financial-implementor.md` | sonnet | Budget, Prime Contracts, Change Events, Change Orders |
| **Implementor Beta** | `financial-implementor.md` | sonnet | Direct Costs + Invoicing (critical path) |
| **E2E Tester** | `e2e-tester.md` | sonnet | ALL E2E testing via agent-browser (sole owner) |
| **DoD Verifier** | `dod-verifier.md` | opus | Final 10-point Definition of Done certification |

**Supporting reference agents (not spawned as teammates):**
- `investigation-orchestrator.md` — legacy orchestration patterns
- `live-tester.md` — testing patterns (superseded by e2e-tester for live runs)
- `financial-implementor.md` — implementation patterns (read by implementors)
- `procore-feature-expert.md` — spec authority (read by spec-auditor)
- `code-auditor.md` — audit patterns (read by spec-auditor)

---

## Prerequisites

1. **Agent teams enabled:** `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` — already set in `.claude/settings.json`
2. **Dev server running:**
   ```bash
   cd frontend && npm run dev
   ```
3. **Auth configured:** Pre-saved in `frontend/tests/.auth/user.json` — no action needed

---

## How to Start the Team

### Full Financial Tools Completion Cycle

Copy this prompt into Claude Code to launch the team:

```
Create an agent team to complete all 7 Alleato financial tools and bring them to certified production quality.

Read the team lead instructions: .claude/agents/bug-team/financial-tools-lead.md

Spawn these 5 teammates:
1. spec-auditor (sonnet) — reads Procore specs and audits code gaps for all 7 tools
2. implementor-alpha (sonnet) — fixes Budget, Prime Contracts, Change Events, Change Orders
3. implementor-beta (sonnet) — fixes Direct Costs form hang + builds full Invoicing
4. e2e-tester (sonnet) — ONLY writes and runs e2e tests via agent-browser for all 7 tools
5. dod-verifier (opus) — final verification against 10-point Definition of Done

Phase order (strictly enforced):
Phase 1: spec-auditor investigates all 7 tools (must complete first)
Phase 2: implementor-alpha and implementor-beta work in parallel
Phase 3: e2e-tester runs all tests (after both implementors done)
Phase 4: dod-verifier certifies each tool (after e2e-tester done)

Do NOT mark any tool complete until dod-verifier issues CERTIFIED status.
Test project: ID 67. Dev server: http://localhost:3000.
Agent files: .claude/agents/bug-team/
```

---

### Single Tool Fix (Quick Mode)

For fixing just one tool without the full team:

```
Fix the Direct Costs tool in the Alleato PM app.

1. Spawn one investigator to audit the tool:
   - Read .claude/agents/bug-team/code-auditor.md
   - Audit frontend/src/app/(main)/[projectId]/direct-costs/ and components/direct-costs/
   - Save report to .claude/investigations/direct-costs/investigation-report.md

2. Spawn one implementor to fix confirmed issues:
   - Read .claude/agents/bug-team/financial-implementor.md
   - Priority 1: Fix form hang in DirectCostForm.tsx
   - Run npx tsc --noEmit after fixes

3. Spawn e2e-tester to verify:
   - Read .claude/agents/bug-team/e2e-tester.md
   - Test all 7 scenarios at http://localhost:3000/67/direct-costs
   - Project ID: 67
```

---

### Re-Test After Fixes

```
Spawn the e2e-tester to re-test [TOOL NAME] only.

Read: .claude/agents/bug-team/e2e-tester.md
Test: http://localhost:3000/67/[tool-path]
Project: 67
Save results: docs/financial-tools/e2e-results-[tool].md
```

---

## Execution Flow

```
┌─────────────────────────────────────────────────────┐
│                   TEAM LEAD (opus)                  │
│              financial-tools-lead.md                │
└──────────────────────┬──────────────────────────────┘
                       │ Phase 1
                       ▼
         ┌─────────────────────────┐
         │     SPEC AUDITOR        │
         │  (all 7 tools, serial)  │
         │  → .claude/investigations/  │
         └───────────┬─────────────┘
                     │ Phase 2 (parallel)
           ┌─────────┴──────────┐
           ▼                    ▼
  ┌────────────────┐   ┌────────────────┐
  │ IMPLEMENTOR α  │   │ IMPLEMENTOR β  │
  │ Budget         │   │ Direct Costs   │
  │ Prime Contracts│   │ Invoicing      │
  │ Change Events  │   │ (full build)   │
  │ Change Orders  │   │                │
  └────────────────┘   └────────────────┘
           │                    │
           └─────────┬──────────┘
                     │ Phase 3
                     ▼
         ┌─────────────────────────┐
         │      E2E TESTER         │
         │   (all 7 tools)         │
         │   agent-browser CLI     │
         │   → e2e-results-{tool}.md  │
         │   → tests/e2e/{tool}.spec.ts │
         └───────────┬─────────────┘
                     │ Phase 4
                     ▼
         ┌─────────────────────────┐
         │      DOD VERIFIER       │
         │   10-point checklist    │
         │   → DOD-final-report.md │
         │   ✅ CERTIFIED or ❌ BLOCKED │
         └─────────────────────────┘
```

---

## Output Structure

```
.claude/investigations/
├── TEAM-STATUS.md                    ← Lead's real-time status log
├── COMPLETION-REPORT.md              ← Final summary (written by lead)
├── {tool}/
│   ├── procore-reference.md          ← Procore spec (from spec-auditor)
│   ├── investigation-report.md       ← Gap analysis + score (from spec-auditor)
│   ├── implementation-report.md      ← What was fixed (from implementors)
│   └── dod-01-load.png, dod-10-mobile.png  ← Evidence screenshots (from dod-verifier)

docs/financial-tools/
├── e2e-results-budget.md             ← E2E test results (from e2e-tester)
├── e2e-results-prime-contracts.md
├── e2e-results-commitments.md
├── e2e-results-change-events.md
├── e2e-results-change-orders.md
├── e2e-results-direct-costs.md
├── e2e-results-invoicing.md
├── DOD-final-report.md               ← Final certification (from dod-verifier)
└── screenshots/                      ← Test evidence screenshots

frontend/tests/e2e/
├── budget-crud.spec.ts               ← Playwright tests (from e2e-tester)
├── prime-contracts-crud.spec.ts
├── commitments-crud.spec.ts
├── change-events-crud.spec.ts
├── change-orders-crud.spec.ts
├── direct-costs-crud.spec.ts
└── invoicing-crud.spec.ts
```

---

## Definition of Done (All 10 Required per Tool)

| # | Criterion | Who Checks |
|---|-----------|------------|
| 1 | Page loads < 3s, no console errors | dod-verifier |
| 2 | Table columns match Procore spec | dod-verifier |
| 3 | Create works end-to-end (toast + row appears) | e2e-tester + dod-verifier |
| 4 | Edit persists on page reload | e2e-tester + dod-verifier |
| 5 | Delete removes record + shows toast | e2e-tester + dod-verifier |
| 6 | Form validation blocks empty submit | e2e-tester + dod-verifier |
| 7 | Design system compliant (zero hardcoded colors, alert() = 0) | dod-verifier |
| 8 | TypeScript compiles with zero errors | implementors + dod-verifier |
| 9 | Playwright E2E test file written + passing | e2e-tester + dod-verifier |
| 10 | Mobile responsive at 375px | e2e-tester + dod-verifier |

---

## "Better Than Procore" Design Enhancements

Every implementor applies these improvements:

| Feature | Procore | Our App |
|---------|---------|---------|
| Status colors | Manual badge classes | `StatusBadge` — automatic |
| Empty states | Generic "No data" | `EmptyState` with contextual CTA |
| KPI metrics | Separate analytics page | `KpiRow` above every table |
| Toast messages | "Success" | Descriptive: "Invoice #INV-001 created" |
| Bulk actions | Limited | Multi-select → bulk status change + bulk delete |
| Search | Basic filter | Live search with debounce + filter chips |
| Animations | None | Framer Motion entrance on new rows |
| Mobile | Desktop-first | Fully responsive at 375px |

---

## Key Principles

**Evidence over assumptions.** Every finding must have proof.

**Fix confirmed issues only.** Implementors work from investigation reports, not guesses.

**Commitments is the gold standard.** All patterns should match:
- `frontend/src/features/commitments/feature-config.ts`
- `frontend/src/hooks/use-commitments.ts`

**E2E tester owns all tests.** No other agent writes test files.

**DoD verifier has final say.** No tool is done until dod-verifier says CERTIFIED.

---

## Agent Teams Feature

This team uses Claude's experimental Agent Teams feature:
- Each teammate is a separate Claude Code session
- Teammates message each other directly (not just through the lead)
- Shared task list coordinates work
- Use Shift+Down to cycle through teammates in terminal

Already enabled: `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` in `.claude/settings.json`
