/**
 * Change Orders Feature Screenshot Capture
 *
 * Captures screenshots and metadata for the Change Orders feature
 * to document UI elements and create comprehensive test plan.
 */

import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../../.env') });

const OUTPUT_DIR = join(__dirname, '../../output/playwright/change-orders');
const BASE_URL = 'http://localhost:3000';
const PROJECT_ID = 31;

// Ensure output directory exists
mkdirSync(OUTPUT_DIR, { recursive: true });

async function captureScreenshot(page, name, description) {
  const timestamp = Date.now();
  const filename = `${name}-${timestamp}.png`;
  const filepath = join(OUTPUT_DIR, filename);

  await page.screenshot({ path: filepath, fullPage: true });

  console.log(`✓ Captured: ${filename}`);
  return {
    name,
    description,
    filename,
    timestamp,
    url: page.url(),
  };
}

async function captureElementInfo(page, selector, description) {
  try {
    const element = await page.locator(selector).first();
    const isVisible = await element.isVisible();
    const text = isVisible ? await element.textContent() : null;
    const attributes = isVisible ? await element.evaluate(el => ({
      id: el.id,
      className: el.className,
      role: el.getAttribute('role'),
      type: el.getAttribute('type'),
      name: el.getAttribute('name'),
    })) : null;

    return {
      selector,
      description,
      isVisible,
      text,
      attributes,
    };
  } catch (error) {
    return {
      selector,
      description,
      isVisible: false,
      error: error.message,
    };
  }
}

