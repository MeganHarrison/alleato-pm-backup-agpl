# Commitments Feature - Form Discovery

> Generated: 2026-03-22
> Project ID for testing: 760
> Test credentials: test1@mail.com / test12026!!!

---

## Form: create_subcontract

**Title:** Create Subcontract
**URL Path:** /760/commitments/new?type=subcontract
**How to Open:** From /760/commitments, click "Create Commitment" dropdown > "Subcontract"

### Fields
| Field | Type | Required | Test Value |
|-------|------|----------|------------|
| title | text input | Yes | "Test Subcontract - Electrical" |
| contractNumber | text input | Yes (auto-generated) | "SC-TEST-001" |
| contractCompanyId | combobox (vendor search popover) | Yes | Select first available vendor |
| status | select dropdown | Yes (default: "Draft") | "Draft" |
| executed | checkbox | No (default: false) | false |
| defaultRetainagePercent | number input | No | 10 |
| accountingMethod | select dropdown | No (default: "amount_based") | "amount_based" |
| description | textarea | No | "Test subcontract description" |
| inclusions | textarea | No | "All electrical work" |
| exclusions | textarea | No | "Fire alarm systems" |
| dates.startDate | date picker | No | "2026-04-01" |
| dates.estimatedCompletionDate | date picker | No | "2026-12-31" |
| dates.actualCompletionDate | date picker | No | "" |
| dates.contractDate | date picker | No | "2026-03-22" |
| dates.signedContractReceivedDate | date picker | No | "" |
| dates.issuedOnDate | date picker | No | "" |
| privacy.isPrivate | checkbox | No (default: true) | true |
| privacy.nonAdminUserIds | multi-select | No | [] |
| privacy.allowNonAdminViewSovItems | checkbox | No (default: false) | false |
| invoiceContactIds | multi-select | No (appears after vendor selected) | [] |
| attachments | file upload | No | (skip) |
| sov (line items) | inline table rows | No | Add 1 line: description="Rough-in", amount=50000 |

**SOV Line Item Sub-fields (per row):**
| Field | Type | Required | Test Value |
|-------|------|----------|------------|
| lineNumber | number | No (auto) | 1 |
| budgetCode | budget code selector | No | Select first available |
| description | text input | No | "Rough-in electrical" |
| amount | number input | No | 50000 |
| quantity | number input | No (unit_quantity mode only) | - |
| unitCost | number input | No (unit_quantity mode only) | - |
| unitOfMeasure | select | No (unit_quantity mode only) | - |

### Submit Action
"Create Subcontract" button (at bottom of form)

### Success Criteria
- [ ] Redirects to /760/commitments
- [ ] Toast success message appears
- [ ] New subcontract appears in commitments list
- [ ] Commitment has correct title, status, vendor, and contract number

### Cleanup
Yes - delete via the commitments list page row action or detail page delete button

---

## Form: create_purchase_order

**Title:** Create Purchase Order
**URL Path:** /760/commitments/new?type=purchase_order
**How to Open:** From /760/commitments, click "Create Commitment" dropdown > "Purchase Order"

### Fields
| Field | Type | Required | Test Value |
|-------|------|----------|------------|
| contractNumber | text input (RHFTextField) | Yes | "PO-TEST-001" |
| title | text input | No | "Test Purchase Order - Materials" |
| contractCompanyId | combobox (RHFComboboxField) | No | Select first available vendor |
| status | select (RHFSelectField) | Yes (default: "Draft") | "Draft" |
| executed | checkbox (RHFCheckboxField) | No (default: false) | false |
| defaultRetainagePercent | number input | No | 0 |
| accountingMethod | select | No (default: "unit-quantity") | "unit-quantity" |
| assignedTo | text/select | No | "" |
| description | textarea | No | "Test PO description" |
| billTo | rich text (RichTextField) | No | "123 Main St" |
| shipTo | rich text (RichTextField) | No | "456 Site Rd" |
| shipVia | text | No | "FedEx" |
| paymentTerms | text | No | "Net 30" |
| dates.contractDate | date picker | No | "2026-03-22" |
| dates.deliveryDate | date picker | No | "2026-05-01" |
| dates.signedPoReceivedDate | date picker | No | "" |
| dates.issuedOnDate | date picker | No | "" |
| privacy.isPrivate | checkbox | No (default: true) | true |
| privacy.allowNonAdminViewSovItems | checkbox | No (default: false) | false |
| invoiceContactIds | multi-select | No | [] |
| sov (line items) | inline table rows | Yes (array required) | Add 1 line |

