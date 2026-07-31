# Form Testing Plugin

Comprehensive, automated form testing workflow for Alleato-Procore using Playwright browser verification.

## Overview

This plugin provides a complete testing system for all forms in the application (28+ forms including standalone pages, modals, inline forms, and auth forms). It uses a systematic 6-phase approach to ensure comprehensive coverage with automatic database cleanup.

## Quick Start

```bash
# Test all forms
/test-forms all

# Test specific type
/test-forms page
/test-forms modal
/test-forms inline
/test-forms auth

# Test single form
/test-forms create-project
```

## Features

- ✅ **28+ Forms Cataloged** - Complete inventory with metadata
- ✅ **Browser-Verified Testing** - Playwright-based E2E tests
- ✅ **Automatic Cleanup** - Database test data removed after runs
- ✅ **Evidence-Based** - Screenshots for all states
- ✅ **CI/CD Integrated** - Runs automatically on PR changes
- ✅ **Reusable** - Single command for any scope
- ✅ **Comprehensive** - Tests validation, submission, accessibility
- ✅ **Single Source of Truth** - No duplicate tests

## Plugin Structure

```
.claude/plugins/form-testing/
├── README.md                           # This file
├── commands/
│   └── test-forms.md                  # Main slash command
├── agents/
│   ├── form-testing-agent.md          # Testing execution agent
│   └── form-inventory-agent.md        # Inventory management agent
└── templates/
    ├── TEST_PLAN_TEMPLATE.md          # Test plan structure
    └── ERROR_REPORT_TEMPLATE.md       # Error documentation format
```

## The 6-Phase Workflow

### Phase 1: Scope & Planning
- Parse scope argument (`all`, `page`, `modal`, etc.)
- Load form inventory from `documentation/forms/FORM_INVENTORY.md`
- Filter forms based on scope
- Create test plan document

### Phase 2: Infrastructure Verification
- Verify Playwright configuration
- Check auth setup (`.auth/user.json`)
- Ensure test helper utilities exist
- Create screenshot directory
- Generate test configurations

### Phase 3: Browser-Based Testing
For each form:
1. Launch browser with Playwright
2. Navigate to form (or trigger modal)
3. Capture initial state screenshot
4. Test all field validations
5. Fill form with valid test data
6. Capture filled state screenshot
7. Submit form
8. Verify success/error response
9. Capture result screenshot
10. Test keyboard accessibility
11. Document any errors found
12. Update progress in test plan

### Phase 4: Error Documentation
For each error found:
- Capture detailed screenshot
- Record error message
- Document reproduction steps
- Classify severity (BLOCKER/MAJOR/MINOR)
- Log to error report

### Phase 5: Comprehensive Reporting
Generate report with:
- Summary statistics
- Forms tested vs skipped
- Errors found by severity
- Screenshots captured
- Test duration
- Pass/fail status per form

### Phase 6: Update Inventory
Update `FORM_INVENTORY.md` with:
- Last tested timestamp
- Current status
- Link to test report
- Link to error log

## Output Structure

```
documentation/forms/
├── FORM_INVENTORY.md              # Always updated master registry
└── test-runs/
    └── 2026-01-08_14-30/          # Timestamped test run
        ├── TEST_PLAN.md           # Test execution plan
        ├── FORM_ERRORS.md         # Errors found (if any)
        ├── FORM_TEST_REPORT.md    # Comprehensive report
        └── screenshots/           # Evidence screenshots
            ├── create-project-initial.png
            ├── create-project-filled.png
            ├── create-project-submitted.png
            └── ...
```

## Test Helper Utilities

### Core Form Testing (`frontend/tests/helpers/form-testing.ts`)
- `testFormLoad()` - Load test with timing
- `testFieldValidations()` - Validation rules testing
- `fillForm()` - Smart form filling for all field types
- `testFormSubmission()` - Submission with cleanup tracking
- `testFormAccessibility()` - Keyboard nav and ARIA testing
- `testFormComprehensively()` - All tests in sequence

### Modal Testing (`frontend/tests/helpers/modal-testing.ts`)
- `openModal()` - Trigger and wait for modal
- `testModalClose()` - All close methods (X, Cancel, ESC, overlay)
- `testModalResponsive()` - Mobile/tablet/desktop responsiveness
- `testModalStatePersistence()` - Verify state clears on close

### Database Cleanup (`frontend/tests/helpers/test-data-cleanup.ts`)
- `cleanupTestData()` - Remove records after tests
- `cleanupOrphanedTestData()` - Safety net for failed cleanups
- `generateTestDataPrefix()` - Unique identifiers for test data
- `verifyCleanup()` - Confirm successful deletion

## Form Inventory

All forms are documented in [`documentation/forms/FORM_INVENTORY.md`](../../../documentation/forms/FORM_INVENTORY.md):

- **7 Standalone Page Forms** - Create Project, Contracts, Invoice, etc.
- **15+ Modal Forms** - Client, Contact, Company, Budget, etc.
- **2 Inline Forms** - Team Member, Budget Line Item
- **4 Auth Forms** - Login, SignUp, Forgot Password, Update Password

Each entry includes:
- Route/trigger
- File location
- Priority level
- Key fields
- Validation approach
- Last tested timestamp
- Current status
- Links to test reports