async function main() {
  console.log('Starting Change Orders feature capture...');

  const browser = await chromium.launch({ headless: false });

  // Use saved auth state from Playwright tests
  const authStatePath = join(__dirname, '../../frontend/tests/.auth/user.json');
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    storageState: authStatePath,
  });
  const page = await context.newPage();

  const screenshots = [];
  const elements = [];
  const workflows = [];

  try {
    // Navigate to Change Orders list
    console.log('\n1. Navigating to Change Orders list...');
    await page.goto(`${BASE_URL}/${PROJECT_ID}/change-orders`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000); // Wait for data to load

    screenshots.push(await captureScreenshot(
      page,
      'change-orders-list',
      'Change Orders list page showing all change orders'
    ));

    // Capture list page elements
    console.log('\n2. Capturing list page elements...');
    elements.push(await captureElementInfo(page, 'h1', 'Page title'));
    elements.push(await captureElementInfo(page, 'button:has-text("New Change Order")', 'New Change Order button'));
    elements.push(await captureElementInfo(page, 'input[type="search"], input[placeholder*="Search"]', 'Search input'));
    elements.push(await captureElementInfo(page, '[role="tab"]', 'Status filter tabs'));
    elements.push(await captureElementInfo(page, 'table, [role="table"]', 'Change orders table'));

    // Try to click New Change Order button
    console.log('\n3. Opening New Change Order form...');
    try {
      const newButton = page.getByRole('button', { name: /new change order/i });
      if (await newButton.isVisible()) {
        await newButton.click();
        await page.waitForTimeout(1000);

        screenshots.push(await captureScreenshot(
          page,
          'change-order-new-form',
          'New Change Order form dialog'
        ));

        // Capture form elements
        elements.push(await captureElementInfo(page, 'input[name="co_number"], #co-number', 'CO Number field'));
        elements.push(await captureElementInfo(page, 'input[name="title"], #title', 'Title field'));
        elements.push(await captureElementInfo(page, 'textarea[name="description"], #description', 'Description field'));
        elements.push(await captureElementInfo(page, 'input[name="amount"], #amount', 'Amount field'));
        elements.push(await captureElementInfo(page, 'select[name="status"], #status', 'Status dropdown'));
        elements.push(await captureElementInfo(page, 'button[type="submit"]', 'Submit button'));
        elements.push(await captureElementInfo(page, 'button:has-text("Cancel")', 'Cancel button'));

        // Close dialog
        const cancelButton = page.getByRole('button', { name: /cancel/i });
        if (await cancelButton.isVisible()) {
          await cancelButton.click();
          await page.waitForTimeout(500);
        }
      }
    } catch (error) {
      console.log(`Could not open new form: ${error.message}`);
    }

    // Try to view change order detail
    console.log('\n4. Viewing change order detail...');
    try {
      const firstRow = page.locator('table tr, [role="row"]').nth(1);
      if (await firstRow.isVisible()) {
        await firstRow.click();
        await page.waitForTimeout(1500);

        screenshots.push(await captureScreenshot(
          page,
          'change-order-detail',
          'Change Order detail page'
        ));

        // Capture detail page elements
        elements.push(await captureElementInfo(page, 'h1', 'Detail page title'));
        elements.push(await captureElementInfo(page, '[role="tab"]', 'Detail tabs (General, Line Items, Attachments)'));
        elements.push(await captureElementInfo(page, 'button:has-text("Edit")', 'Edit button'));
        elements.push(await captureElementInfo(page, 'button:has-text("Submit")', 'Submit button'));
        elements.push(await captureElementInfo(page, 'button:has-text("Approve")', 'Approve button'));
        elements.push(await captureElementInfo(page, 'button:has-text("Reject")', 'Reject button'));

        // Try to view Line Items tab
        console.log('\n5. Viewing Line Items tab...');
        const lineItemsTab = page.getByRole('tab', { name: /line items/i });
        if (await lineItemsTab.isVisible()) {
          await lineItemsTab.click();
          await page.waitForTimeout(1000);

          screenshots.push(await captureScreenshot(
            page,
            'change-order-line-items',
            'Change Order line items tab'
          ));

          elements.push(await captureElementInfo(page, 'button:has-text("Add Line Item")', 'Add Line Item button'));
          elements.push(await captureElementInfo(page, 'table, [role="table"]', 'Line items table'));
        }
      }
    } catch (error) {
      console.log(`Could not view detail: ${error.message}`);
    }

    // Document workflows
    workflows.push({
      name: 'Create Change Order',
      steps: [
        'Navigate to Change Orders list page',
        'Click "New Change Order" button',
        'Fill in CO Number, Title, Description',
        'Enter Amount (optional)',
        'Select Status (default: draft)',
        'Click "Create" or "Save" button',
        'Verify success toast appears',
        'Verify new CO appears in list',
      ],
    });

    workflows.push({
      name: 'Submit Change Order for Approval',
      steps: [
        'Navigate to Change Orders list',
        'Click on a draft change order row',
        'Verify status is "draft"',
        'Click "Submit" button',
        'Confirm submission in dialog',
        'Verify status changes to "pending"',
        'Verify submitted_at timestamp is set',
      ],
    });

    workflows.push({
      name: 'Approve Change Order',
      steps: [
        'Navigate to change order detail (status: pending)',
        'Click "Approve" button',
        'Verify success message',
        'Verify status changes to "approved"',
        'Verify approved_at timestamp is set',
        'Verify contract value is updated',
      ],
    });

    workflows.push({
      name: 'Add Line Items',
      steps: [
        'Navigate to change order detail',
        'Click "Line Items" tab',
        'Click "Add Line Item" button',
        'Fill in description, quantity, unit cost',
        'Verify total is calculated (quantity × unit cost)',
        'Click "Save"',
        'Verify line item appears in table',
        'Verify CO total is updated',
      ],
    });

    workflows.push({
      name: 'Edit Line Item',
      steps: [
        'Navigate to change order Line Items tab',
        'Find line item to edit',
        'Click edit button',
        'Modify quantity or unit cost',
        'Click "Save"',
        'Verify line item is updated',
        'Verify total is recalculated',
      ],
    });

    workflows.push({
      name: 'Filter and Search',
      steps: [
        'Navigate to Change Orders list',
        'Use status tabs to filter (Draft, Pending, Approved, etc.)',
        'Enter search term in search box',
        'Verify filtered results show only matching COs',
        'Clear filters to see all COs again',
      ],
    });

  } catch (error) {
    console.error('Error during capture:', error);
  } finally {
    await browser.close();
  }

  // Write report
  const report = {
    title: 'Change Orders Feature - UI Exploration Report',
    timestamp: new Date().toISOString(),
    screenshots,
    elements: elements.filter(e => e.isVisible),
    workflows,
    summary: {
      totalScreenshots: screenshots.length,
      visibleElements: elements.filter(e => e.isVisible).length,
      workflows: workflows.length,
    },
  };

  const reportPath = join(OUTPUT_DIR, 'exploration-report.json');
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n✓ Report saved to: ${reportPath}`);

  // Generate test plan markdown
  const testPlan = generateTestPlan(report);
  const testPlanPath = join(OUTPUT_DIR, 'test-plan.md');
  writeFileSync(testPlanPath, testPlan);
  console.log(`✓ Test plan saved to: ${testPlanPath}`);

  console.log('\n=== Capture Summary ===');
  console.log(`Screenshots: ${report.summary.totalScreenshots}`);
  console.log(`Visible Elements: ${report.summary.visibleElements}`);
  console.log(`Workflows: ${report.summary.workflows}`);
  console.log('\nDone!');
}

function generateTestPlan(report) {
  const { screenshots, elements, workflows } = report;

  return `# Change Orders E2E Test Plan