**SOV Line Item Sub-fields (per row):**
| Field | Type | Required | Test Value |
|-------|------|----------|------------|
| lineNumber | number | Yes | 1 |
| budgetCode | budget code selector | No | Select first available |
| description | text input | No | "Concrete mix" |
| quantity | number input | No | 100 |
| uom | select (EA/LF/SF/CY/TON/HR/LS) | No | "CY" |
| unitCost | number input | No | 150 |
| amount | number | Yes | 15000 |

### Submit Action
"Create Purchase Order" button (at bottom of form)

### Success Criteria
- [ ] Redirects to /760/commitments
- [ ] Toast success message appears
- [ ] New purchase order appears in commitments list
- [ ] PO has correct contract number, status, and vendor

### Cleanup
Yes - delete via commitments list or detail page

---

## Form: edit_commitment_inline

**Title:** Edit Commitment (Inline on Detail Page)
**URL Path:** /760/commitments/{commitmentId}?edit=1
**How to Open:** From commitment detail page, click "Edit" button in tab bar actions. Or navigate directly with `?edit=1` query param.

### Fields
| Field | Type | Required | Test Value |
|-------|------|----------|------------|
| contractNumber | text input (RHFTextField) | No | Modify existing value |
| title | text input (RHFTextField) | No | "Updated Title" |
| contractCompanyId | combobox (RHFComboboxField) | No | Change vendor selection |
| status | select (RHFSelectField) | No | "Approved" |
| accountingMethod | select (RHFSelectField) | No (PO only) | "amount" |
| description | textarea (RHFTextareaField) | No | "Updated description" |
| startDate | date picker (RHFDateField) | No (subcontract only) | "2026-04-15" |
| completionDate | date picker (RHFDateField) | No | "2026-12-31" |
| executedDate | date picker (RHFDateField) | No | "2026-03-22" |
| signedReceivedDate | date picker (RHFDateField) | No | "" |

### Submit Action
"Save" button (with Save icon)

### Success Criteria
- [ ] Toast: "{type} updated successfully"
- [ ] Page refreshes with updated data
- [ ] Edit mode exits (returns to view mode)

### Cleanup
No - editing an existing record, revert if needed

---

## Form: delete_commitment_single

**Title:** Delete Commitment (Single from Detail Page)
**URL Path:** /760/commitments/{commitmentId} (detail page)
**How to Open:** Click "Delete" button in commitment detail page tab bar actions

### Fields
| Field | Type | Required | Test Value |
|-------|------|----------|------------|
| (none - confirmation dialog) | browser confirm() | Yes | Click OK |

### Submit Action
Browser native confirm() dialog - click OK

### Success Criteria
- [ ] Toast: "Commitment deleted successfully"
- [ ] Redirects to /760/commitments
- [ ] Commitment moves to recycle bin

### Cleanup
Restore from recycle bin at /760/commitments/recycle-bin

---

## Form: delete_commitment_from_list

**Title:** Delete Commitment (from List Page)
**URL Path:** /760/commitments
**How to Open:** Click row action menu > "Delete" on any commitment row

### Fields
| Field | Type | Required | Test Value |
|-------|------|----------|------------|
| (none - AlertDialog confirmation) | AlertDialog | Yes | Click "Delete Commitment" button |

### Submit Action
"Delete Commitment" button in AlertDialog

