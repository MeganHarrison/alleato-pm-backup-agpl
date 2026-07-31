# Quick Start - Specifications E2E Tests

## Prerequisites

```bash
# Ensure dependencies installed
npm install

# Ensure environment variables set
cat .env.local | grep SUPABASE
# Should show:
# NEXT_PUBLIC_SUPABASE_URL=...
# NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```
## Run All Specifications Tests

```bash
# From frontend directory
npm run test -- specifications

# Expected output:
# Running 26 tests using 4 workers
# ✓ specifications.spec.ts (8 tests) - 45s
# ✓ specifications-extended.spec.ts (18 tests) - 120s
```
## Run Specific Test Suites

```bash
# Original 8 tests
npx playwright test tests/e2e/specifications.spec.ts

# Extended 18 tests
npx playwright test tests/e2e/specifications-extended.spec.ts

# File upload validation only (4 tests)
npx playwright test tests/e2e/specifications-extended.spec.ts -g "File Upload Validation"

# Revision management only (6 tests)
npx playwright test tests/e2e/specifications-extended.spec.ts -g "Revision Management"

# Area management only (3 tests)
npx playwright test tests/e2e/specifications-extended.spec.ts -g "Area Management"

# Pagination & search only (4 tests)
npx playwright test tests/e2e/specifications-extended.spec.ts -g "Pagination"

# Edge cases only (6 tests)
npx playwright test tests/e2e/specifications-extended.spec.ts -g "Edge Cases"
```
## Debug Failed Tests

```bash
# Run with UI (interactive mode)
npm run test:ui

# Run headed (see browser)
npm run test:headed -- tests/e2e/specifications-extended.spec.ts

# Run specific test with debug
npx playwright test --debug -g "should reject oversized files"

# View last run report
npx playwright show-report
```

## Common Issues

### Issue: Tests fail with "Project 31 not found"

**Solution:** Ensure test project exists in database

```bash
# Check if project 31 exists
node -e "
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
supabase.from('projects').select('id,name').eq('id', 31).single().then(({data}) => console.log(data));
"
```
### Issue: Tests leave behind test data

**Solution:** Manually cleanup test specs

```bash
# Delete all test specifications (section numbers starting with 99)
node -e "
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
supabase.from('specification_sections').delete().like('section_number', '99%').then(({error}) => console.log(error ? 'Error' : 'Cleaned up'));
"
```
### Issue: File upload tests timeout

**Solution:** Check Supabase storage is configured

1. Verify storage bucket exists: `specifications`
2. Check RLS policies allow uploads
3. Increase timeout in test if needed

### Issue: Pagination tests fail

**Solution:** Ensure enough test data exists

The pagination tests create 35 specs. If they fail:

```bash
# Check spec count
node -e "
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
supabase.from('specification_sections').select('id', {count: 'exact'}).eq('project_id', 31).then(({count}) => console.log('Total specs:', count));
"
```
## Test Data

### Fixtures Location

```

frontend/tests/fixtures/
├── test-document.pdf       → Valid PDF for uploads
├── revised-drawing.pdf     → PDF for revisions
├── invalid-file.txt        → Non-PDF for rejection tests

```
### Test Section Numbers

All test specs use section numbers starting with `99`:

- `99 99 XX` - Original test suite
- `99 88 XX` - Pagination test suite
- `99 77 XX` - Edge cases test suite

**These can be safely deleted** after test runs.

## View Test Coverage

```bash
# View test summary
cat tests/e2e/SPECIFICATIONS-TEST-SUMMARY.md

# View detailed README
cat tests/e2e/README-specifications-tests.md
```
## CI/CD

Tests run automatically on:

- Pull requests to `main`
- Pushes to `main`
- Nightly builds

View results in GitHub Actions:
`https://github.com/<org>/<repo>/actions`

## Performance

Expected execution times:

- Original suite: ~45-60 seconds
- Extended suite: ~90-120 seconds
- **Total: ~2-3 minutes**

If tests take significantly longer:

1. Check network latency to Supabase
2. Check database performance
3. Check for other tests running concurrently

## Next Steps

After verifying tests pass:

1. Review test output for any warnings
2. Check test coverage report
3. Add new tests for any uncovered features
4. Update documentation if behavior changes

## Help

For issues or questions:

1. Check `.claude/testing/E2E-TESTING-GUIDE.md`
2. Check `.claude/testing/PLAYWRIGHT-PATTERNS.md`
3. Review test file comments
4. Ask in team chat

---

**Quick Command Reference:**

```bash
# Run all
npm run test -- specifications

# Debug mode
npm run test:ui

# Watch mode
npm run test -- specifications --ui

# Specific test
npx playwright test -g "should upload"

# View report
npx playwright show-report
```
