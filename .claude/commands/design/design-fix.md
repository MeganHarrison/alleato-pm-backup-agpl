# Design System Fix

Fix design system violations with verification loop.

## Usage
```
/design-fix [options]
```

**Options:**
- `all` - Fix all pending violations
- `file:path/to/file.tsx` - Fix violations in specific file
- `category:color` - Fix all violations of a specific category
- `severity:critical` - Fix all violations of a specific severity
- `id:UI-001` - Fix a specific violation by ID

## Instructions

You are fixing design system violations. Follow this process:

### Step 1: Load Violations
Read the violations from `.claude/design-audit/violations.json`

Filter based on argument: $ARGUMENTS
- If empty, show summary and ask what to fix
- If specific filter, apply it

### Step 2: Fix Loop (for each violation)

```
FOR each violation in scope:
  1. Read the file containing the violation
  2. Apply the suggested fix
  3. Mark violation as "in_progress"
  4. Increment fixAttempts

  VERIFY:
  - Run `npm run typecheck --prefix frontend` to check for type errors
  - Run `npm run lint --prefix frontend` to check for lint errors
  - If both pass, mark as "fixed"
  - If either fails:
    - If fixAttempts < 3, analyze error and retry with adjusted fix
    - If fixAttempts >= 3, mark as "needs_review" and continue

  UPDATE violations.json with new status
```

### Step 3: Verification Pass

After all fixes are applied:
1. Run full quality check: `npm run quality --prefix frontend`
2. For each "fixed" violation, verify the fix is still in place
3. Mark verified violations as "verified"
4. Report any regressions

### Step 4: Summary Report

Output:
- Violations fixed successfully
- Violations needing manual review
- Any new issues introduced
- Suggestions for prevention

### Important Rules

1. **Never skip verification** - Every fix must be verified
2. **Maximum 3 attempts** - Don't infinite loop on a single violation
3. **Preserve functionality** - Fixes should only change styling, not behavior
4. **Update the JSON** - Keep violations.json in sync with actual state
5. **Report honestly** - If something can't be fixed automatically, say so
