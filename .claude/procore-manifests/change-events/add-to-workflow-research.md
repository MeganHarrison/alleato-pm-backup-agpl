# Change Events "Add To" Workflow — Procore Research

**Captured:** 2026-03-30
**Project:** Alleato Group — 26-999 MH
**URL:** `https://us02.procore.com/webclients/host/companies/562949953443325/projects/562949955214671/tools/change-events/events`

---

## Overview

The "Add to" button appears in two places:

1. **List view (bulk action):** Check one or more row checkboxes → "Add to" and "Send Requests for Quote" appear in the toolbar above the table
2. **Detail view:** On an individual change event's detail page, action buttons appear at the top

---

## "Add to" Dropdown Structure

### Entry point
- Select ≥1 change event(s) via checkbox
- "Add to" button becomes enabled in the toolbar
- Click → opens a cascading dropdown (Procore's `TieredSelect` component — renders as nested overlays)

### Top-level options
```
Add to
├── Commitment          →  (requires existing commitments on project)
├── Commitment CO       →  (requires existing commitments on project)
└── Prime Contract PCO  →  submenu (always available if prime contract exists)
```

---

## Option 1: Prime Contract PCO (3-level cascade)

**Purpose:** Create a Prime Contract Potential Change Order from the selected change event(s), linking the change event's revenue impact to the owner contract.

**When to use:** When the change affects the scope/cost of the prime contract (owner ↔ GC agreement).

### Cascade flow:

```
Add to
  └─► Prime Contract PCO  ───►  New Prime PCO  ───►  [Select Contract]
                                                          │
                                                          ▼
                                             Contracts with matching cost codes
                                             ────────────────────────────────
                                             1 - Goodwill Bart              ►
                                             ...other prime contracts...
                                                          │
                                                          ▼
                                             PCO Creation Form (see fields below)
```

### Guard condition:
The "Contracts with matching cost codes" step shows only prime contracts whose cost codes match the cost codes on the selected change event line items.

**Tooltip when no matches:** "None of the selected [change event line items] has a contract line item that matches this cost code."

### PCO Creation Form Fields:
Based on Procore documentation and the existing detail manifest:

| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| Number | text | No | Auto-generated | Can be customized |
| Date Created | date | No | Today | Auto-fills |
| Revision | number | No | 0 | Increments with each revision |
| Contract Company | select | Yes | — | Auto-populates from linked commitment |
| Contract | select | Yes | — | The prime contract this PCO is against |
| Title | text | Yes | — | Brief description |
| Status | select | No | Pending - In Review | See status options below |
| Description | rich text | No | — | Detailed description |
| Change Reason | select | No | — | Reason for the change |
| Schedule Impact | text | No | — | Impact on project schedule |
| Location | select | No | — | Location within project |
| Paid in Full | checkbox | No | false | Marks PCO as fully paid |
| Attachments | file | No | — | Supporting documents |

**Status options:** Pending - In Review, Open, Approved, Under Review, Rejected, Void, Closed

---

## Option 2: Commitment CO (Commitment Change Order)

**Purpose:** Create a change order against an existing subcontract or purchase order (commitment). Links change event cost impact to the vendor/subcontractor agreement.

**When to use:** When the change affects what a subcontractor or vendor is owed — modifying their scope, labor conditions, materials, or service durations.

### Cascade flow:
```
Add to
  └─► Commitment CO  ───►  [Select Commitment/Subcontract]
                                    │
                                    ▼
                           CCO Creation Form (see fields below)
```

### Guard condition:
Only available when the project has existing commitments (purchase orders or subcontracts). If no commitments exist, the option shows with a tooltip: "There are no Commitment [change orders] added to this project yet."

### CCO Creation Form Fields (standard Procore CCO):

| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| Number | text | No | Auto-generated | Can be customized |
| Date Created | date | No | Today | Auto-fills |
| Revision | number | No | 0 | — |
| Commitment | select | Yes | — | The subcontract/PO this CCO is against |
| Title | text | Yes | — | Brief description |
| Status | select | No | Pending | See status options |
| Description | rich text | No | — | Detailed description |
| Change Reason | select | No | — | Reason for the change |
| Attachments | file | No | — | Supporting documents |

---

## Option 3: Commitment (Add to Commitment)

**Purpose:** Add the change event's line items directly to an existing commitment — not creating a change order, but adding the change event costs directly to the commitment's line items.

**When to use:** For simple additions to an existing PO/subcontract that don't require a formal change order process.

### Guard condition:
Same as Commitment CO — requires existing commitments on the project.

---

## Send Requests for Quote (RFQ)

Also appears when rows are selected. This sends Requests for Quote to vendors/subcontractors for the selected change events.

---

## Implementation Notes for Alleato

### The `change_event_related_items` table
The "Add to" workflow creates entries linking the change event to:
- A prime contract PCO (`related_item_type = 'prime_contract_pco'`)
- A commitment change order (`related_item_type = 'commitment_co'`)
- A commitment line item (`related_item_type = 'commitment'`)

### Decision logic for which option to show:
```
if project has prime contract → show "Prime Contract PCO" option
if project has commitments (subcontracts/POs) → show "Commitment" and "Commitment CO" options
else → show disabled with tooltip explanation
```

### The cascade component
Procore uses a `TieredSelect` (multi-level cascading dropdown) component class `StyledTieredSelectOption-cntmMP`. This is NOT a standard `<select>` or `<li>` menu — it's a custom React component rendered in portals.

### Screenshots captured
- `add-to-dropdown-full.png` — The Add to dropdown open state
- `cascade-01-add-to-open.png` — Dropdown after row selection
- `cascade-02-prime-pco-hover.png` — Hovering Prime Contract PCO
- `list-add-to-03-dropdown-open.png` — Dropdown showing Prime Contract PCO option + tooltip about disabled commitments
- `list-add-to-04-prime-contract-pco-form.png` — Level 2 of cascade (New Prime PCO option visible)
- `step1-contracts-list.png` — Level 3: Contracts step (requires matching cost codes)
- `step2-before-contract-click.png` — Contract selection with tooltip showing guard condition