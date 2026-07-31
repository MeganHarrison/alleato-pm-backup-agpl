# Specifications E2E Testing Checklist

Use this checklist when running or maintaining the Specifications E2E test suite.

## Pre-Test Setup

- [ ] **Environment variables configured**

  ```bash
  cat .env.local | grep -E "SUPABASE_URL|SUPABASE_ANON_KEY"
  ```
- [ ] **Test project exists (ID: 31)**

  ```bash
  # Check project exists in database
  node -e "const { createClient } = require('@supabase/supabase-js'); const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY); supabase.from('projects').select('id').eq('id', 31).single().then(({data,error}) => console.log(error ? 'NOT FOUND' : 'EXISTS'));"
  ```
- [ ] **Test fixtures exist**

  ```bash
  ls -l tests/fixtures/*.pdf tests/fixtures/*.txt
  # Should show: test-document.pdf, revised-drawing.pdf, invalid-file.txt
  ```
- [ ] **Playwright dependencies installed**

  ```bash
  npx playwright install
  ```

- [ ] **Development server NOT running** (tests start their own)

  ```bash
  # Kill any existing Next.js servers
  pkill -f "next dev"
  ```

---

## Running Tests

### Full Test Suite (26 tests, ~3 minutes)

- [ ] Run all specifications tests

  ```bash
  npm run test -- specifications
  ```
- [ ] Verify all tests pass

  ```text
  Expected output:
  ✓ specifications.spec.ts (8/8 passed)
  ✓ specifications-extended.spec.ts (18/18 passed)
  26 passed (135-180s)
  ```

### Individual Test Suites

- [ ] **Original suite** (8 tests, ~45s)

  ```bash
  npx playwright test tests/e2e/specifications.spec.ts
  ```
- [ ] **Extended suite** (18 tests, ~120s)

  ```bash
  npx playwright test tests/e2e/specifications-extended.spec.ts
  ```

### Category-Specific Tests

- [ ] **File upload validation** (4 tests)

  ```bash
  npx playwright test -g "File Upload Validation"
  ```
- [ ] **Revision management** (6 tests)

  ```bash
  npx playwright test -g "Revision Management"
  ```

- [ ] **Area management** (3 tests)

  ```bash
  npx playwright test -g "Area Management"
  ```
- [ ] **Pagination & search** (4 tests)

  ```bash
  npx playwright test -g "Pagination"
  ```
- [ ] **Edge cases** (6 tests)

  ```bash
  npx playwright test -g "Edge Cases"
  ```

---

## Post-Test Verification

### Check Test Output

- [ ] **All tests passed** (26/26)
- [ ] **No test data left behind**

  ```bash
  # Check for leftover test specs (should be none)
  node -e "const { createClient } = require('@supabase/supabase-js'); const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY); supabase.from('specification_sections').select('section_number', {count: 'exact'}).like('section_number', '99%').then(({count}) => console.log('Leftover test specs:', count));"
  ```

- [ ] **No errors in test report**

  ```bash
  npx playwright show-report
  ```

### Review Test Artifacts (if tests failed)

- [ ] **Screenshots** (in `test-results/` directory)
- [ ] **Videos** (if configured)
- [ ] **Trace files** (for detailed debugging)

  ```bash
  npx playwright show-trace test-results/<test-name>/trace.zip
  ```

---

## Debugging Failed Tests

If tests fail, follow this checklist:

### 1. Identify Failing Tests

- [ ] Note which test(s) failed
- [ ] Check error message in console output
- [ ] Review screenshot in `test-results/`

### 2. Run Failed Test in Debug Mode

- [ ] Run with UI mode

  ```bash
  npm run test:ui
  ```
- [ ] Run headed (visible browser)

  ```bash
  npx playwright test --headed -g "<failing test name>"
  ```

- [ ] Run with debug flag

  ```bash
  npx playwright test --debug -g "<failing test name>"
  ```

### 3. Common Failure Patterns

#### Timeout Errors

- [ ] Check if Supabase is responding
- [ ] Check network latency
- [ ] Increase timeout in specific test if needed

#### Element Not Found

- [ ] Check if UI has changed (selectors outdated)
- [ ] Check if feature is behind feature flag
- [ ] Check if page structure changed

#### Upload Errors

- [ ] Verify storage bucket exists
- [ ] Check RLS policies
- [ ] Verify file size limits

#### Database Errors

- [ ] Check if table schema changed
- [ ] Regenerate database types

  ```bash
  npm run db:types
  ```
- [ ] Check if RLS policies are blocking

### 4. Fix and Re-run

