# Design System Verify

Verify that fixes were applied correctly and still hold.

## Usage
```
/design-verify [options]
```

**Options:**
- `all` - Verify all "fixed" violations
- `file:path/to/file.tsx` - Verify fixes in specific file
- `recent` - Verify fixes from last 24 hours

## Instructions

You are verifying design system fixes. Follow this process:

### Step 1: Load Fixed Violations
Read violations from `.claude/design-audit/violations.json`
Filter to status: "fixed" (not yet "verified")

Apply filter from argument: $ARGUMENTS

### Step 2: Verification Loop

For each fixed violation:

1. **Read the current file content**
2. **Check if the fix is still in place:**
   - The `currentCode` (old bad code) should NOT be present
   - The `suggestedFix` (new good code) SHOULD be present (or equivalent)
3. **Run quality checks:**
   - TypeScript: `npm run typecheck --prefix frontend`
   - ESLint: `npm run lint --prefix frontend`

4. **Determine result:**
   - If fix is present AND quality passes → "verified"
   - If fix is missing → "regressed" (needs re-fix)
   - If quality fails → "broken" (needs investigation)

5. **Update violations.json** with:
   ```json
   {
     "status": "verified|regressed|broken",
     "verificationResult": {
       "verified": true|false,
       "verifiedAt": "ISO timestamp",
       "notes": "any relevant notes"
     }
   }
   ```

### Step 3: Handle Regressions

For any "regressed" violations:
1. Log them for re-fixing
2. Ask if user wants to run `/design-fix` on them

### Step 4: Summary Report

```
Verification Results
====================
Verified: X violations
Regressed: X violations (list files)
Broken: X violations (list files)

Overall: X% of fixes verified successfully
```

### Verification Rules

1. **Don't trust status alone** - Always check the actual file
2. **Quality gates matter** - A fix isn't valid if it breaks the build
3. **Track regressions** - Someone may have undone a fix
4. **Timestamp everything** - Know when verifications happened