### Success Criteria
- [ ] Toast success message
- [ ] Commitment removed from list
- [ ] Commitment appears in recycle bin

### Cleanup
Restore from recycle bin

---

## Form: bulk_delete_commitments

**Title:** Bulk Delete Commitments
**URL Path:** /760/commitments
**How to Open:** Select multiple rows via checkboxes, then click bulk delete action

### Fields
| Field | Type | Required | Test Value |
|-------|------|----------|------------|
| (none - AlertDialog confirmation) | AlertDialog | Yes | Click "Delete N Commitments" |

### Submit Action
"Delete N Commitment(s)" button in AlertDialog

### Success Criteria
- [ ] Toast success message
- [ ] All selected commitments removed from list
- [ ] Commitments appear in recycle bin

### Cleanup
Restore from recycle bin

---

## Form: restore_commitment

**Title:** Restore Commitment (Recycle Bin)
**URL Path:** /760/commitments/recycle-bin
**How to Open:** Navigate to recycle bin tab, click "Restore" row action

### Fields
| Field | Type | Required | Test Value |
|-------|------|----------|------------|
| (none - direct action) | button click | N/A | Click "Restore" |

### Submit Action
"Restore" row action button

### Success Criteria
- [ ] Toast: '"{title}" restored to commitments'
- [ ] Commitment removed from recycle bin list
- [ ] Commitment reappears in main commitments list

### Cleanup
No

---

## Form: email_commitment

**Title:** Email Commitment
**URL Path:** /760/commitments/{commitmentId} (dialog)
**How to Open:** Click "Email" button in commitment detail page tab bar actions

### Fields
| Field | Type | Required | Test Value |
|-------|------|----------|------------|
| recipients | email badges (manual entry + contact quick-add) | Yes (at least 1) | "test@example.com" |
| manualEmail | text input (email) | No (used to add recipients) | "test@example.com" then click "Add" |
| subject | text input | Yes (auto-populated) | "{number} - {title}" |
| message | textarea | No | "Please review the attached commitment." |
| attachPdf | checkbox | No (default: true) | true |
| includeSovItems | checkbox (appears when attachPdf=true) | No (default: true) | true |

### Submit Action
"Send Email" button

### Success Criteria
- [ ] Toast: "Email sent successfully to N recipient(s)"
- [ ] Dialog closes

### Cleanup
No

---

## Form: export_commitment_single

**Title:** Export Single Commitment
**URL Path:** /760/commitments/{commitmentId} (dialog via ExportCommitmentDialog)
**How to Open:** Click "Export" button in commitment detail page tab bar actions

### Fields
| Field | Type | Required | Test Value |
|-------|------|----------|------------|
| format | radio group (PDF/CSV/Excel) | Yes (default: "pdf") | "pdf" |
| template | radio group (Standard/Financial/Summary) | Yes (default: "standard") | "standard" |
| includeSovItems | checkbox | No (default: true) | true |
| includeChangeOrders | checkbox | No (default: true) | true |
| includeInvoices | checkbox | No (default: false) | false |

### Submit Action
"Export" button

### Success Criteria
- [ ] Toast: "Commitment exported successfully as PDF"
- [ ] File downloads
- [ ] Dialog closes

### Cleanup
No

---

## Form: export_commitments_list

**Title:** Export Commitments List
**URL Path:** /760/commitments (dialog via ExportDialog)
**How to Open:** Triggered from commitments list page export action

### Fields
| Field | Type | Required | Test Value |
|-------|------|----------|------------|
| format | radio group (CSV/Excel/PDF) | Yes (default: "csv") | "csv" |
| template | radio group (Standard/Financial/Summary) | Yes (default: "standard", hidden for PDF) | "standard" |
| includeSOVItems | checkbox (individual PDF only) | No | false |

### Submit Action
"Export" button (or "Generate PDF" for PDF format)

### Success Criteria
- [ ] Toast: "Export downloaded successfully"
- [ ] File downloads
- [ ] Dialog closes

