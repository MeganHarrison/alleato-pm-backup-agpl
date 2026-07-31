---
description: "Execute standardized Procore feature implementation workflow with auto-resume and parallel session support"
argument-hint: "<feature-name> [--phase <phase>]"
---

# /implement-feature - Feature Implementation Orchestrator

Streamlined entry point for implementing Procore features. Automatically determines current state, reads shared workflow, and executes the appropriate phase.

## Usage

```bash
# Start or resume feature implementation (auto-detects phase)
/implement-feature direct-costs

# Force specific phase
/implement-feature commitments --phase research
/implement-feature rfis --phase implement

# Available phases: research, plan, analyze, implement, test, verify
```

## Agent Instructions

You are a feature implementation orchestrator. Your job is to coordinate the implementation of a Procore feature using the standardized 7-phase workflow.

### Step 1: Parse Arguments

Extract from the command:
- **Feature Name** (required): e.g., "direct-costs", "commitments", "rfis"
- **Phase Override** (optional): Force a specific phase instead of auto-detect

```
Arguments provided: {arguments}
```

Parse the feature name and any flags:
- `--phase <phase>` - Override auto-detected phase
- Valid phases: `research`, `plan`, `analyze`, `implement`, `test`, `verify`

### Step 2: Validate Prerequisites

**2a. Check feature directory exists:**
```
documentation/*project-mgmt/in-progress/{feature}/
```

If missing, respond:
```
Feature directory not found: documentation/*project-mgmt/in-progress/{feature}/

To start a new feature:
1. Create the directory: mkdir -p documentation/*project-mgmt/in-progress/{feature}
2. Run the Procore crawler: /feature-crawl {feature} <procore-url>
3. Then run: /implement-feature {feature}
```

**2b. Check for crawl data:**
```
documentation/*project-mgmt/in-progress/{feature}/crawl-{feature}/
```

If missing, suggest:
```
No Procore crawl data found. Run the crawler first:
/feature-crawl {feature} <procore-app-url> [procore-support-url]

Example:
/feature-crawl submittals https://us02.procore.com/562949954728542/project/submittals
```

### Step 3: Read Shared Workflow

Read the shared workflow template:
```
.agents/workflows/feature-implementation.md
```

This contains the full 7-phase workflow with all sub-agent patterns and gate requirements.

### Step 4: Read Feature Context

**4a. Read CONTEXT.md if it exists:**
```
documentation/*project-mgmt/in-progress/{feature}/CONTEXT.md
```

**4b. If CONTEXT.md doesn't exist, auto-generate from crawl data:**
- Read crawl metadata files from `crawl-{feature}/pages/*/metadata.json`
- Extract database tables from forms and table structures
- Identify existing code locations via quick codebase scan
- Create CONTEXT.md with extracted information

### Step 5: Determine Current Phase

**5a. Read STATUS.md if it exists:**
```
documentation/*project-mgmt/in-progress/{feature}/STATUS.md
```

**5b. If STATUS.md doesn't exist, check gate files:**

| Gate File | Indicates Phase Complete |
|-----------|-------------------------|
| `.claude/research/{feature}.md` | RESEARCH done |
| `{feature}/TASKS.md` + `PLANS.md` | PLAN done |
| TASKS.md has `[x]` analysis markers | ANALYZE done |
| `.claude/worker-done-{feature}-*.md` | IMPLEMENT in progress |
| `.claude/tests-passing-{feature}-*.md` | TEST done |
| `{feature}/VERIFICATION-*.md` with VERIFIED | VERIFY done |

**5c. Determine next phase:**
- If `--phase` flag provided, use that phase
- Otherwise, find the first incomplete phase based on gate files
- Create/update STATUS.md with current state

### Step 6: Check for Task Locks (Parallel Session Support)

If in IMPLEMENT phase with multiple tasks:

**6a. Read available tasks from TASKS.md**
**6b. Check for existing locks:**
```
.claude/locks/{feature}/*.lock
```

**6c. Skip locked tasks, pick first unlocked task**
**6d. Create lock file for claimed task:**
```markdown
# Lock: {task-id}
Session: {generate-unique-id}
Started: {timestamp}
Task: {task-description}
```

### Step 7: Execute Current Phase

Based on determined phase, execute the appropriate workflow section from `.agents/workflows/feature-implementation.md`.

**RESEARCH Phase:**
```typescript
Task({
  subagent_type: "Explore",
  prompt: `Research {feature} feature:
    1. Find existing {feature}-related code in frontend/src/
    2. Identify patterns used (DataTablePage, hooks, config files)
    3. List files that will need modification
    4. Note any existing tests
    5. Review Procore reference in crawl-{feature}/

    Write findings to: .claude/research/{feature}.md`,
  description: "Research {feature}"
})
```

**PLAN Phase:**
- Create TASKS.md with comprehensive task checklist
- Create PLANS.md with implementation strategy
- Reference crawl data for UI requirements
- Reference existing code patterns

**ANALYZE Phase:**
```typescript
Task({
  subagent_type: "Explore",
  prompt: `Analyze codebase against TASKS.md:
    1. Read {feature}/TASKS.md
    2. Check each item against existing code
    3. Mark [x] for complete items
    4. Update TASKS.md with current state`,
  description: "Analyze {feature} state"
})
```

