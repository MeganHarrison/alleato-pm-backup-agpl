---
description: Comprehensive form testing with browser verification and error documentation
argument-hint: [scope] (all | page | modal | inline | auth | form-name)
---

# Form Testing Command

Systematically test forms with Playwright browser verification, automatic database cleanup, and comprehensive error documentation.

## Usage

```bash
/test-forms all              # Test all 28 forms
/test-forms page             # Test 7 page forms only
/test-forms modal            # Test 15+ modal forms only
/test-forms inline           # Test 2 inline forms only
/test-forms auth             # Test 4 auth forms only
/test-forms create-project   # Test specific form by name
```

## Arguments

- `$ARGUMENTS` - Test scope or specific form name
  - `all` - Test all forms (default)
  - `page` - Standalone page forms
  - `modal` - Dialog/modal forms
  - `inline` - Inline forms
  - `auth` - Authentication forms
  - `[form-name]` - Specific form (e.g., "create-project", "contact-dialog")

## The 6-Phase Workflow

### Phase 1: Scope & Planning

**Actions:**
1. Parse scope argument from `$ARGUMENTS`
2. Load form inventory from `documentation/forms/FORM_INVENTORY.md`
3. Filter forms based on scope
4. Create timestamped test run directory
5. Generate test plan at `documentation/forms/test-runs/[timestamp]/TEST_PLAN.md`

**Output:**
- Test plan document with:
  - Forms to be tested (count and list)
  - Estimated duration
  - Test configuration summary
  - Progress tracking table

### Phase 2: Infrastructure Verification

**Actions:**
1. Verify Playwright is installed and configured
2. Check auth setup (`.auth/user.json` exists)
3. Ensure test helper utilities exist:
   - `frontend/tests/helpers/form-testing.ts`
   - `frontend/tests/helpers/modal-testing.ts`
   - `frontend/tests/helpers/test-data-cleanup.ts`
4. Create screenshot directory: `frontend/tests/screenshots/`
5. Verify Supabase connection and service role key
6. Generate test configurations for each form

**Requirements:**
- Playwright installed
- Auth state file exists
- Environment variables set:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`

**If verification fails:**
- Stop workflow
- Document missing requirements
- Provide setup instructions

### Phase 3: Browser-Based Testing (MANDATORY PLAYWRIGHT GATE)

**For each form in scope:**

1. **Launch Browser**
   - Start Playwright with auth state
   - Navigate to form route (or page with modal trigger)
   - Wait for networkidle

2. **Load Test**
   - Verify form visible
   - Capture initial state screenshot
   - Check for console errors
   - Record load time

3. **Validation Test**
   - Test required field validation (empty submission)
   - Test invalid format validation (email, phone, etc.)
   - Test boundary conditions (min/max length/value)
   - Verify error messages display
   - Capture validation errors screenshot

4. **Fill Test**
   - Fill all required fields with valid test data
   - Fill optional fields (if configured)
   - Handle special field types (combobox, date, file upload)
   - Capture filled form screenshot

5. **Submission Test**
   - Submit form
   - Wait for response (success or error)
   - Verify success indicator or navigation
   - Extract created record ID (for cleanup)
   - Capture submission result screenshot

6. **Error Handling Test**
   - Test form with intentionally invalid data
   - Verify helpful error messages
   - Ensure form doesn't clear on error
   - Capture error handling screenshot

7. **Accessibility Test**
   - Tab through all fields (keyboard navigation)
   - Verify focus indicators visible
   - Check ARIA labels present
   - Verify color contrast
   - Document accessibility issues

8. **Modal-Specific Tests** (if applicable)
   - Test close via X button
   - Test close via Cancel button
   - Test close via ESC key
   - Test close via overlay click
   - Verify form state clears on close

9. **Track Created Data**
   - Register created record ID and type
   - Add to cleanup registry

10. **Update Progress**
    - Mark form as tested in test plan
    - Update status (pass/fail)
    - Note any blockers

### Phase 4: Error Documentation

**For each error found:**

Document in `documentation/forms/test-runs/[timestamp]/FORM_ERRORS.md`:

```markdown
### [Form Name] - [Error Type]
- **Severity**: BLOCKER | MAJOR | MINOR
- **Form**: [form name]
- **Field**: [field name] (if applicable)
- **Error**: [clear description of issue]
- **Expected**: [what should happen]
- **Actual**: [what actually happens]
- **Reproduction Steps**:
  1. [step 1]
  2. [step 2]
  3. [step 3]
- **Screenshot**: [path to screenshot]
- **Timestamp**: [ISO 8601 timestamp]
- **Tester**: Form Testing Agent (Playwright)
```

**Severity Classification:**

- **BLOCKER**: Form cannot be submitted, crashes, or loses data
  - Continue testing other forms
  - Aggregate at end

- **MAJOR**: Validation unclear, poor UX, accessibility issues
  - Document and continue

- **MINOR**: Typos, styling inconsistencies, minor improvements
  - Document and continue

### Phase 5: Comprehensive Reporting

**Generate:** `documentation/forms/test-runs/[timestamp]/FORM_TEST_REPORT.md`

**Report Contents:**

```markdown
# Form Testing Report

**Date:** [timestamp]
**Scope:** [scope argument]
**Duration:** [total time]
**Tester:** Form Testing Agent (Playwright)

## Summary Statistics

- **Total Forms Tested:** X
- **Passed:** X
- **Failed:** X
- **Blocked:** X
- **Skipped:** X

## Error Summary

- **Blockers:** X
- **Major Issues:** X
- **Minor Issues:** X

## Forms Tested

