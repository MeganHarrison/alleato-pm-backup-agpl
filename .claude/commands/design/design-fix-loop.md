# Design System Fix Loop (Autonomous)

Autonomous fix-and-verify loop that fixes violations without user intervention.

## Usage
```
/design-fix-loop [max-iterations]
```

**Arguments:**
- `max-iterations` - Maximum number of fix cycles (default: 5)

## Instructions

You are running an autonomous fix-and-verify loop. This command runs WITHOUT user intervention until all fixable violations are resolved.

### Configuration
- Max iterations: $ARGUMENTS (default: 5)
- Max attempts per violation: 3
- Stop on: All violations fixed OR max iterations reached OR critical error

### The Loop

```
ITERATION = 0
while ITERATION < MAX_ITERATIONS:
    ITERATION += 1
    print(f"=== Fix Loop Iteration {ITERATION} ===")

    # Step 1: Load pending violations
    violations = load_violations("pending", "in_progress", "regressed")
    if violations.empty:
        print("All violations fixed!")
        break

    # Step 2: Group by file for efficiency
    files = group_by_file(violations)

    # Step 3: Fix each file
    for file, file_violations in files:
        print(f"Fixing {len(file_violations)} violations in {file}")

        # Read file once
        content = read_file(file)

        # Apply all fixes for this file
        for violation in file_violations:
            if violation.fixAttempts >= 3:
                violation.status = "needs_review"
                continue

            # Apply fix
            content = apply_fix(content, violation)
            violation.fixAttempts += 1
            violation.status = "in_progress"

        # Write file once
        write_file(file, content)

    # Step 4: Run verification
    print("Running quality checks...")
    typecheck_result = run("npm run typecheck --prefix frontend")
    lint_result = run("npm run lint --prefix frontend")

    if typecheck_result.success and lint_result.success:
        # Mark all in_progress as fixed
        for v in violations.where(status="in_progress"):
            v.status = "fixed"
        print(f"Iteration {ITERATION}: {len(fixed)} violations fixed")
    else:
        # Analyze failures and identify which violations caused them
        failed_violations = analyze_failures(typecheck_result, lint_result, violations)
        for v in failed_violations:
            if v.fixAttempts >= 3:
                v.status = "needs_review"
            else:
                v.status = "pending"  # Will retry next iteration

        # Mark successful ones
        for v in violations.where(status="in_progress") - failed_violations:
            v.status = "fixed"

    # Save state after each iteration
    save_violations()

# End of loop
```

### Final Verification Pass

After the loop completes:
1. Run `/design-verify all` to confirm all fixes
2. Generate final report

### Final Report Format

```
========================================
DESIGN FIX LOOP COMPLETE
========================================

Iterations: X of Y max
Duration: X minutes

Results:
  - Fixed & Verified: X violations
  - Needs Manual Review: X violations
  - Still Pending: X violations

Quality Status:
  - TypeScript: PASS/FAIL
  - ESLint: PASS/FAIL

Files Modified: X
  - path/to/file1.tsx (Y fixes)
  - path/to/file2.tsx (Z fixes)
  ...

Violations Needing Manual Review:
  - ID: reason
  - ID: reason
  ...

Next Steps:
  1. [if any need review] Review violations marked "needs_review"
  2. [if all fixed] Run /design-verify to confirm
  3. [if quality fails] Run npm run quality:fix to auto-fix lint issues
========================================
```

### Safety Rules

1. **Never modify non-style code** - Only change className, style props
2. **Preserve all functionality** - If unsure, mark for review
3. **Respect the 3-attempt limit** - Don't infinite loop
4. **Save state after each iteration** - Allow resumption if interrupted
5. **Stop on critical errors** - Don't continue if something is seriously wrong