**IMPLEMENT Phase:**
For each unchecked task in TASKS.md:
```typescript
Task({
  subagent_type: "frontend-developer", // or appropriate type
  prompt: `WORKER AGENT MODE
    Task: [specific task]
    Context: Read {feature}/PLANS.md
    Reference: crawl-{feature}/pages/

    Implement the task. Create .claude/worker-done-{feature}-{task-id}.md when done.`,
  description: "Implement {feature} {task}"
})
```

**TEST Phase:**
```typescript
Task({
  subagent_type: "test-automator",
  prompt: `TEST AGENT MODE
    Feature: {feature}
    Follow .agents/agents/playwright-tester.md
    Auth: test1@mail.com / test12026!!!

    Write and run tests. Fix any failures.
    Create .claude/tests-passing-{feature}-{task-id}.md when done.`,
  description: "Test {feature}"
})
```

**VERIFY Phase:**
```typescript
Task({
  subagent_type: "debugger",
  prompt: `SKEPTICAL VERIFIER MODE
    ASSUME THE WORKER LIED. Verify everything independently.

    1. Run: npm run quality --prefix frontend
    2. Run: npx playwright test frontend/tests/e2e/{feature}*.spec.ts
    3. Check each requirement in TASKS.md
    4. Compare with Procore screenshots

    Create {feature}/VERIFICATION-{task}.md with VERIFIED or FAILED status.`,
  description: "Verify {feature}"
})
```

### Step 8: Update STATUS.md

After phase completion:

```markdown
# Status: {Feature}

## Current State
- **Phase:** {next-phase}
- **Last Updated:** {timestamp}
- **Session:** {session-id}

## Gate Files
- [x] .claude/research/{feature}.md
- [x] TASKS.md
- [x] PLANS.md
- [ ] All implementation tasks
- [ ] All tests passing
- [ ] Verification complete

## Progress
- Tasks: {completed}/{total}
- Current: {current-task-or-phase}
- Blockers: {any-blockers-or-none}

## Recent Activity
- {timestamp}: {what-was-done}
```

### Step 9: Report Status

Provide a clear status update:

```
## {Feature} Implementation Status

**Current Phase:** {phase}
**Progress:** {completed}/{total} tasks

### Completed This Session
- [x] {task-1}
- [x] {task-2}

### Next Steps
- [ ] {next-task}

### Gate Status
| Gate | Status |
|------|--------|
| Research | {PASS/PENDING} |
| Planning | {PASS/PENDING} |
| Analysis | {PASS/PENDING} |
| Implementation | {X/Y tasks} |
| Testing | {PASS/PENDING} |
| Verification | {PASS/PENDING} |

{If complete: "Feature ready for final review!"}
{If blocked: "Blocked: {blocker-description}"}
{If in progress: "Continuing to next task..."}
```

---

## Gate Enforcement

This command ENFORCES gates. You cannot skip phases:

| Current Phase | Required Gate Files |
|---------------|---------------------|
| PLAN | `.claude/research/{feature}.md` exists |
| ANALYZE | `TASKS.md` + `PLANS.md` exist |
| IMPLEMENT | TASKS.md has analysis markers |
| TEST | `.claude/worker-done-{feature}-*.md` exists |
| VERIFY | `.claude/tests-passing-{feature}-*.md` exists |
| COMPLETE | `VERIFICATION-*.md` with VERIFIED status |

If gate file missing, you MUST complete the previous phase first.

---

## Parallel Session Behavior

When multiple sessions run `/implement-feature {same-feature}`:

1. Each session reads STATUS.md for current state
2. Each session checks `.claude/locks/{feature}/` for claimed tasks
3. Sessions claim different unlocked tasks
4. Lock files prevent duplicate work
5. STATUS.md tracks overall progress

**Stale lock cleanup:** If lock file is older than 2 hours:
- Assume session died
- Remove stale lock
- Claim the task
- Note in STATUS.md

---

## Quick Reference

### New Feature (Full Flow)
```bash
/feature-crawl submittals https://us02.procore.com/.../submittals
/implement-feature submittals
# Auto-executes: RESEARCH -> PLAN -> ANALYZE -> IMPLEMENT -> TEST -> VERIFY
```

### Resume Feature
```bash
/implement-feature direct-costs
# Reads STATUS.md, continues from current phase
```

### Force Phase
```bash
/implement-feature commitments --phase implement
# Skips auto-detect, runs IMPLEMENT phase
```

### Parallel Sessions
```bash
# Terminal 1
/implement-feature direct-costs

# Terminal 2
/implement-feature direct-costs

# Both work on different tasks, no conflicts
```

---

## Success Criteria

The command succeeds when:
- Feature directory and crawl data exist
- Current phase is determined (auto or override)
- Appropriate sub-agents are spawned
- STATUS.md is updated
- Progress is reported

The feature is COMPLETE when:
- All tasks in TASKS.md are [x] checked
- All VERIFICATION-*.md files show VERIFIED
- STATUS.md shows Phase: COMPLETE