- [ ] Make necessary fixes
- [ ] Re-run specific test

  ```bash
  npx playwright test -g "<fixed test name>"
  ```
- [ ] If passes, re-run full suite

  ```bash
  npm run test -- specifications
  ```

---

## Test Data Cleanup

If tests leave data behind (shouldn't happen, but just in case):

### Manual Cleanup

- [ ] **Delete test specifications**

  ```bash
  node -e "const { createClient } = require('@supabase/supabase-js'); const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY); supabase.from('specification_sections').delete().like('section_number', '99%').then(({error}) => console.log(error || 'Cleaned'));"
  ```
- [ ] **Delete test areas**

  ```bash
  node -e "const { createClient } = require('@supabase/supabase-js'); const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY); supabase.from('specification_areas').delete().like('name', '%Test%E2E%').then(({error}) => console.log(error || 'Cleaned'));"
  ```
- [ ] **Delete test revisions** (cascades automatically)

### Verify Cleanup

- [ ] Check no test data remains

  ```bash
  # Should show 0
  node -e "const { createClient } = require('@supabase/supabase-js'); const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY); supabase.from('specification_sections').select('id', {count: 'exact'}).like('section_number', '99%').then(({count}) => console.log(count));"
  ```

---

## Maintenance Checklist

### Weekly

- [ ] Run full test suite
- [ ] Review any new failures
- [ ] Update selectors if UI changed
- [ ] Check test execution time (should be ~3 min)

### Monthly

- [ ] Add tests for new features
- [ ] Remove tests for deprecated features
- [ ] Update fixtures if needed
- [ ] Review test coverage gaps

### Quarterly

- [ ] Performance baseline check
- [ ] Update documentation
- [ ] Refresh test data strategy
- [ ] Review and update this checklist

### When Code Changes

- [ ] **Before UI changes**: Run tests to establish baseline
- [ ] **After UI changes**: Update selectors if needed
- [ ] **New features**: Add corresponding tests
- [ ] **Bug fixes**: Add regression test

---

## Test Coverage Verification

Use this to verify all scenarios are covered:

### File Upload Validation

- [ ] Reject .docx files
- [ ] Reject .txt files
- [ ] Reject files >50MB
- [ ] Accept valid PDFs

### Revision Management

- [ ] Sequential numbering (Rev 1, 2, 3...)
- [ ] Current revision indicator
- [ ] Download revision
- [ ] Delete old revisions
- [ ] Prevent delete current revision
- [ ] Add revision with notes

### Area Management

- [ ] Assign to area
- [ ] Filter by area
- [ ] Multi-area assignment

### Pagination & Search

- [ ] Pagination controls appear
- [ ] Navigate pages
- [ ] No results state
- [ ] Case-insensitive search

### Edge Cases

- [ ] Duplicate section numbers prevented
- [ ] Special characters handled
- [ ] Empty description allowed
- [ ] Long section numbers
- [ ] Very long titles

### CRUD Operations

- [ ] Create specification
- [ ] Read/view specification
- [ ] Update metadata
- [ ] Delete specification
- [ ] Search/filter specifications

---

## Success Criteria

All checkboxes below should be ✅:

- [ ] All 26 tests pass
- [ ] No test data left in database
- [ ] Test execution time <5 minutes
- [ ] No console errors during test run
- [ ] Test report shows 100% pass rate
- [ ] Screenshots/artifacts only from failed tests (should be none)

---

## Troubleshooting Reference

| Symptom | Likely Cause | Solution |
|---------|--------------|----------|
| "Project 31 not found" | Test project doesn't exist | Create project with ID 31 in database |
| Upload tests fail | Storage not configured | Check Supabase storage bucket setup |
| Pagination tests fail | Not enough specs | Pagination tests create their own data |
| Download test fails | File not found | Check file URL in revision record |
| Duplicate test fails | Constraint missing | Check unique constraint on section_number |
| All tests timeout | Supabase down | Check Supabase status, network |

---

## Contact & Support

**Documentation:**

- Test summary: `SPECIFICATIONS-TEST-SUMMARY.md`
- Quick start: `QUICK-START-specifications.md`
- Detailed README: `README-specifications-tests.md`

**Testing guides:**

- `.claude/testing/E2E-TESTING-GUIDE.md`
- `.claude/testing/PLAYWRIGHT-PATTERNS.md`
- `.claude/testing/ANTI-PATTERNS.md`

**For help:**

1. Check documentation above
2. Review test file comments
3. Check Playwright docs: <https://playwright.dev>
4. Ask in team chat

---

**Last Updated:** 2026-02-01
**Checklist Version:** 1.0
