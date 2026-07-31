# Feature Implementation Workflow

This is the shared workflow template for implementing Procore features. Variables are substituted by the `/implement-feature` command.

## Variables
- `{feature}` - Feature name (e.g., "direct-costs")
- `{feature_dir}` - Path: `docs/project-mgmt/{feature}`
- `{crawl_dir}` - Path: `{feature_dir}/crawl-{feature}`

---

## CRITICAL: FILE LOCATION RULES

**ALL documentation MUST go in the feature folder, NOT in `.claude/`.**

| File Type | Correct Location | WRONG Location |
|-----------|------------------|----------------|
| Verification reports | `{feature_dir}/VERIFICATION-*.md` | `.claude/VERIFICATION-*.md` |
| Completion reports | `{feature_dir}/COMPLETION-REPORT.md` | `.claude/COMPLETION-*.md` |
| Session summaries | `{feature_dir}/SESSION-*.md` | `.claude/SESSION-*.md` |
| Test results | `{feature_dir}/TEST-RESULTS.md` | `.claude/TEST-*.md` |
| Status updates | `{feature_dir}/STATUS.md` | `.claude/*-STATUS.md` |


**Project management files go in `documentation/*project-mgmt/`:**

**Workflow signal files:**
- Research: `docs/project-mgmt/{feature}/research/research-{feature}.md`
- Worker signals: `docs/project-mgmt/{feature}/worker-done-*.md`
- Test signals: `docs/project-mgmt/{feature}/tests-passing-*.md`
- Session log: `docs/project-mgmt/shared/logs/task-log.md`

---

## CORE PRINCIPLE: EXECUTION-VERIFIED ENGINEERING

Claude is an **execution-verified engineer**, not a speculative assistant.

| Principle | Meaning |
|-----------|---------|
| No evidence = no reasoning | Don't speculate. Get data first. |
| No verification = no completion | Tasks require proof, not claims. |
| No tests = no "complete" | Features without tests are not done. |
| No fresh context = no trust | Complex tasks need sub-agents with clean context. |

---

## PATTERN INJECTION (MANDATORY)

Before starting ANY phase, check the pattern library for relevant patterns:

**Location:** `.agents/patterns/`

**Process:**
1. Read `.agents/patterns/index.json`
2. Match task keywords against pattern triggers
3. Read and apply relevant patterns BEFORE writing code

**Critical Patterns to Always Check:**

| If Working On... | Read These Patterns |
|-----------------|---------------------|
| Playwright tests | `errors/networkidle-timeout.md`, `errors/auth-fixture-missing.md` |
| API routes | `errors/route-param-mismatch.md`, `errors/fk-constraint-user.md` |
| Database code | `errors/supabase-types-stale.md` |
| Claiming completion | `errors/premature-completion.md` |

**Auto-Injection for Agents:**

When spawning sub-agents, include relevant patterns in the prompt:

```typescript
Task({
  subagent_type: "test-automator",
  prompt: `
## MANDATORY PATTERNS (from past mistakes)

### Pattern: NetworkIdle Timeout (CRITICAL)
Use domcontentloaded instead of networkidle:
- await page.waitForLoadState('domcontentloaded'); // CORRECT
- await page.waitForLoadState('networkidle'); // WRONG - causes timeouts

### Pattern: Auth Fixture (CRITICAL)
Import from fixtures for authenticated requests:
- import { test, expect } from '../fixtures'; // CORRECT
- import { test, expect } from '@playwright/test'; // WRONG - no auth

## YOUR TASK
[Original task prompt here]
`,
  description: "Test {feature}"
})
```

---

## MANDATORY 8-PHASE WORKFLOW

Every feature implementation MUST follow this phased workflow. Skipping phases is a violation.

```
PATTERNS --> RESEARCH --> PLAN --> ANALYZE --> IMPLEMENT --> TEST --> VERIFY --> COMPLETE
```

**Phase 0: PATTERNS** - Read relevant patterns from `.agents/patterns/` before starting

---

## Phase 1: RESEARCH

**Trigger:** Starting any new feature or significant task

**Action:** Spawn an Explore agent to understand the codebase and gather context.

