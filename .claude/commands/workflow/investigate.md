---
description: "Run the Bug Investigation Team to audit features against Procore reference data"
argument-hint: "<feature-name|--all> [--retest] [--triage]"
---

# /investigate - Bug Investigation Team Orchestrator

Launches the Bug Investigation Team to systematically audit one or more features against Procore crawl data. Finds real bugs with evidence.

## Usage

```bash
# Investigate a single feature (full deep dive)
/investigate budget

# Triage all features (quick sweep)
/investigate --all

# Re-test a feature after fixes (live test only)
/investigate commitments --retest

# Quick triage only (no deep dives)
/investigate --triage
```

## Agent Instructions

You are the Bug Investigation Team orchestrator. Read `.claude/agents/bug-team/investigation-orchestrator.md` for the full protocol.

### Step 1: Parse Arguments

```
Arguments provided: {arguments}
```

Extract:
- **Feature name** (e.g., "budget", "commitments") OR `--all` for all features
- **--retest** flag: Skip expert/audit, run live tests only
- **--triage** flag: Quick sweep only, no deep dives

### Step 2: Create Investigation Directory

```bash
mkdir -p .claude/investigations/triage
```

If single feature:
```bash
mkdir -p .claude/investigations/{feature}
```

### Step 3: Determine Investigation Mode

**Mode A: Single Feature Deep Dive** (default when feature name given)

Run the full 4-phase investigation:

1. **Procore Feature Expert** — Read crawl data, produce reference spec
2. **Code Auditor** — Compare source code against reference
3. **Live Tester** — Run the app, test CRUD, capture evidence
4. **Synthesize** — Combine findings into prioritized report

**Mode B: Triage All Features** (`--all` or `--triage`)

Quick sweep of every feature:

```bash
# Get list of implemented features
ls frontend/src/app/(main)/[projectId]/
```

For each feature, spawn a lightweight audit:

```typescript
Task({
  subagent_type: "Explore",
  prompt: `Quick triage of {feature}:

1. Check if page exists: frontend/src/app/(main)/[projectId]/{feature}/page.tsx
2. Check if it has real content (not just placeholder/loading)
3. Check for API route: frontend/src/app/api/projects/[projectId]/{feature}/route.ts
4. Check for hook: frontend/src/hooks/use-{feature}*.ts
5. Check for service: frontend/src/services/{feature}*.ts
6. Check Procore DOM reference exists: scripts/screenshot-capture/outputs/dom/goodwill_bart_-_{feature}.html