## Execution Gates

Per `CLAUDE.md`, these gates are **NON-NEGOTIABLE**:

### Playwright Gate
- NEVER reason about form behavior without browser verification
- ALWAYS capture screenshots as evidence
- NEVER assume UI state without testing
- Evidence REQUIRED before marking complete

### Quality Gate
- Run `npm run quality` after any code changes
- Fix ALL type/lint errors before continuing
- Never commit code with errors

### Database Gate
- Use real test data with automatic cleanup
- Verify cleanup after every test run
- Never leave orphaned test data

## CI/CD Integration

The workflow is integrated with GitHub Actions:

**File:** `.github/workflows/form-testing.yml`

**Triggers:**
- Pull requests affecting form files
- Manual workflow dispatch
- Changes to form components or UI

**Actions:**
- Install dependencies and Playwright
- Run form tests with specified scope
- Upload test results and screenshots
- Comment PR with test summary
- Clean up test data

## Usage Examples

### Test All Forms
```bash
/test-forms all
```
Runs comprehensive tests on all 28 forms. Estimated time: 30-45 minutes.

### Test High Priority Forms Only
```bash
/test-forms high-priority
```
Tests only critical user flows (16 forms). Estimated time: 15-20 minutes.

### Test Specific Form Type
```bash
/test-forms page    # 7 standalone page forms
/test-forms modal   # 15+ modal forms
/test-forms inline  # 2 inline forms
/test-forms auth    # 4 auth forms
```

### Test Single Form
```bash
/test-forms create-project
/test-forms contact-dialog
/test-forms budget-line-item
```

### Retest Failed Forms
```bash
/test-forms @failed
```
Loads forms marked as "fail" from last test report.

## Adding New Forms

1. Add entry to `documentation/forms/FORM_INVENTORY.md`
2. Run `/test-forms [form-name]`
3. Plugin auto-generates config and runs tests
4. Inventory automatically updated with results

## Maintenance

### Update Test Helper Utilities
```bash
# Edit utilities
vim frontend/tests/helpers/form-testing.ts

# Verify changes
npm run quality --prefix frontend

# Re-run tests
/test-forms all
```

### Migrate Existing Tests
Follow the migration strategy in the plan:
1. Extract test data to `form-test-configs.ts`
2. Replace manual steps with helper utilities
3. Add database cleanup hooks
4. Archive old files to `frontend/tests/archive/`
5. Document in `frontend/tests/MIGRATION_LOG.md`

### Clean Up Orphaned Data
```bash
# Manual cleanup (older than 24 hours)
npx ts-node frontend/tests/helpers/test-data-cleanup.ts

# Or via test
npm run test:cleanup --prefix frontend
```

## Troubleshooting

### Tests Failing with Authentication Issues
**CRITICAL:** If tests show `[no-auth]` tag and fail to authenticate:

1. **Check Playwright Config** - Verify `comprehensive-form-testing.spec.ts` is NOT in the `no-auth` project testMatch regex
2. **Rule:** Form tests ALWAYS require auth - see [frontend/tests/PLAYWRIGHT_CONFIG_RULES.md](../../../frontend/tests/PLAYWRIGHT_CONFIG_RULES.md)
3. **Fix:** Remove test file from no-auth testMatch on line 46 of `playwright.config.ts`

### Other Test Failures
1. Check Playwright is installed: `npx playwright install`
2. Verify auth setup: `.auth/user.json` exists
3. Check database connection: Supabase URL and keys
4. Review error screenshots in `documentation/forms/test-runs/latest/screenshots/`

### Cleanup Failing
1. Verify `SUPABASE_SERVICE_ROLE_KEY` environment variable
2. Check RLS policies allow deletion
3. Review cleanup logs for specific errors
4. Manually query database for orphaned records

### Modal Tests Failing
1. Verify modal selectors in config
2. Check animation timing (may need longer waits)
3. Ensure overlay clickable
4. Review modal close implementation

## Best Practices

1. **Run tests before commits** - Catch issues early
2. **Review screenshots** - Visual verification is critical
3. **Keep inventory updated** - Document new forms immediately
4. **Monitor cleanup** - Verify no orphaned data
5. **Use appropriate scope** - Don't test all forms for small changes
6. **Document errors thoroughly** - Include reproduction steps
7. **Update configs as forms change** - Keep tests in sync with code

## Related Documentation

- [`FORM_INVENTORY.md`](../../../documentation/forms/FORM_INVENTORY.md) - Complete form catalog
- [`CLAUDE.md`](../../../CLAUDE.md) - Execution gates and rules
- [Playwright Config](../../../frontend/playwright.config.ts) - Test configuration
- [Test Helpers](../../../frontend/tests/helpers/) - Utility functions

## Support

For issues or questions:
1. Check error logs in test reports
2. Review screenshots for visual debugging
3. Consult `CLAUDE.md` for execution requirements
4. Review existing test patterns for examples

## Version History

- **v1.0.0** (2026-01-08) - Initial implementation
  - 28 forms cataloged
  - 6-phase workflow
  - Automatic database cleanup
  - CI/CD integration
  - Test helper utilities
  - Single source of truth migration