```typescript
Task({
  subagent_type: "Explore",
  prompt: `Research {feature} feature:
    1. Find existing {feature}-related code in frontend/src/
    2. Identify patterns used (DataTablePage, hooks, config files)
    3. List files that will need modification
    4. Note any existing tests in frontend/tests/e2e/{feature}*.spec.ts
    5. Review Procore reference in {crawl_dir}/

    Write findings to: .claude/research/{feature}.md`,
  description: "Research {feature} codebase"
})
```

**Gate File:** `.claude/research/{feature}.md` must exist before proceeding.

---

## Phase 2: PLAN

**Trigger:** Research phase complete (gate file exists)

**Action:** Create planning documents in the feature folder.

**Required Files:**
1. `TASKS.md` - Checklist of all deliverables and tasks
2. `PLANS.md` - Detailed implementation plan with context

**TASKS.md Structure:**
```markdown
# TASKS: {Feature}

## Project Info
- Feature: {feature}
- Started: [timestamp]
- Status: Planning

## Deliverables
- [ ] Database schema verified
- [ ] API endpoints
- [ ] List page
- [ ] Detail page
- [ ] Create/edit forms
- [ ] Tests
- [ ] Documentation

## Phase Tasks
### Phase 1: Database & Schema
- [ ] Verify tables exist
- [ ] Generate fresh types
- [ ] Create RLS policies if needed

### Phase 2: API Endpoints
- [ ] GET /api/projects/[id]/{feature}
- [ ] POST /api/projects/[id]/{feature}
- [ ] PUT /api/projects/[id]/{feature}/[id]
- [ ] DELETE /api/projects/[id]/{feature}/[id]

### Phase 3: Frontend - List View
- [ ] Main list page
- [ ] Table component
- [ ] Filters/search
- [ ] Pagination

### Phase 4: Frontend - Forms
- [ ] Create form
- [ ] Edit form
- [ ] Validation

### Phase 5: Testing
- [ ] E2E tests
- [ ] Run tests
- [ ] Fix failures

### Phase 6: Verification
- [ ] Quality check passes
- [ ] All tests pass
- [ ] Matches Procore reference
```

**Gate:** Cannot proceed without TASKS.md and PLANS.md created.

---

## Phase 3: ANALYZE (Codebase Analysis)

**Trigger:** Planning documents created

**Action:** Analyze existing code to mark already-complete items.

```typescript
Task({
  subagent_type: "Explore",
  prompt: `Analyze codebase against TASKS.md:
    1. Read {feature_dir}/TASKS.md
    2. For each item, check if it already exists in codebase
    3. Update TASKS.md marking [x] for complete items
    4. Note any partial implementations

    Key locations to check:
    - frontend/src/app/[projectId]/{feature}/ (pages)
    - frontend/src/components/{feature}/ (components)
    - frontend/src/hooks/use-{feature}.ts (hooks)
    - frontend/src/config/tables/{feature}.config.tsx (table config)
    - frontend/src/lib/schemas/ (form schemas)
    - frontend/tests/e2e/{feature}*.spec.ts (tests)`,
  description: "Analyze {feature} codebase state"
})
```

**Output:** TASKS.md updated with current state markers.

---

## Phase 4: IMPLEMENT

**Trigger:** TASKS.md reflects current state

**Action:** For each unchecked task, spawn a worker agent.

```typescript
Task({
  subagent_type: "frontend-developer", // or backend-architect, supabase-architect
  prompt: `WORKER AGENT MODE

Task: [specific task from TASKS.md]
Context: Read {feature_dir}/PLANS.md
Reference: Compare with {crawl_dir}/pages/[relevant-page]/screenshot.png

PROJECT PATTERNS:
- Use DataTablePage template for list pages
- Use ShadCN UI components from @/components/ui/
- Follow existing hook patterns
- Use Zod schemas for form validation
- API routes go in frontend/src/app/api/

YOUR JOB:
1. Implement ONLY what is specified
2. Do NOT run tests (test-automator handles this)
3. Do NOT claim completion
4. Follow existing patterns in the codebase

When done, create .claude/worker-done-{feature}-[task-id].md with:
- Files modified: [list]
- Changes made: [summary]
- Ready for testing: YES
- Notes for tester: [any context]