### Cleanup
No

---

## Form: sov_line_items_edit

**Title:** Schedule of Values Line Items (Edit)
**URL Path:** /760/commitments/{commitmentId} > SOV tab
**How to Open:** Navigate to commitment detail, click "SC SOV" or "PO SOV" tab

### Fields
| Field | Type | Required | Test Value |
|-------|------|----------|------------|
| line_number | number input (per row) | No | 1 |
| budget_code | select/combobox (per row) | No | Select from cost codes |
| description | text input (per row) | No | "Foundation work" |
| amount | number input (per row) | No | 25000 |
| billed_to_date | number input (per row) | No | 0 |

**Actions per row:**
- Add new line item (+ button)
- Delete line item (trash icon)
- Move up/down (arrow buttons)

### Submit Action
"Save Changes" button (with Save icon, appears when changes detected)

### Success Criteria
- [ ] Toast: "Line items saved successfully."
- [ ] unsavedChanges flag resets
- [ ] Line items persist on page refresh

### Cleanup
No - revert manually if needed

---

## Form: import_from_budget

**Title:** Import from Budget (SOV line items)
**URL Path:** /760/commitments/new (or detail SOV tab) - modal dialog
**How to Open:** Click "Import from Budget" button in SOV section of create form or SOV tab

### Fields
| Field | Type | Required | Test Value |
|-------|------|----------|------------|
| searchQuery | text input | No | "" (browse all) |
| selectedIds | checkboxes (multi-select table rows) | Yes (at least 1) | Select first 2 rows |

### Submit Action
"Import (N)" button

### Success Criteria
- [ ] Toast: "Added N line item(s) from budget" (new contract) or "Imported N item(s)" (existing)
- [ ] Selected budget lines appear as SOV line items
- [ ] Dialog closes

### Cleanup
No

---

## Form: advanced_settings

**Title:** Advanced Settings
**URL Path:** /760/commitments/{commitmentId} > Advanced Settings tab
**How to Open:** Navigate to commitment detail, click "Advanced Settings" tab

### Fields
| Field | Type | Required | Test Value |
|-------|------|----------|------------|
| enable_invoices | checkbox | No (default: true) | true |
| enable_comments | checkbox | No (default: true) | true |
| enable_payments | checkbox | No (default: true) | true |
| enable_completed_work_retainage | checkbox | No (default: true) | true |
| enable_stored_materials_retainage | checkbox | No (default: false) | false |
| show_cost_codes_on_pdf | checkbox | No (default: true) | true |
| allow_overbilling | checkbox | No (default: false) | false |
| enable_subcontractor_sov | checkbox | No (default: true) | true |
| enable_always_editable_sov | checkbox | No (default: false) | false |
| enable_financial_markup | checkbox | No (default: false) | false |
| show_markup_criteria_on_pdf | checkbox | No (default: false) | false |
| send_invoice_approval_notifications | checkbox | No (default: true) | true |
| send_payment_notifications | checkbox | No (default: true) | true |
| default_retainage_percent | number input | No (default: 10) | 10 |
| billing_period | select (weekly/biweekly/monthly) | No (default: "monthly") | "monthly" |

### Submit Action
"Save Settings" button

### Success Criteria
- [ ] Toast: "Settings saved successfully"
- [ ] hasChanges flag resets
- [ ] Settings persist on page refresh

### Cleanup
No - reset to defaults button available

---

## Form: configure_commitments

**Title:** Configure Commitments (Project-Level)
**URL Path:** /760/commitments/configure
**How to Open:** Navigate directly (likely linked from settings/gear icon)

### Fields
Large form with 3 tabbed sections (Contract Config, Default Distributions, Default Contract Settings). Key fields include:

