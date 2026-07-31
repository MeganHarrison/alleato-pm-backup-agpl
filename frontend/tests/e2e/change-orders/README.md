# Change Orders E2E Test Suite

## Test Files

### Existing Tests
- `change-orders-crud.spec.ts` - Basic CRUD operations
- `change-order-ui.spec.ts` - UI flows and interactions
- `change-order-contract-picker.spec.ts` - Contract selection functionality
- `change-order-reviewer-picker.spec.ts` - Reviewer selection functionality
- `change-order-reviewer-response.spec.ts` - Approval/rejection workflows
- `change-order-scope-schedule.spec.ts` - Scope and schedule impact

### New Comprehensive Test (2026-02-21)
- `change-orders-comprehensive.spec.ts` - Advanced workflows covering:
  - **Status Workflow** (5 tests)
    - Submit draft CO for review
    - Approve pending CO
    - Reject CO with required reason
    - Execute approved CO (irreversible action)
    - Prevent editing executed CO (read-only verification)

  - **Line Items** (4 tests)
    - Add multiple line items with total calculation
    - Edit line item quantity with recalculation
    - Delete line item and update total
    - Read-only line items when CO is approved

  - **Filtering and Search** (4 tests)
    - Status tab filtering (Draft, Pending, Approved)
    - Search by CO number
    - Search by title
    - Clear filters to show all COs

  - **Navigation** (3 tests)
    - Navigate to detail by clicking table row
    - Tab navigation on detail page (General, Line Items, Attachments)
    - Return to list via back button

## Database Helpers Added

New helper functions in `tests/helpers/db.ts`:

### Change Order Status Management
```typescript
updateChangeOrderStatus(id, status, additionalFields?)
```
Updates CO status with optional fields for submitted_at, approved_at, approved_by, rejection_reason.

### Line Item Management
```typescript
createChangeOrderLineItem(input: LineItemInput)
updateChangeOrderLineItem(id, updates)
deleteChangeOrderLineItem(id)
deleteChangeOrderLineItems(changeEventId)
```

### Test Data Cleanup
```typescript
deleteTestChangeOrders(projectId, prefix = "CO-E2E-")
```
Cleans up test change orders by CO number prefix.

## Test Data Conventions

- **Test Project ID**: 67 (Vermillion Rise Warehouse)
- **CO Number Prefix**: `CO-E2E-*` (auto-generated with timestamp)
- **Test Isolation**: Each test creates its own data and cleans up
- **Authentication**: Automatic via saved auth state (`tests/.auth/user.json`)

## Running Tests

### Run All Change Order Tests
```bash
cd frontend
npx playwright test tests/e2e/change-orders/
```

### Run Comprehensive Tests Only
```bash
npx playwright test tests/e2e/change-orders/change-orders-comprehensive.spec.ts
```

### Run with UI Mode (Recommended for Debugging)
```bash
npx playwright test tests/e2e/change-orders/change-orders-comprehensive.spec.ts --ui
```

### Run Specific Test Suite
```bash
# Status workflow tests
npx playwright test tests/e2e/change-orders/change-orders-comprehensive.spec.ts -g "Status Workflow"

# Line items tests
npx playwright test tests/e2e/change-orders/change-orders-comprehensive.spec.ts -g "Line Items"

# Filtering tests
npx playwright test tests/e2e/change-orders/change-orders-comprehensive.spec.ts -g "Filtering"

# Navigation tests
npx playwright test tests/e2e/change-orders/change-orders-comprehensive.spec.ts -g "Navigation"
```

## Coverage Gaps Filled

The comprehensive test suite fills critical gaps in the existing test coverage:

1. **Status Workflow Transitions** - Previously no tests verified the complete workflow from draft → pending → approved → executed
2. **Line Item Calculations** - No tests verified totals update correctly when items are added/edited/deleted
3. **Read-Only Enforcement** - No tests verified executed COs cannot be modified
4. **Filtering/Search** - No tests verified status tabs and search functionality work correctly
5. **Tab Navigation** - No tests verified tab switching on detail pages

## Test Architecture

All tests follow E2E best practices:

1. **Real User Actions** - Click buttons, fill forms, submit data
2. **UI Verification** - Check toasts, updated values, disabled states
3. **Persistence Verification** - Query database to confirm changes saved
4. **Test Isolation** - Each test is independent with own data
5. **Cleanup** - All test data removed in beforeEach/afterAll hooks

## Important Notes

- Videos are automatically recorded (enabled in playwright.config.ts)
- Screenshots on failure are automatic
- No manual login required (auth state pre-configured)
- Tests run in headless mode by default
- Use `--headed` flag only for debugging specific issues

## Future Enhancements

Potential test additions:

1. **Permissions** - Verify different user roles have correct access
2. **Attachments** - Upload/download/delete file attachments
3. **Audit Trail** - Verify status change history is recorded
4. **Bulk Operations** - Test multi-select and bulk actions
5. **Validation** - Test all form field validations
6. **Edge Cases** - Test boundary conditions and error states