BEGIN IMPLEMENTATION.`,
  description: "Implement {feature} [task]"
})
```

**Rules:**
- One task per worker agent
- Workers do NOT run tests
- Workers signal completion via file

---

## Phase 5: TEST (MANDATORY - NO EXCEPTIONS)

**Trigger:** Worker signals completion

**Action:** Spawn test-automator to write and run tests.

```typescript
Task({
  subagent_type: "test-automator",
  prompt: `TEST AGENT MODE

Feature: {feature}
Requirements: Read {feature_dir}/TASKS.md
Worker Output: Save playwright generated html report to the project folder.
Reference Screenshots: {crawl_dir}/pages/

CRITICAL: Follow .agents/agents/playwright-tester.md for Alleato-Procore patterns

AUTH SETUP:
- Test credentials: test1@mail.com / test12026!!!
- Auth file: frontend/tests/.auth/user.json
- Read frontend/tests/auth.setup.ts for Supabase auth patterns

YOUR JOB:
1. Write tests for the implemented feature
2. Run: npx playwright test frontend/tests/e2e/{feature}*.spec.ts
3. If tests FAIL -> FIX the code or tests (do NOT report failure)
4. Re-run until tests PASS
5. Compare implementation screenshots with Procore reference
6. Only return when ALL tests pass OR you hit a genuine blocker