Rate completeness 1-10:
- 1-2: Placeholder only
- 3-4: Page exists but no CRUD
- 5-6: Partial CRUD (list works, create/edit don't)
- 7-8: Most CRUD works, some gaps vs Procore
- 9-10: Feature-complete vs Procore reference

Save to: .claude/investigations/triage/{feature}.md`,
  description: "Triage {feature}"
})
```

If `--all` (not `--triage`), also deep dive the worst 3-5 features.

**Mode C: Retest** (`--retest`)

Skip expert and audit phases. Run Live Tester only:

```typescript
Task({
  subagent_type: "debugger",
  prompt: `Re-test {feature} after fixes.

Read previous report: .claude/investigations/{feature}/investigation-report.md
Focus on previously-failed items.

Test at http://localhost:3000/{projectId}/{feature}
Capture evidence for each test.

Save to: .claude/investigations/{feature}/retest-{date}.md`,
  description: "Retest {feature}"
})
```

### Step 4: Execute Investigation

#### For Single Feature Deep Dive:

**Phase A — Feature Expert:**

```typescript
Task({
  subagent_type: "Explore",
  prompt: `You are the Procore Feature Expert.
Read .claude/agents/bug-team/procore-feature-expert.md for your protocol.

Research what Procore's {FEATURE} tool looks like:

1. Read DOM snapshot: scripts/screenshot-capture/outputs/dom/goodwill_bart_-_{feature}.html
2. Read analysis JSON: scripts/screenshot-capture/outputs/analysis-json/goodwill_bart_-_{feature}.json
3. Check for feature crawl data: scripts/screenshot-capture/outputs/{feature}/
4. ASSESS DATA QUALITY: If coverage is Low/missing or data looks stale, check for a crawler script:
   Glob: scripts/screenshot-capture/scripts/crawlers/crawl-{feature}*.js
   If found, RUN IT to get fresh data (crawlers auto-authenticate via .env).

Produce a structured reference spec covering:
- Page layout and navigation
- Table columns (names, order, types)
- Form fields (names, types, required)
- Available actions and buttons
- Key behaviors (sort, filter, pagination, workflows)

Save to: .claude/investigations/{feature}/procore-reference.md`,
  description: "Procore reference for {feature}"
})
```

**Phase B — Code Audit:**

```typescript
Task({
  subagent_type: "Explore",
  prompt: `You are the Code Auditor.
Read .claude/agents/bug-team/code-auditor.md for your protocol.

Audit {FEATURE} implementation:

1. Read the Procore reference: .claude/investigations/{feature}/procore-reference.md
2. Inventory all feature files (pages, APIs, hooks, services, components)
3. Compare CRUD completeness against reference
4. Check column parity (DB vs Procore)
5. Check form field parity
6. Flag pattern violations
7. Check database.types.ts for the feature's table

Produce a scored audit report.
Save to: .claude/investigations/{feature}/code-audit.md`,
  description: "Code audit {feature}"
})
```

**Phase C — Live Test:**

```typescript
Task({
  subagent_type: "debugger",
  prompt: `You are the Live Tester.
Read .claude/agents/bug-team/live-tester.md for your protocol.

IMPORTANT: Auth is automatic. Never ask the user to log in.
Dev server should be running on localhost:3000.

Test {FEATURE} at http://localhost:3000/31/{feature}:

1. Navigate to the page, verify it loads
2. Check for console errors
3. Verify list/table renders with data
4. Test Create: open form, fill fields, submit
5. Test Edit: open existing record, modify, save
6. Test Delete: if available
7. Test form validation: submit empty required fields
8. Compare what you see against .claude/investigations/{feature}/procore-reference.md

Capture evidence for EVERY test (what you saw, any errors).
Save to: .claude/investigations/{feature}/live-test.md`,
  description: "Live test {feature}"
})
```

**Phase D — Synthesize (You do this):**

Read all three reports and produce:

```markdown
# Investigation Report: {Feature}

## Overall Status: WORKING / PARTIAL / BROKEN / NOT STARTED
## Completeness Score: X/10

### What Works (Confirmed by Live Test)
- [item with evidence]

### What's Broken (Confirmed by Live Test)
| Issue | Severity | Evidence |
|-------|----------|----------|
| ... | Critical/High/Med/Low | [proof] |

### What's Missing vs Procore
| Procore Has | We Have | Gap |
|-------------|---------|-----|
| ... | ... | ... |

### Priority Fix List
1. **[Fix]** — [Impact] — Effort: S/M/L
2. ...
```

Save to: `.claude/investigations/{feature}/investigation-report.md`

### Step 5: Update Summary

If investigating multiple features, produce a cross-feature summary:

```markdown
# Bug Investigation Summary — {date}

## Features Investigated: {count}

| Feature | Score | Critical | Status |
|---------|-------|----------|--------|
| ... | X/10 | N issues | WORKING/PARTIAL/BROKEN |

## Top 10 Priority Fixes
1. [Fix] in [Feature] — [Impact]
...
```

Save to: `.claude/investigations/INVESTIGATION-SUMMARY.md`

### Step 6: Report to User

Provide a concise summary:
- How many features investigated
- Overall health assessment
- Top 3-5 priority fixes
- Link to full reports in `.claude/investigations/`
