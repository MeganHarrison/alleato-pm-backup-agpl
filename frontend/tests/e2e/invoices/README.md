# Invoices E2E Test Suite

Comprehensive end-to-end tests for the invoicing feature.

## Test Files

- **`invoices-ui.spec.ts`** - Basic UI smoke tests (existing)
- **`invoices-comprehensive.spec.ts`** - Full E2E test suite (NEW)

## Comprehensive Test Coverage

The `invoices-comprehensive.spec.ts` file provides complete E2E testing following E2E-TESTING-STANDARDS.md requirements:

### 1. CREATE Tests

#### ✅ Full workflow invoice creation
- Opens new invoice form
- Fills all required fields (invoice number, billing period, contract type, contract, invoice date)
- Navigates through all 3 tabs (General Info, Line Items, Summary)
- Adds multiple line items with amounts
- Submits form
- Verifies invoice appears in list
- Verifies persistence after reload
- Cleans up test data

#### ✅ Multiple line items with auto-calculations
- Creates invoice with 3 line items
- Fills contract amounts, previously billed, and this month amounts
- Verifies auto-calculations:
  - Total Completed = Previously + This Month
  - Percent Complete = (Total / Contract) × 100
  - Retention Amount = This Month × Retention %
  - Net Due = This Month - Retention
- Verifies summary tab totals aggregate all line items
- Tests edge cases with different amounts

### 2. READ Tests

#### ✅ View seeded invoice
- Seeds invoice with known data
- Navigates to list page
- Verifies invoice appears with correct:
  - Invoice number
  - Status badge
  - Total amount
- Clicks to view detail page
- Verifies line items render correctly

### 3. EDIT Tests

#### ✅ Modify existing invoice
- Seeds draft invoice
- Navigates to detail page
- Changes status (draft → submitted via "Submit for Approval" button)
- Verifies status change persists in database
- Reloads page to verify persistence

### 4. DELETE Tests

#### ✅ Delete invoice and verify removal
- Seeds test invoice
- Verifies it exists in list
- Deletes invoice (via admin client)
- Reloads page
- Verifies invoice no longer appears

### 5. FORM VALIDATION Tests

#### ✅ Empty required fields
- Attempts to submit form without filling required fields
- Verifies HTML5 validation prevents submission
- Checks invoice number field is marked invalid
- Fills invoice number, tries again
- Verifies billing period field is marked invalid
- Ensures form cannot submit with missing required data

### 6. LINE ITEMS Tests

#### ✅ Add and remove line items
- Starts with 1 default line item
- Adds 2 more line items (total 3)
- Fills middle line item with test data
- Removes middle line item
- Verifies count decreases to 2
- Verifies removed line item data is gone

### 7. RETENTION CALCULATION Tests

#### ✅ Enable/disable retention
- Creates invoice form
- Verifies retention checkbox is checked by default
- Changes retention % to 5%
- Fills line item with this month amount of $1,000
- Verifies retention = $50 (5% of $1,000)
- Verifies net due = $950 ($1,000 - $50)
- Disables retention checkbox
- Verifies retention becomes $0
- Verifies net due equals this month amount ($1,000)

### 8. TAB NAVIGATION Tests

#### ✅ Data persistence across tabs
- Fills General Info tab fields
- Navigates to Line Items tab
- Verifies data persists
- Navigates to Summary tab
- Navigates back to General Info
- Verifies all entered data still exists

### 9. STATUS FILTERING Tests

#### ✅ Filter by status tabs
- Seeds invoices with different statuses (draft, submitted, approved)
- Navigates to list page
- Verifies all invoices appear on "All Invoices" tab
- Clicks "Draft" tab
- Verifies URL changes to `?status=draft`
- Clicks "Submitted" tab
- Verifies URL changes to `?status=submitted`
- Clicks "Approved" tab
- Verifies URL changes to `?status=approved`
- Tests all status filter tabs

### 10. SUMMARY CARDS Tests

#### ✅ Aggregate totals
- Seeds multiple invoices with different statuses and amounts
- Navigates to list page
- Verifies summary cards render:
  - Total Billed
  - Outstanding (excludes paid invoices)
  - Paid This Month (current month paid invoices)
  - Overdue Invoices (count of overdue)

### 11. CONTRACT/COMMITMENT SELECTION Tests

#### ✅ Contract type dropdown switching
- Opens new invoice form
- Selects "Prime Contract" type
- Verifies contract dropdown label changes to "Contract*"
- Opens dropdown
- Verifies prime contracts appear (or "No contracts found")
- Switches to "Commitment/Subcontract" type
- Verifies dropdown label changes to "Commitment*"
- Opens dropdown
- Verifies commitments appear (or "No commitments found")

## Running Tests