Test location: /documentation/*project-mgmt/active/{feature}/tests/e2e/{feature}-[feature].spec.ts

PLAYWRIGHT PATTERNS (MANDATORY):
- Always waitForLoadState('networkidle') after navigation
- Use role-based selectors: page.locator('[role="tab"]')
- Include auth cookies in API requests
- No arbitrary timeouts - use waitForSelector

BANNED:
- Reporting failures without attempting fixes
- Asking "should I fix this?" - just fix it
- Giving up after one attempt
- Using page.waitForTimeout()

Create /documentation/*project-mgmt/active/{feature}/tests/tests-passing-{feature}-[task-id].md when done with:
- Tests written: [list]
- All passing: YES/NO
- Test output: [paste actual output]
- Screenshot comparison: [notes on Procore parity]`,
  description: "Test {feature}"
})
```

**Gate:** Cannot proceed without playwright html report showing all tests pass.

---

## Phase 6: VERIFY (MANDATORY - NO EXCEPTIONS)

**Trigger:** Tests passing

**Action 1:** Run gate enforcement tool to generate checksums:

```bash
npx tsx .agents/tools/enforce-gates.ts {feature}
```

This generates `{feature_dir}/GATES.md` with:
- Checksum proof that gates were run
- Timestamps
- Evidence from command output

**Action 2:** Spawn independent verifier agent.

```typescript
Task({
  subagent_type: "debugger",
  prompt: `SKEPTICAL VERIFIER MODE

CRITICAL: You are an INDEPENDENT VERIFIER.
Do NOT trust worker claims. Do NOT trust test claims. Verify EVERYTHING yourself.

ASSUME THE WORKER LIED ABOUT:
- "Tests pass" -> Run them yourself
- "Feature works" -> Test it yourself
- "No errors" -> Run quality checks yourself
- "Implementation complete" -> Check each requirement yourself

Your job: PROVE these assumptions wrong or confirm them.

Requirements: Read {feature_dir}/TASKS.md
Worker claims: Read /documentation/*project-mgmt/active/{feature}/tests/tests-passing-{feature}-[task-id].md
Test claims: Read .claude/tests-passing-{feature}-[task-id].md
Procore Reference: {crawl_dir}/

VERIFICATION CHECKLIST:
1. [ ] Run: npm run quality --prefix frontend - PASS?
2. [ ] Run: npx playwright test frontend/tests/e2e/{feature}*.spec.ts - ALL PASS?
3. [ ] Each requirement in TASKS.md met? (check individually)
4. [ ] No TypeScript errors?
5. [ ] No console errors in browser?
6. [ ] Mobile responsive? (test at 375px width)
7. [ ] Matches Procore reference screenshots?

OUTPUT FORMAT - Create {feature_dir}/VERIFICATION-[task].md:

# Verification Report: [Task]

## Quality Check
[ACTUAL OUTPUT from npm run quality]
Status: PASS / FAIL

## Test Results
[ACTUAL OUTPUT from test run]
Status: PASS / FAIL

## Requirements Verification
- Requirement 1: MET / NOT MET [evidence]
- Requirement 2: MET / NOT MET [evidence]
[...]

## Final Status
VERIFIED / FAILED

## Issues Found
[List or "None"]

BE RUTHLESS. If ANY check fails, mark as FAILED.`,
  description: "Verify {feature}"
})
```

**Gate:** Cannot mark task complete without VERIFIED status.

---

## Phase 7: COMPLETE

**Trigger:** Verifier returns VERIFIED AND GATES.md shows all PASSED

**Requirements before claiming completion:**
1. `{feature_dir}/GATES.md` exists with all gates PASSED
2. `{feature_dir}/VERIFICATION-[task].md` shows VERIFIED status
3. All checksums are present and timestamps are recent (< 1 hour)

**Action:** Update TASKS.md, STATUS.md, log completion.

1. Mark item as `[x]` in TASKS.md
2. Update STATUS.md with new progress
3. Log to `task-log.md` WITH gate checksums:
   ```markdown
   ## [{feature}] [Task Name]
   - Completed: [timestamp]
   - Verification: VERIFIED
   - Evidence: {feature_dir}/VERIFICATION-[task].md
   - Gates:
     - TypeScript: PASSED (checksum: xxxx)
     - ESLint: PASSED (checksum: xxxx)
     - Tests: PASSED (checksum: xxxx)
   ```

**BANNED:** Claiming completion without gate checksums

---

## WORKFLOW ENFORCEMENT

### File-Based Gates

The workflow only progresses when signal files exist:

| Gate | Required File | Meaning |
|------|---------------|---------|
| Patterns read | Read `.agents/patterns/index.json` | Can proceed to research |
| Research done | `research-{feature}.md` | Can proceed to planning |
| Planning done | `{feature_dir}/TASKS.md` + `PLANS.md` | Can proceed to implementation |
| Worker done | `{feature_dir}/worker-done-{feature}-[id].md` | Can proceed to testing |
| Tests passing | `{feature_dir}/tests-passing-{feature}-[id].md` | Can proceed to verification |
| Gates enforced | `{feature_dir}/GATES.md` with all PASSED | Can proceed to verification |
| Verified | `{feature_dir}/VERIFICATION-[task].md` with VERIFIED | Can mark complete |

### Anti-Gaming Measures

These are NOT acceptable as evidence:

| BANNED | REQUIRED |
|--------|----------|
| "Tests should pass" | Actual test output |
| "I verified the code" | Specific evidence (file:line) |
| "Implementation is complete" | Verification report with VERIFIED |
| "Everything looks good" | Checklist with evidence for each item |

---

## MANDATORY VERIFICATION FAILURE RESPONSE

When verification finds ANY failures:

1. **Immediately fix all issues** - Do not report findings, fix them
2. **Re-run verification** - Spawn verifier again after fixes
3. **Repeat until clean** - Continue fix -> verify loop until PASS
4. **Only then complete** - Completion requires VERIFIED status

**BANNED:**
- "Verification found 3 issues" -> STOP and report
- "Known issue - low priority" -> Leave unfixed
- "85% passing is acceptable" -> Partial pass = FAIL

**REQUIRED:**
- "Verification found 3 issues" -> Fix all 3 -> Re-verify -> PASS
- Continue until VERIFIED or genuinely blocked

---

## SUB-AGENT REFERENCE

### When to Spawn Sub-Agents

| Condition | Action |
|-----------|--------|
| Starting new feature | Spawn Explore agent (research) |
| Planning complete, ready to implement | Spawn worker agent |
| Implementation complete | Spawn test-automator (MANDATORY) |
| Tests passing | Spawn verifier (MANDATORY) |
| Context getting long | Spawn fresh agent with checkpoint files |
| Different expertise needed | Spawn specialized agent |

### Sub-Agent Types

| Type | Use For |
|------|---------|
| `Explore` | Codebase research, finding files, understanding patterns |
| `Plan` | Architecture design, implementation planning |
| `frontend-developer` | React, UI components, styling |
| `backend-architect` | API design, database, server logic |
| `supabase-architect` | Database schema, RLS, migrations |
| `test-automator` | ALL testing (unit, e2e, integration) |
| `debugger` | Verification, debugging, error investigation |
| `code-reviewer` | Code review, quality checks |

### NEVER Do These Directly

| Action | Why | Do Instead |
|--------|-----|------------|
| Run Playwright tests | Context pollution | Spawn test-automator |
| Debug test failures | Time sink | Spawn test-automator to fix |
| Claim "complete" | No evidence | Spawn verifier first |
| Ask "should I continue?" | Wastes time | Just continue |

---

## CODE QUALITY GATES

### Mandatory After Every Code Change

```bash
# Run from project root
npm run quality --prefix frontend

# Or run individually
npm run lint --prefix frontend
npm run typecheck --prefix frontend

# Auto-fix when possible
npm run quality:fix --prefix frontend
```

### Zero Tolerance

| BANNED | REQUIRED |
|--------|----------|
| `@ts-ignore` | Fix the type error |
| `@ts-expect-error` | Fix the type error |
| `any` type | Use proper type or `unknown` |
| `console.log` | Remove or use proper logging |
| Skipping tests | Write tests |

---

## TASK COMPLETION DEFINITION

A task is **COMPLETE** only when ALL apply:

- [ ] Code changes implemented
- [ ] Quality checks pass (zero errors)
- [ ] Tests written
- [ ] Tests executed and PASSING (with output evidence)
- [ ] Verification report shows VERIFIED
- [ ] TASKS.md updated with checkmark
- [ ] STATUS.md updated with progress
- [ ] Logged to `.claude/task-log.md`

**Claiming completion without this evidence = violation.**

---

## WHEN TO STOP AND ASK

Claude MUST STOP and ask the user only if:

- Required access/credentials are missing
- Fundamental architectural decision needed
- Requirements are ambiguous (multiple valid interpretations)
- Genuinely blocked after 3 fix attempts

Claude MUST NOT stop to:

- Report progress (do alongside work)
- Ask permission to continue (just continue)
- Report findings (fix them instead)
- Ask "should I fix this?" (yes, fix it)

---

## PARALLEL SESSION COORDINATION

When multiple sessions work on the same feature:

### Task Locking
Before starting a task, check/create lock file:
```
.claude/locks/{feature}/{task-id}.lock
```

Lock file contents:
```markdown
# Lock: {task-id}
Session: [session-id]
Started: [timestamp]
Task: [task description]
```

### Picking Up Tasks
1. Read STATUS.md for current progress
2. Read TASKS.md for uncompleted tasks
3. Check `.claude/locks/{feature}/` for locked tasks
4. Pick first unlocked task
5. Create lock file
6. Work on task
7. Update STATUS.md when done
8. Remove lock file

### Conflict Resolution
If lock file older than 2 hours, assume session died:
- Remove stale lock
- Claim task
- Note in STATUS.md

---

## FILE ORGANIZATION

```
alleato-procore/
│
├── documentation/*project-mgmt/active/{feature}/
│   ├── CONTEXT.md                  # Feature-specific context (minimal)
│   ├── STATUS.md                   # Current progress (auto-maintained)
│   ├── TASKS.md                    # Task checklist
│   ├── PLANS.md                    # Implementation plan
│   ├── SCHEMA.md                   # Supabase tables and sql
│   ├── API-ENDPOINTS.md            # API documentation
│   ├── FORMS.md                    # Table of all form fields
│   ├── VERIFICATION-*.md           # Verification reports
│   └── crawl-{feature}/            # Procore reference data
│       └── pages/
│           └── [page-name]/
│               ├── screenshot.png
│               ├── dom.html
│               └── metadata.json
│       └── reports/
│               ├── detailed-report.json
│               └── link-graph.json

```

---

## REMEMBER

1. **Explicit > Automatic** - Follow the workflow exactly
2. **Files are gates** - No file = no progress
3. **Test-automator for ALL tests** - Never run tests directly
4. **Verifier assumes lies** - Independent confirmation required
5. **Fix don't report** - When something fails, fix it
6. **Continue don't ask** - Keep working until done or blocked
7. **Coordinate via locks** - Check locks before claiming tasks