**Contract Configuration:**
| Field | Type | Required | Test Value |
|-------|------|----------|------------|
| contractsPrivateByDefault | checkbox | No | true |
| enablePurchaseOrders | checkbox | No | true |
| enableSubcontracts | checkbox | No | true |
| rfqDueDaysDefault | number | No | 7 |
| numberOfChangeOrderTiers | number | No | 3 |
| allowStandardToCreateCCOs | checkbox | No | false |
| enableAlwaysEditableSov | checkbox | No | false |
| enableFieldInitiatedChangeOrders | checkbox | No | false |
| showMarkupCriteriaOnCommitments | checkbox | No | false |

**Note:** Save handler has TODO comment - API endpoint not yet implemented.

### Submit Action
"Save Configuration" button (appears in header and bottom of page)

### Success Criteria
- [ ] Toast: "Configuration saved successfully" (when API is implemented)
- [ ] Note: Currently shows success toast but API is a TODO

### Cleanup
No

---

## Form: commitment_settings

**Title:** Commitment Settings (Project-Level)
**URL Path:** /760/commitments/settings
**How to Open:** Navigate directly

### Fields
Organized in tabs (General, Distribution, Defaults, Billing):

**General:**
| Field | Type | Required | Test Value |
|-------|------|----------|------------|
| defaultAccountingMethod | select | No | "amount" |
| autoNumberSubcontracts | checkbox | No | true |
| subcontractPrefix | text input | No | "SC-" |
| autoNumberPurchaseOrders | checkbox | No | true |
| purchaseOrderPrefix | text input | No | "PO-" |

**Distribution:**
| Field | Type | Required | Test Value |
|-------|------|----------|------------|
| requireApproval | checkbox | No | false |
| approvalThreshold | number | No | 50000 |
| notifyOnStatusChange | checkbox | No | true |

**Defaults:**
| Field | Type | Required | Test Value |
|-------|------|----------|------------|
| defaultRetainagePercent | number | No | 10 |
| defaultStatus | select | No | "Draft" |
| defaultPrivacy | checkbox | No | true |

**Billing:**
| Field | Type | Required | Test Value |
|-------|------|----------|------------|
| requireInvoiceApproval | checkbox | No | true |
| billingPeriod | select | No | "monthly" |
| retainageReleaseThreshold | number | No | 50 |

**Note:** Save handler has comment - "Settings persistence will be added when the database table is created."

### Submit Action
"Save Settings" button

### Success Criteria
- [ ] Toast: "Settings saved" (when DB table exists)
- [ ] Note: Currently a stub - no backend persistence

### Cleanup
No

---

## Form: create_budget_code_inline

**Title:** Create Budget Code (Inline Modal)
**URL Path:** Appears as modal within create subcontract/PO forms
**How to Open:** Click "+ Create Budget Code" button in the SOV budget code selector

### Fields
| Field | Type | Required | Test Value |
|-------|------|----------|------------|
| costCodeId | select (grouped by division, expandable) | Yes | Select first active cost code |
| costType | select (R/E/X/L/M/S) | Yes (default: "S" for subcontract, "X" for PO) | "S" |

### Submit Action
"Create" button in modal footer

### Success Criteria
- [ ] Toast: "Budget code created and added to form"
- [ ] New budget code appears in budget code selector
- [ ] Auto-assigned to first empty SOV line or new line created
- [ ] Modal closes

### Cleanup
No - budget code persists in project

---

# Summary

| # | Form ID | Location | Type |
|---|---------|----------|------|
| 1 | create_subcontract | /760/commitments/new?type=subcontract | Full page form |
| 2 | create_purchase_order | /760/commitments/new?type=purchase_order | Full page form |
| 3 | edit_commitment_inline | /760/commitments/{id}?edit=1 | Inline form (detail page) |
| 4 | delete_commitment_single | /760/commitments/{id} | Confirm dialog (browser native) |
| 5 | delete_commitment_from_list | /760/commitments | AlertDialog |
| 6 | bulk_delete_commitments | /760/commitments | AlertDialog |
| 7 | restore_commitment | /760/commitments/recycle-bin | Direct action |
| 8 | email_commitment | /760/commitments/{id} | Dialog |
| 9 | export_commitment_single | /760/commitments/{id} | Dialog |
| 10 | export_commitments_list | /760/commitments | Dialog |
| 11 | sov_line_items_edit | /760/commitments/{id} > SOV tab | Inline editable table |
| 12 | import_from_budget | Modal within create form or SOV tab | Dialog with table |
| 13 | advanced_settings | /760/commitments/{id} > Advanced Settings tab | Settings form |
| 14 | configure_commitments | /760/commitments/configure | Full page form (API TODO) |
| 15 | commitment_settings | /760/commitments/settings | Full page form (DB TODO) |
| 16 | create_budget_code_inline | Modal within create forms | Dialog |

