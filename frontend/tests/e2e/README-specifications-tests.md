# Specifications E2E Test Coverage

## Overview

Comprehensive end-to-end test suite for the Specifications feature covering file uploads, revision management, area assignments, pagination, search, and edge cases.

## Test Files

### `specifications.spec.ts` (Original - 8 tests)

Basic CRUD operations and core functionality:

1. **Upload new specification** - Create spec with PDF upload
2. **Filter by search** - Search by section number/title
3. **Filter by status** - Filter active/archived specs
4. **View detail page** - Navigate to spec detail view
5. **Add revision** - Upload new revision to existing spec
6. **Edit metadata** - Update title and description
7. **Delete specification** - Remove spec with confirmation
8. **Validate required fields** - Form validation on empty submit

### `specifications-extended.spec.ts` (New - 18 tests)

Extended scenarios and edge cases:

#### File Upload Validation (4 tests)

1. **Reject non-PDF files (.docx)** - Browser blocks non-PDF uploads
2. **Reject non-PDF files (.txt)** - Validates file type restriction
3. **Reject oversized files (>50MB)** - Shows error for files exceeding limit
4. **Accept valid PDF within size limit** - Successful upload of valid PDF

#### Revision Management (6 tests)

1. **Display sequential revision numbering** - Rev 1, Rev 2, Rev 3 numbering
2. **Set current revision** - Display current revision indicator
3. **Download revision** - Initiate file download
4. **Delete non-current revision** - Remove old revisions
5. **Prevent delete of current revision** - Disable delete for active revision
6. **Revision notes** - Add notes when uploading new revision

#### Area Management (3 tests)

1. **Assign specification to area** - Link spec to area
2. **Filter by area** - Filter specs by assigned area
3. **Multi-area assignment** - Assign spec to multiple areas

#### Pagination & Search (4 tests)

1. **Pagination controls** - Display when >20 specs exist
2. **Navigate between pages** - Click next/previous
3. **Search with no results** - Show empty state
4. **Search case-insensitive** - Search works regardless of case

#### Edge Cases (6 tests)

1. **Prevent duplicate section numbers** - Unique constraint validation
2. **Special characters in title** - Handle &, <, >, ", etc.
3. **Empty description** - Optional field can be blank
4. **Long section numbers** - Handle extended numbering schemes
5. **Very long titles** - Validate or truncate long titles
6. **Error recovery** - Cancel dialogs, dismiss toasts

## Total Coverage

**26 comprehensive E2E tests** covering:

- ✅ File upload validation (type, size, format)
- ✅ Revision management (add, download, delete, numbering)
- ✅ Area assignments and filtering
- ✅ Pagination for large datasets
- ✅ Search functionality (including edge cases)
- ✅ Form validation and error handling
- ✅ Edge cases (duplicates, special chars, empty fields)
- ✅ User feedback (toasts, dialogs, confirmations)

## Running Tests

```bash
# Run all specification tests
npm run test -- specifications

# Run specific test file
npx playwright test tests/e2e/specifications.spec.ts
npx playwright test tests/e2e/specifications-extended.spec.ts

# Run with UI mode
npm run test:ui

# Run specific test by name
npx playwright test -g "should reject oversized files"

# Run headed (see browser)
npm run test:headed
```
## Test Data Cleanup

All tests follow proper cleanup patterns:

- `beforeAll` - Setup test data
- `afterAll` - Delete test data
- `afterEach` - Cleanup per-test resources
- Cleanup uses Supabase client to delete via database
- Test specs use unique section numbers (`99 XX XX` range)

## Fixtures Used

Located in `frontend/tests/fixtures/`:

- `test-document.pdf` - Valid small PDF (~500 bytes)
- `revised-drawing.pdf` - PDF for revision uploads
- `test-drawing-1.pdf` - Additional valid PDF
- `invalid-file.txt` - Non-PDF for rejection tests

## Key Patterns

### File Upload Testing

```typescript
const fileInput = page.locator('input[type="file"][accept="application/pdf"]');

// Upload from fixture
await fileInput.setInputFiles(path.join(FIXTURES_DIR, "test-document.pdf"));

// Upload from buffer
await fileInput.setInputFiles({
  name: "test.pdf",
  mimeType: "application/pdf",
  buffer: Buffer.from("%PDF-1.4 content"),
});
```
### Large File Creation

```typescript
function createLargePDFBuffer(): Buffer {
  const contentSize = 52 * 1024 * 1024; // 52MB
  const padding = Buffer.alloc(contentSize, "A");
  return Buffer.concat([Buffer.from("%PDF-1.4\n"), padding, Buffer.from("%%EOF\n")]);
}
```
### Toast Dismissal

```typescript
async function dismissToasts(page: Page) {
  const closeButtons = page.getByRole("button", { name: /close toast/i });
  const count = await closeButtons.count();
  for (let i = 0; i < count; i++) {
    await closeButtons.nth(0).click({ timeout: 1000 }).catch(() => {});
  }
}
```

### Pagination Setup

```typescript
// Create 35 specs for pagination (default page size is 20)
const sections = Array.from({ length: 35 }, (_, i) => ({
  section_number: `99 88 ${String(i).padStart(2, "0")}`,
  title: `Pagination Test Spec ${i + 1}`,
}));
```
## Known Issues / Future Improvements

1. **Multi-area assignment** - UI may not support multiple areas yet
2. **Revision "set as current"** - Feature may need implementation
3. **File size validation** - Backend validation needed
4. **Download testing** - Only checks download initiation, not content
5. **RLS policies** - Tests run with service role, not auth user

## Dependencies

- `@playwright/test` - E2E test framework
- `@supabase/supabase-js` - Database access for setup/cleanup
- `path` - File path utilities
- `fs` - File system access for fixtures

## Environment Variables Required

```bash
NEXT_PUBLIC_SUPABASE_URL=<your-supabase-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
```
## Test Execution Time

- **specifications.spec.ts**: ~45-60 seconds
- **specifications-extended.spec.ts**: ~90-120 seconds
- **Total**: ~2-3 minutes for full suite

## Debugging Failed Tests

```bash
# Run with trace
npx playwright test --trace on

# View trace
npx playwright show-trace trace.zip

# Run with debug mode
npx playwright test --debug

# Screenshot on failure
npx playwright test --screenshot on
```

## CI/CD Integration

Tests are configured to run in GitHub Actions:

- Run on PR to `main`
- Run on push to `main`
- Run nightly for regression detection
- Artifacts saved for failed test screenshots

## Maintenance

When adding new specification features:

1. Add test to appropriate describe block
2. Use unique section numbers (`99 XX XX` range)
3. Follow cleanup patterns (beforeAll/afterAll)
4. Add fixtures to `tests/fixtures/` if needed
5. Update this README with new test coverage
6. Ensure test names are descriptive and follow pattern

## Contact

For issues with tests or adding new scenarios, see:

- `.claude/testing/E2E-TESTING-GUIDE.md` - Testing standards
- `.claude/testing/PLAYWRIGHT-PATTERNS.md` - Playwright patterns
- `.claude/testing/ANTI-PATTERNS.md` - What to avoid