| Form Name | Type | Status | Duration | Errors | Screenshot |
|-----------|------|--------|----------|--------|------------|
| Create Project | Page | ✅ Pass | 45s | 0 | [link] |
| Contact Dialog | Modal | ❌ Fail | 32s | 2 | [link] |
| ... | ... | ... | ... | ... | ... |

## Detailed Results

[For each form: status, errors found, screenshots, notes]

## Screenshots Captured

[List of all screenshots with descriptions]

## Database Cleanup

- **Records Created:** X
- **Records Cleaned:** X
- **Cleanup Status:** ✅ Success / ❌ Failed

## Recommendations

[Based on errors found, suggest improvements]

## Next Steps

[If errors found, suggest retest or fixes needed]
```

### Phase 6: Update Inventory

**Actions:**

1. Open `documentation/forms/FORM_INVENTORY.md`
2. For each tested form:
   - Update "Last Tested" timestamp
   - Update "Status" (Pass/Fail/Blocked)
   - Add link to test report
   - Add link to error log (if errors found)
3. Save inventory
4. Commit changes (if requested)

**Example Update:**

```markdown
### 1. Create Project Form
- **Last Tested:** 2026-01-08 14:30:00
- **Status:** ✅ Pass
- **Test Report:** [2026-01-08_14-30 Report](test-runs/2026-01-08_14-30/FORM_TEST_REPORT.md)
```

## Execution Gates (NON-NEGOTIABLE)

These gates from `CLAUDE.md` are **MANDATORY** and cannot be bypassed:

### Playwright Gate

**Rules:**
- NEVER reason about form behavior without browser verification
- NEVER assume UI state without actual testing
- NEVER skip screenshot capture
- ALWAYS capture evidence for every claim

**Violations:**
- Speculating about form behavior → FAILURE
- Reporting status without screenshots → FAILURE
- Assuming validation works → FAILURE

**Compliance:**
- Launch Playwright for every form
- Capture screenshots for all 8 states
- Verify behavior in actual browser
- Include screenshot paths in reports

### Quality Gate

**Rules:**
- Run `npm run quality --prefix frontend` after ANY code changes
- Fix ALL type errors before continuing
- Fix ALL lint errors before continuing
- NEVER commit code with errors
- NEVER use `@ts-ignore` or `@ts-expect-error`
- NEVER use `any` type (use `unknown` instead)

**Applies to:**
- Test helper utilities
- Test configurations
- Cleanup scripts
- Any TypeScript file

### Database Gate

**Rules:**
- Use real test data (not mocks)
- Clean up ALL created data after tests
- Verify cleanup was successful
- NEVER leave orphaned test records
- Use `E2E_TEST_` prefix for identification

**Compliance:**
- Track every created record ID
- Call `cleanupTestData()` in `test.afterAll()`
- Run orphaned data cleanup after suite
- Verify no test data remains in database

## Output Structure

```
documentation/forms/
├── FORM_INVENTORY.md                      # Master registry (updated)
└── test-runs/
    └── 2026-01-08_14-30/                 # Timestamped run
        ├── TEST_PLAN.md                   # Execution plan
        ├── FORM_ERRORS.md                 # Errors found (if any)
        ├── FORM_TEST_REPORT.md            # Comprehensive report
        └── screenshots/                   # Evidence
            ├── create-project-load.png
            ├── create-project-initial.png
            ├── create-project-validation-errors.png
            ├── create-project-filled.png
            ├── create-project-submitted.png
            ├── create-project-error-handling.png
            ├── create-project-accessibility.png
            └── ...
```

## Behavioral Rules

**Agent MUST:**
- Execute ALL 8 tests for each form
- Capture screenshots for every state
- Continue testing after finding blockers
- Document every error thoroughly
- Clean up all test data
- Update inventory after completion

**Agent MUST NOT:**
- Skip tests to save time
- Assume behavior without verification
- Fix errors (only document)
- Modify form code
- Stop on first blocker
- Leave test data in database

## Error Handling

**If infrastructure fails:**
1. Document what's missing
2. Provide setup instructions
3. Stop workflow gracefully

**If form test fails:**
1. Capture error screenshot
2. Document in FORM_ERRORS.md
3. Mark form as "Fail" in plan
4. Continue to next form

**If cleanup fails:**
1. Log error details
2. Mark cleanup status as failed
3. Include orphaned record IDs in report
4. Recommend manual cleanup

## Success Criteria

Test run is successful when:
- ✅ All forms in scope were tested
- ✅ Screenshots captured for all 8 states per form
- ✅ All errors documented with reproduction steps
- ✅ Test report generated
- ✅ Inventory updated
- ✅ All test data cleaned up
- ✅ No blockers prevent workflow completion

## Integration Points

**Invokes:**
- Form Testing Agent (executes tests)
- Form Inventory Agent (updates catalog)

**Uses:**
- `frontend/tests/helpers/form-testing.ts`
- `frontend/tests/helpers/modal-testing.ts`
- `frontend/tests/helpers/test-data-cleanup.ts`
- `frontend/tests/config/form-test-configs.ts`

**Outputs:**
- Test plan (TEST_PLAN.md)
- Error log (FORM_ERRORS.md, if errors found)
- Test report (FORM_TEST_REPORT.md)
- Screenshots (PNG files)
- Updated inventory (FORM_INVENTORY.md)

## Example Invocations

```bash
# Full test suite (all 28 forms)
/test-forms all

# Quick test (page forms only)
/test-forms page

# Specific form
/test-forms create-project

# After fixing errors, retest failed forms
/test-forms @failed
```

## Notes

- Estimated time: ~30-45 minutes for all forms
- Estimated time: ~15-20 minutes for page forms
- Estimated time: ~2-3 minutes per form
- Requires active Supabase connection
- Requires authentication setup
- Runs in headless mode by default
- Can run in CI/CD via GitHub Actions