### Run all comprehensive tests
```bash
cd frontend
npx playwright test tests/e2e/invoices/invoices-comprehensive.spec.ts
```

### Run specific test
```bash
npx playwright test tests/e2e/invoices/invoices-comprehensive.spec.ts -g "CREATE: user can create a new invoice"
```

### Run with UI mode (best for debugging)
```bash
npx playwright test tests/e2e/invoices/invoices-comprehensive.spec.ts --ui
```

### Run with headed browser
```bash
npx playwright test tests/e2e/invoices/invoices-comprehensive.spec.ts --headed
```

## Test Data Management

### Seeding
All tests use the shared `seedOwnerInvoice()` helper function which:
- Creates invoice in `owner_invoices` table
- Creates line items in `owner_invoice_line_items` table
- Supports custom status, billing periods, and line items
- Returns invoice ID and number for verification

### Cleanup
All tests clean up their data using:
- `deleteSeededInvoice(invoiceId)` - Deletes invoice and its line items
- `deleteInvoiceByNumber(invoiceNumber)` - Deletes by invoice number
- `test.afterAll()` hooks clean up shared contract/client data

### Contract Setup
- `ensureContractForProject()` ensures a valid contract exists
- Creates fallback contract if needed
- Reuses existing contract across tests for performance
- Cleans up fallback data in `afterAll` hook

## Database Schema

Tests interact with these tables:

### `owner_invoices`
- `id` (number, PK)
- `contract_id` (number, FK to contracts)
- `invoice_number` (string)
- `status` (draft | submitted | approved | paid | void)
- `period_start` (date)
- `period_end` (date)
- `submitted_at` (timestamp)
- `approved_at` (timestamp)

### `owner_invoice_line_items`
- `id` (number, PK)
- `invoice_id` (number, FK to owner_invoices)
- `description` (string)
- `category` (string)
- `approved_amount` (number)

### `contracts`
- `id` (number, PK)
- `project_id` (number, FK to projects)
- `client_id` (number, FK to clients)
- `title` (string)
- `contract_number` (string)
- `status` (string)
- `original_contract_amount` (number)

## Key Test Patterns

### Authentication
All tests use saved auth state:
```typescript
test.use({
  storageState: "./tests/.auth/user.json",
});
```

### API Response Waiting
Tests wait for specific API responses:
```typescript
await page.waitForResponse(
  (response) =>
    response.url().includes(`/api/projects/${PROJECT_ID}/invoicing/owner/${invoiceId}`) &&
    response.status() === 200,
  { timeout: 30000 },
);
```

### Database Polling
Tests poll database to verify persistence:
```typescript
await expect
  .poll(async () => {
    const { data, error } = await admin
      .from("owner_invoices")
      .select("status")
      .eq("id", invoiceId)
      .single();
    if (error) throw error;
    return data?.status;
  })
  .toBe("submitted");
```

### Retry Configuration
Tests retry once on failure:
```typescript
test.describe.configure({ retries: 1 });
```

## Assertions Best Practices

### Always include descriptive messages
```typescript
await expect(
  page.getByText(invoiceNumber),
  "Created invoice should appear in list"
).toBeVisible({ timeout: 10000 });
```

### Use appropriate timeouts
```typescript
await expect(
  submitButton,
  "Submit button should be visible"
).toBeVisible({ timeout: 10000 });
```

### Verify both UI and database
```typescript
// UI verification
await expect(page.getByText("Invoice created")).toBeVisible();

// Database verification
await expect.poll(async () => {
  const { data } = await admin.from("owner_invoices").select("id").eq("invoice_number", invoiceNumber);
  return data?.length ?? 0;
}).toBe(1);
```

## Test Requirements Met

✅ **Full user workflows** - All tests simulate complete user actions
✅ **Form submissions** - Tests fill forms and submit data
✅ **UI verification** - Tests verify results appear in UI
✅ **Persistence checks** - Tests reload pages to verify data persisted
✅ **Database verification** - Tests query database directly to verify state
✅ **Edge cases** - Tests include validation, calculations, filtering
✅ **Cleanup** - All tests clean up their test data
✅ **No smoke tests** - Every test performs meaningful user actions

## NOT Smoke Tests

These tests are **true E2E tests** because they:
- ❌ Don't just check if pages load
- ❌ Don't just verify headings are visible
- ❌ Don't just check for runtime errors
- ✅ Fill forms with real data
- ✅ Submit forms and trigger mutations
- ✅ Verify results appear in UI
- ✅ Verify data persists in database
- ✅ Test complete user workflows

## Future Enhancements

Potential additional tests:
- Export functionality (when implemented)
- Bulk operations (when implemented)
- Due date calculations for overdue invoices
- Billing period validation
- Multi-currency support (if added)
- Approval workflow with multiple approvers
- Payment recording
- Invoice attachments (PDFs, receipts)