**Key Source Files:**
- Create subcontract form: `frontend/src/components/domain/contracts/CreateSubcontractForm.tsx`
- Create PO form: `frontend/src/components/domain/contracts/CreatePurchaseOrderForm.tsx`
- New commitment page: `frontend/src/app/(main)/[projectId]/commitments/new/page.tsx`
- Commitment detail page (edit/delete): `frontend/src/app/(main)/[projectId]/commitments/[commitmentId]/page.tsx`
- Commitments list page (delete/bulk): `frontend/src/app/(main)/[projectId]/commitments/page.tsx`
- Email dialog: `frontend/src/components/commitments/EmailCommitmentDialog.tsx`
- Export commitment dialog: `frontend/src/components/commitments/ExportCommitmentDialog.tsx`
- Export list dialog: `frontend/src/components/commitments/ExportDialog.tsx`
- SOV tab: `frontend/src/components/commitments/tabs/ScheduleOfValuesTab.tsx`
- Advanced settings tab: `frontend/src/components/commitments/tabs/AdvancedSettingsTab.tsx`
- Import from budget modal: `frontend/src/components/domain/contracts/ImportFromBudgetModal.tsx`
- Configure page: `frontend/src/app/(main)/[projectId]/commitments/configure/page.tsx`
- Settings page: `frontend/src/app/(main)/[projectId]/commitments/settings/page.tsx`
- Recycle bin: `frontend/src/app/(main)/[projectId]/commitments/recycle-bin/page.tsx`
- Subcontract schema: `frontend/src/lib/schemas/create-subcontract-schema.ts`
- PO schema: `frontend/src/lib/schemas/create-purchase-order-schema.ts`

**API Endpoints (POST/PUT/PATCH/DELETE):**
- `POST /api/projects/{projectId}/subcontracts` - Create subcontract
- `POST /api/projects/{projectId}/purchase-orders` - Create purchase order
- `PUT /api/commitments/{id}` - Update commitment
- `DELETE /api/commitments/{id}` - Soft delete commitment
- `DELETE /api/commitments/{id}/permanent-delete` - Permanent delete
- `POST /api/commitments/{id}/restore` - Restore from recycle bin
- `POST /api/commitments/{id}/email` - Email commitment
- `POST /api/commitments/{id}/export` - Export single commitment
- `POST /api/projects/{projectId}/commitments/export` - Export commitments list
- `PUT /api/projects/{projectId}/commitments/{commitmentId}/line-items` - Save SOV line items
- `POST /api/projects/{projectId}/commitments/{commitmentId}/line-items/import` - Import from budget
- `PUT /api/commitments/{id}/advanced-settings` - Save advanced settings
- `POST /api/commitments/{id}/change-orders` - Create change order
- `PUT /api/commitments/{id}/change-orders/{changeOrderId}` - Update change order
- `DELETE /api/commitments/{id}/change-orders/{changeOrderId}` - Delete change order
- `POST /api/commitments/{id}/change-orders/{changeOrderId}/approve` - Approve change order
- `POST /api/commitments/{id}/invoices` - Create invoice
- `POST /api/commitments/{id}/attachments` - Upload attachment
- `DELETE /api/commitments/{id}/attachments/{attachmentId}` - Delete attachment