**Generated:** ${new Date().toISOString()}

## Overview

This test plan covers comprehensive E2E testing of the Change Orders feature based on actual UI exploration.

---

## Screenshots Captured

${screenshots.map((s, i) => `
### ${i + 1}. ${s.description}

**File:** \`${s.filename}\`
**URL:** ${s.url}
**Timestamp:** ${new Date(s.timestamp).toISOString()}
`).join('\n')}

---

## UI Elements Documented

${elements.map(e => `
### ${e.description}

- **Selector:** \`${e.selector}\`
- **Visible:** ${e.isVisible ? '✓' : '✗'}
${e.text ? `- **Text:** "${e.text.trim().slice(0, 50)}..."` : ''}
${e.attributes ? `- **Attributes:** ${JSON.stringify(e.attributes, null, 2)}` : ''}
`).join('\n')}

---

## Test Workflows

${workflows.map((w, i) => `
### ${i + 1}. ${w.name}

${w.steps.map((step, j) => `${j + 1}. ${step}`).join('\n')}

**Test Coverage:**
- [ ] Happy path (valid data)
- [ ] Validation errors (missing required fields)
- [ ] Success feedback (toasts, UI updates)
- [ ] Data persistence (verify in database)
- [ ] UI state updates (status changes, calculated fields)
`).join('\n\n')}

---

## Test Scenarios

### 1. Change Order CRUD Operations

#### Create
- [ ] Create draft change order with all required fields
- [ ] Create change order with line items
- [ ] Verify CO appears in list
- [ ] Verify CO can be viewed in detail
- [ ] Test validation (missing title, invalid amount, etc.)

#### Read
- [ ] View change order list
- [ ] View change order detail
- [ ] View line items
- [ ] View attachments (if feature exists)
- [ ] Verify status badges render correctly

#### Update
- [ ] Edit draft change order
- [ ] Update line item quantities
- [ ] Change status via workflow actions
- [ ] Verify changes persist
- [ ] Verify calculated fields update

#### Delete
- [ ] Delete draft change order
- [ ] Verify confirmation dialog appears
- [ ] Verify CO is removed from list
- [ ] Verify cascade deletion (line items)

---

### 2. Status Workflow

- [ ] Draft → Submit → Pending
- [ ] Pending → Approve → Approved
- [ ] Pending → Reject → Rejected (with reason)
- [ ] Approved → Execute → Executed
- [ ] Verify read-only state for executed COs
- [ ] Verify status transitions follow rules
- [ ] Verify timestamps (submitted_at, approved_at, etc.)

---

### 3. Line Item Management

- [ ] Add single line item
- [ ] Add multiple line items
- [ ] Edit line item (quantity, unit cost)
- [ ] Delete line item
- [ ] Verify total calculation (sum of all line items)
- [ ] Verify line items are read-only when CO is approved
- [ ] Verify line item validation (quantity > 0, cost > 0)

---

### 4. Filtering and Search

- [ ] Filter by status tabs (Draft, Pending, Approved, Rejected, Executed)
- [ ] Search by CO number
- [ ] Search by title
- [ ] Search by description (if implemented)
- [ ] Combine filters (status + search)
- [ ] Clear filters
- [ ] Verify filter state persists on navigation

---

### 5. Validation and Error Handling

- [ ] Required field validation (title, CO number)
- [ ] Numeric validation (amount > 0)
- [ ] Duplicate CO number prevention
- [ ] Invalid status transitions
- [ ] Line item validation (quantity, cost)
- [ ] Network error handling
- [ ] Permission errors (if RLS implemented)

