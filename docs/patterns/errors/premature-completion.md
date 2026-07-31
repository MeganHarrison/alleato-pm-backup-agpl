---
title: premature completion
description: premature completion documentation
---

# Pattern: Premature Completion Claims

> Migrated on 2026-04-14.
> Canonical replacement: `docs/ops/patterns/evidence-based-completion.md`.

**Severity:** CRITICAL
**Triggers:** `complete`, `done`, `finished`, `verified`, `passing`, `working`, `ready`
**Category:** Workflow

---

## The Mistake

Claiming a task is complete without verification evidence:

```markdown
# WRONG - Claims without evidence
"Task complete. All tests passing."
"Implementation finished, ready for review."
"Feature is working, verified manually."
"Done with the changes, everything looks good."
```diff
**Historical incidents:**
- Agent claimed 14/14 tests passing → Actually 13/14
- Agent claimed zero TypeScript errors → Actually 15 errors
- Agent claimed "verified" → No verification was run
- Agent accepted 85% pass rate as "acceptable"

---

## The Fix

**NEVER claim completion without these artifacts:**

### 1. Quality Gate Evidence (REQUIRED)
```markdown
## Quality Gate
- Status: PASSED
- Timestamp: 2026-01-12T14:30:00Z
- Command: `npm run quality --prefix frontend`
- Output:
  ```text
  > npm run typecheck
  ✓ 0 errors
  > npm run lint
  ✓ 0 errors, 1924 warnings

  ```

```markdown
### 2. Test Evidence (REQUIRED)

```markdown
## Test Results
- Status: PASSED
- Timestamp: 2026-01-12T14:35:00Z
- Command: `npx playwright test tests/e2e/feature*.spec.ts`
- Results: 24/24 tests passing (100%)
- Report: frontend/playwright-report/index.html
```markdown
### 3. Verification Report (REQUIRED)
```markdown
## Verification
- Status: VERIFIED
- Report: documentation/*project-mgmt/active/feature/VERIFICATION-task.md
- Verifier: Spawned independent verification agent
- Timestamp: 2026-01-12T14:40:00Z
```

---

## Completion Checklist

Before saying "complete", verify ALL of these:

```markdown
- [ ] Code changes implemented
- [ ] `npm run quality --prefix frontend` passes (0 errors)
- [ ] Tests written for new functionality
- [ ] Tests executed: X/Y passing (100%)
- [ ] HTML test report generated
- [ ] Verification agent spawned
- [ ] Verification status: VERIFIED
- [ ] TASKS.md updated with checkmark
- [ ] STATUS.md updated
```yaml
**If ANY checkbox is unchecked → Task is NOT complete**

---

## Banned Phrases

These phrases are NOT acceptable as completion evidence:

| BANNED | REQUIRED |
|--------|----------|
| "Tests should pass" | "Tests executed: 24/24 passing" |
| "I verified the code" | "Verification report: path/to/VERIFICATION.md" |
| "Implementation complete" | "VERIFIED status + test evidence" |
| "Everything looks good" | Specific checklist with evidence |
| "Most tests passing" | "100% tests passing (X/Y)" |
| "Ready for review" | "Verification PASSED + evidence links" |

---

## Verification Agent Protocol

After completing work, ALWAYS spawn a verification agent:

```typescript
Task({
  subagent_type: "debugger",
  prompt: `SKEPTICAL VERIFIER MODE

CRITICAL: You are an INDEPENDENT VERIFIER.
Do NOT trust worker claims. Verify EVERYTHING yourself.

ASSUME THE WORKER LIED ABOUT:
- "Tests pass" -> Run them yourself
- "Feature works" -> Test it yourself
- "No errors" -> Run quality checks yourself

VERIFICATION CHECKLIST:
1. [ ] Run: npm run quality --prefix frontend - PASS?
2. [ ] Run: npx playwright test [feature]*.spec.ts - ALL PASS?
3. [ ] Each requirement met? (check individually)
4. [ ] No TypeScript errors?

OUTPUT: Create VERIFICATION-[task].md with evidence`,
  description: "Verify [feature]"
})
```

---

## Detection

Signs this mistake is happening:

1. Completion claimed without test output
2. No verification report linked
3. Vague language like "should work" or "looks good"
4. Missing timestamps on claims
5. No checksum/evidence for gates

---

## References

- Process docs: `.agents/agents/PROJECT-MANAGEMENT-PROCESS.md`
- Workflow: `.agents/workflows/feature-implementation.md`
- Issue #1: Change Events claimed complete with 44% test failures
- Issue #2: Agent accepted 85% as "acceptable"