---

### 6. Navigation and UI Interactions

- [ ] Navigate from list to detail (click row)
- [ ] Navigate between tabs (General, Line Items, Attachments)
- [ ] Return to list via back button
- [ ] Breadcrumb navigation (if exists)
- [ ] Modal open/close (new form, edit form)
- [ ] Toast notifications (success, error)

---

### 7. Approval Workflow

- [ ] Submit draft for approval
- [ ] Approve pending CO
- [ ] Reject pending CO with reason
- [ ] Verify rejection reason is saved
- [ ] Verify approver information (user_id, timestamp)
- [ ] Verify contract value updates on approval

---

### 8. Data Integrity

- [ ] Verify CO persists after creation
- [ ] Verify status changes persist
- [ ] Verify line items persist
- [ ] Verify calculated totals match database
- [ ] Verify timestamps are accurate
- [ ] Verify foreign key relationships (project_id, contract_id)

---

## Selectors Reference

Use these selectors for Playwright tests:

\`\`\`typescript
// List page
const pageTitle = page.getByRole('heading', { name: 'Change Orders', level: 1 });
const newButton = page.getByRole('button', { name: /new change order/i });
const searchInput = page.getByRole('textbox', { name: /search/i });
const draftTab = page.getByRole('tab', { name: /draft/i });
const changeOrderRow = page.getByRole('row').filter({ hasText: 'CO-123' });

// New/Edit form
const coNumberInput = page.locator('#co-number, input[name="co_number"]');
const titleInput = page.locator('#title, input[name="title"]');
const descriptionInput = page.locator('#description, textarea[name="description"]');
const amountInput = page.locator('#amount, input[name="amount"]');
const submitButton = page.getByRole('button', { name: /save|create/i });
const cancelButton = page.getByRole('button', { name: /cancel/i });

// Detail page
const editButton = page.getByRole('button', { name: /edit/i });
const submitForReviewButton = page.getByRole('button', { name: /submit/i });
const approveButton = page.getByRole('button', { name: /approve/i });
const rejectButton = page.getByRole('button', { name: /reject/i });
const executeButton = page.getByRole('button', { name: /execute/i });

// Line items
const lineItemsTab = page.getByRole('tab', { name: /line items/i });
const addLineItemButton = page.getByRole('button', { name: /add line item/i });
const lineItemRow = page.getByRole('row').filter({ hasText: 'Concrete Work' });
const deleteLineItemButton = lineItemRow.getByRole('button', { name: /delete/i });
\`\`\`

---

## Expected Behaviors

### Status Transitions

| From | To | Action | Conditions |
|------|-----|--------|-----------|
| draft | pending | Submit | None |
| pending | approved | Approve | None |
| pending | rejected | Reject | Requires reason |
| approved | executed | Execute | Irreversible |

### Read-Only States

- **Executed COs:** Cannot be edited or deleted
- **Approved COs:** Line items are read-only
- **Pending COs:** Cannot be edited (only approved/rejected)

### Calculated Fields

- **CO Total:** Sum of all line item costs
- **Line Item Cost:** quantity × unit_cost
- **Contract Value:** Original value + sum of approved CO amounts

---

## Cleanup Strategy

All tests must clean up test data:

\`\`\`typescript
test.beforeEach(async () => {
  await deleteTestChangeOrders(TEST_PROJECT_ID);
});

test.afterAll(async () => {
  await deleteTestChangeOrders(TEST_PROJECT_ID);
});
\`\`\`

Test data should use prefix: \`CO-E2E-\`

---

## Success Criteria

A test is considered successful when:

1. ✓ Action completes without errors
2. ✓ Success toast/feedback appears
3. ✓ UI updates to reflect changes
4. ✓ Data persists in database
5. ✓ Calculated fields are accurate
6. ✓ Status transitions follow rules
7. ✓ Cleanup removes all test data

---

## References

- **Test File:** \`frontend/tests/e2e/change-orders/change-orders-comprehensive.spec.ts\`
- **Screenshots:** \`output/playwright/change-orders/\`
- **Exploration Report:** \`exploration-report.json\`
`;
}

main().catch(console.error);
