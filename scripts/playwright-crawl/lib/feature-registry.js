/**
 * feature-registry.js
 * Maps feature names to Procore URLs and the page states to capture.
 *
 * URL format: webclients (new, current)
 * https://us02.procore.com/webclients/host/companies/{COMPANY}/projects/{PROJECT}/tools/{tool}
 */

const COMPANY = '562949953443325';
const PROJECT = '562949954728542';
const BASE = `https://us02.procore.com/webclients/host/companies/${COMPANY}/projects/${PROJECT}/tools`;

/**
 * State types:
 *   list        - navigate directly to url, capture as-is
 *   create-form - click selector to open create form, capture the form
 *   detail      - click selector to open detail/show page
 *   detail-tab  - within detail, click a tab selector
 *   modal       - click selector to open a modal
 */

export const FEATURES = {
  'change-orders': {
    name: 'Change Orders',
    states: [
      {
        id: 'list',
        type: 'list',
        url: `https://us02.procore.com/${PROJECT}/project/change_orders/list`,
        waitFor: '.ag-root, table, [class*="change-order"], .sortable.item_list',
        description: 'Change Orders list view',
      },
      {
        id: 'create-form',
        type: 'create-form',
        url: `https://us02.procore.com/${PROJECT}/project/change_orders/list`,
        selector: 'button:has-text("Create"), [data-cy*="create"], a:has-text("Create")',
        waitFor: 'form, [role="dialog"], [class*="modal"]',
        description: 'Change Orders create flow',
      },
      {
        id: 'detail',
        type: 'detail',
        url: `https://us02.procore.com/${PROJECT}/project/change_orders/list`,
        selector: '.ag-row:first-child, tr[class*="row"]:first-child a, .item_list tbody tr:first-child a',
        waitFor: '[class*="detail"], [class*="show"], form, .ag-root, table',
        description: 'Change Orders detail page',
      },
    ],
  },

  'change-events': {
    name: 'Change Events',
    states: [
      {
        id: 'list',
        type: 'list',
        url: `${BASE}/change-events/events`,
        waitFor: '.ag-root, table, [class*="change-event"]',
        description: 'Change Events list view',
      },
      {
        id: 'create-form',
        type: 'create-form',
        url: `${BASE}/change-events/events`,
        selector: 'button[data-cy="create-change-event-button"], button:has-text("Create Change Event"), [data-action*="new"], button:has-text("New")',
        waitFor: 'form, [role="dialog"], [class*="modal"]',
        description: 'Create Change Event form/modal',
      },
      {
        id: 'detail',
        type: 'detail',
        url: `${BASE}/change-events/events`,
        selector: '.ag-row:first-child, tr[class*="row"]:first-child a, [class*="event-title"] a',
        waitFor: '[class*="detail"], [class*="show"], form',
        description: 'Change Event detail / show page',
      },
      // Note: Change Events detail uses toolbar-style navigation, not role="tab".
      // The "Line Items" table is the default view. "Prime Contract COs" is via "Add to" dropdown.
      // Tabs captured from default detail view — no separate tab-click needed.
      {
        id: 'detail-add-to-dropdown',
        type: 'detail-tab',
        parentStateId: 'detail',
        selector: 'button:has-text("Add to"), [aria-label*="Add to"]',
        waitFor: '[role="menu"], [class*="dropdown"]',
        description: 'Change Event detail — "Add to" dropdown (Prime Contract COs, Budget)',
      },
      {
        id: 'detail-send-rfqs',
        type: 'detail-tab',
        parentStateId: 'detail',
        selector: 'button:has-text("Send Requests for Quote"), button:has-text("RFQ")',
        waitFor: '[role="dialog"], form',
        description: 'Change Event detail — Send Requests for Quote modal',
      },
    ],
  },

  'prime-contracts': {
    name: 'Prime Contracts',
    states: [
      {
        id: 'list',
        type: 'list',
        url: `${BASE}/contracts/prime_contracts`,
        waitFor: '.ag-root, table, [class*="prime-contract"]',
        description: 'Prime Contracts list view',
      },
      {
        id: 'create-form',
        type: 'create-form',
        url: `${BASE}/contracts/prime_contracts`,
        selector: 'button:has-text("Create Prime Contract"), button:has-text("New Prime Contract"), [data-cy*="create"]',
        waitFor: 'form, [role="dialog"]',
        description: 'Create Prime Contract form',
      },
      {
        id: 'detail',
        type: 'detail',
        url: `${BASE}/contracts/prime_contracts`,
        selector: '.ag-row:first-child, tr[class*="row"]:first-child a, [class*="contract-title"] a',
        waitFor: '[class*="detail"], [class*="contract"]',
        description: 'Prime Contract detail page',
      },
      {
        id: 'detail-schedule-of-values',
        type: 'detail-tab',
        parentStateId: 'detail',
        selector: 'a:has-text("Schedule of Values"), button:has-text("Schedule of Values")',
        waitFor: '.ag-root, table',
        description: 'Prime Contract — Schedule of Values tab',
      },
      {
        id: 'detail-change-orders',
        type: 'detail-tab',
        parentStateId: 'detail',
        selector: 'a:has-text("Change Orders"), button:has-text("Change Orders")',
        waitFor: '.ag-root, table, [class*="empty"]',
        description: 'Prime Contract — Change Orders tab',
      },
      {
        id: 'detail-payments',
        type: 'detail-tab',
        parentStateId: 'detail',
        selector: 'a:has-text("Payments"), button:has-text("Payments")',
        waitFor: '.ag-root, table, [class*="empty"]',
        description: 'Prime Contract — Payments tab',
      },
    ],
  },

  'commitments': {
    name: 'Commitments',
    states: [
      {
        id: 'list-purchase-orders',
        type: 'list',
        url: `${BASE}/contracts/commitments/purchase_order_contracts`,
        waitFor: '.ag-root, table, [class*="commitment"]',
        description: 'Purchase Orders (Subcontracts) list view',
      },
      {
        id: 'list-purchase-order-change-orders',
        type: 'list',
        url: `${BASE}/contracts/commitments/purchase_order_change_orders`,
        waitFor: '.ag-root, table',
        description: 'Purchase Order Change Orders list view',
      },
      {
        id: 'create-form',
        type: 'create-form',
        url: `${BASE}/contracts/commitments/purchase_order_contracts`,
        selector: 'button:has-text("Create Subcontract"), button:has-text("Create Purchase Order"), [data-cy*="create"]',
        waitFor: 'form, [role="dialog"]',
        description: 'Create Commitment form',
      },
      {
        id: 'detail',
        type: 'detail',
        url: `${BASE}/contracts/commitments/purchase_order_contracts`,
        selector: '.ag-row:first-child, tr[class*="row"]:first-child a',
        waitFor: '[class*="detail"]',
        description: 'Commitment detail page',
      },
      {
        id: 'detail-schedule-of-values',
        type: 'detail-tab',
        parentStateId: 'detail',
        selector: 'a:has-text("Schedule of Values"), button:has-text("Schedule of Values")',
        waitFor: '.ag-root, table',
        description: 'Commitment — Schedule of Values tab',
      },
    ],
  },

  'budget': {
    name: 'Budget',
    states: [
      {
        id: 'list',
        type: 'list',
        url: `https://us02.procore.com/${PROJECT}/project/budgeting`,
        waitFor: '.ag-root, table, [class*="budget"]',
        description: 'Budget main view',
      },
      {
        id: 'create-form',
        type: 'create-form',
        url: `https://us02.procore.com/${PROJECT}/project/budgeting`,
        selector: 'button:has-text("Edit Budget"), button:has-text("Create"), [data-cy*="create"]',
        waitFor: 'form, [role="dialog"], .ag-root',
        description: 'Budget edit / create form',
      },
    ],
  },

  'direct-costs': {
    name: 'Direct Costs',
    states: [
      {
        id: 'list',
        type: 'list',
        url: `https://us02.procore.com/${PROJECT}/project/direct_costs`,
        waitFor: '.ag-root, table, [class*="direct"]',
        description: 'Direct Costs list view',
      },
      {
        id: 'create-form',
        type: 'create-form',
        url: `https://us02.procore.com/${PROJECT}/project/direct_costs`,
        selector: 'button:has-text("Create Direct Cost"), [data-cy*="create"]',
        waitFor: 'form, [role="dialog"]',
        description: 'Create Direct Cost form',
      },
      {
        id: 'detail',
        type: 'detail',
        url: `https://us02.procore.com/${PROJECT}/project/direct_costs`,
        selector: '.ag-row:first-child, tr[class*="row"]:first-child a',
        waitFor: '[class*="detail"]',
        description: 'Direct Cost detail page',
      },
    ],
  },

  'invoicing': {
    name: 'Invoicing',
    states: [
      {
        id: 'list-owner',
        type: 'list',
        url: `https://us02.procore.com/webclients/host/companies/562949953443325/projects/562949955214671/tools/invoicing`,
        waitFor: '.ag-root, table',
        description: 'Invoicing — Owner Invoices list',
      },
      {
        id: 'list-subcontractor',
        type: 'list',
        url: `https://us02.procore.com/webclients/host/companies/562949953443325/projects/562949955214671/tools/invoicing/subcontractor`,
        waitFor: '.ag-root, table',
        description: 'Invoicing — Subcontractor Invoices list',
      },
      {
        id: 'po-invoices-list',
        type: 'list',
        url: `https://us02.procore.com/webclients/host/companies/562949953443325/projects/562949955214671/tools/contracts/commitments/purchase_order_contracts/562949959141576/invoices`,
        waitFor: '.ag-root, table, [class*="invoice"]',
        description: 'Invoices tab under a specific Purchase Order Contract',
      },
      {
        id: 'create-form',
        type: 'create-form',
        url: `https://us02.procore.com/webclients/host/companies/562949953443325/projects/562949955214671/tools/invoicing`,
        selector: 'button:has-text("Create Invoice"), [data-cy*="create"]',
        waitFor: 'form, [role="dialog"]',
        description: 'Create Invoice form',
      },
      {
        id: 'invoice-detail-summary',
        type: 'list',
        url: `https://us02.procore.com/562949954777244/project/commitments/work_order_contracts/562949957416376/requisitions/562949957903990/summary`,
        waitFor: 'body',
        description: 'Subcontractor Invoice detail — Summary tab',
      },
      {
        id: 'invoice-detail-detail',
        type: 'list',
        url: `https://us02.procore.com/562949954777244/project/commitments/work_order_contracts/562949957416376/requisitions/562949957903990/g703`,
        waitFor: 'body',
        description: 'Subcontractor Invoice detail — Detail (G703) tab',
      },
      {
        id: 'invoice-detail-related',
        type: 'list',
        url: `https://us02.procore.com/562949954777244/project/commitments/work_order_contracts/562949957416376/requisitions/562949957903990/related_items`,
        waitFor: 'body',
        description: 'Subcontractor Invoice detail — Related Items tab',
      },
      {
        id: 'invoice-detail-emails',
        type: 'list',
        url: `https://us02.procore.com/562949954777244/project/commitments/work_order_contracts/562949957416376/requisitions/562949957903990/emails`,
        waitFor: 'body',
        description: 'Subcontractor Invoice detail — Emails tab',
      },
      {
        id: 'invoice-detail-history',
        type: 'list',
        url: `https://us02.procore.com/562949954777244/project/commitments/work_order_contracts/562949957416376/requisitions/562949957903990/change_history`,
        waitFor: 'body',
        description: 'Subcontractor Invoice detail — Change History tab',
      },
    ],
  },

  'meetings': {
    name: 'Meetings',
    states: [
      {
        id: 'list',
        type: 'list',
        url: `${BASE}/meetings/list`,
        waitFor: '.ag-root, table',
        description: 'Meetings list view',
      },
      {
        id: 'create-form',
        type: 'create-form',
        url: `${BASE}/meetings/list`,
        selector: 'button:has-text("Create Meeting"), [data-cy*="create"]',
        waitFor: 'form, [role="dialog"]',
        description: 'Create Meeting form',
      },
      {
        id: 'detail',
        type: 'detail',
        url: `${BASE}/meetings/list`,
        selector: '.ag-row:first-child, tr[class*="row"]:first-child a',
        waitFor: '[class*="detail"], [class*="meeting"]',
        description: 'Meeting detail / minutes page',
      },
    ],
  },

  'rfis': {
    name: 'RFIs',
    states: [
      {
        id: 'list',
        type: 'list',
        url: `${BASE}/rfis`,
        waitFor: '.ag-root, table',
        description: 'RFIs list view',
      },
      {
        id: 'create-form',
        type: 'create-form',
        url: `${BASE}/rfis`,
        selector: 'button:has-text("Create RFI"), [data-cy*="create"]',
        waitFor: 'form, [role="dialog"]',
        description: 'Create RFI form',
      },
      {
        id: 'detail',
        type: 'detail',
        url: `${BASE}/rfis`,
        selector: '.ag-row:first-child, tr[class*="row"]:first-child a',
        waitFor: '[class*="detail"]',
        description: 'RFI detail page',
      },
    ],
  },

  'drawings': {
    name: 'Drawings',
    states: [
      {
        id: 'list',
        type: 'list',
        url: `${BASE}/drawings`,
        waitFor: '[class*="drawing"], .ag-root, table',
        description: 'Drawings list view',
      },
    ],
  },

  'specifications': {
    name: 'Specifications',
    states: [
      {
        id: 'list',
        type: 'list',
        url: `${BASE}/specifications`,
        waitFor: '.ag-root, table',
        description: 'Specifications list view',
      },
    ],
  },

  'punch-list': {
    name: 'Punch List',
    states: [
      {
        id: 'list',
        type: 'list',
        url: `${BASE}/punchlist`,
        waitFor: '.ag-root, table',
        description: 'Punch List view',
      },
      {
        id: 'create-form',
        type: 'create-form',
        url: `${BASE}/punchlist`,
        selector: 'button:has-text("Create Punch Item"), [data-cy*="create"]',
        waitFor: 'form, [role="dialog"]',
        description: 'Create Punch List item form',
      },
    ],
  },
  'submittals': {
    name: 'Submittals',
    states: [
      {
        id: 'list',
        type: 'list',
        url: `${BASE}/submittals`,
        waitFor: '.ag-root, table, [class*="submittal"]',
        description: 'Submittals list view',
      },
      {
        id: 'create-form',
        type: 'create-form',
        url: `${BASE}/submittals`,
        selector: 'button:has-text("Create Submittal"), button:has-text("New Submittal"), [data-cy*="create"]',
        waitFor: 'form, [role="dialog"]',
        description: 'Create Submittal form',
      },
      {
        id: 'detail',
        type: 'detail',
        url: `${BASE}/submittals`,
        selector: '.ag-row:first-child, tr[class*="row"]:first-child a',
        waitFor: '[class*="detail"], [class*="submittal"]',
        description: 'Submittal detail page',
      },
    ],
  },

  'photos': {
    name: 'Photos',
    states: [
      {
        id: 'list',
        type: 'list',
        url: `${BASE}/photos/timeline`,
        waitFor: '[class*="photo"], [class*="image"], [class*="timeline"], .ag-root',
        description: 'Photos timeline view',
      },
      {
        id: 'upload-form',
        type: 'create-form',
        url: `${BASE}/photos/timeline`,
        selector: 'button:has-text("Upload"), button:has-text("Add Photos"), [data-cy*="upload"]',
        waitFor: 'form, [role="dialog"], input[type="file"]',
        description: 'Upload Photos form',
      },
    ],
  },

  'daily-log': {
    name: 'Daily Log',
    states: [
      {
        id: 'list',
        type: 'list',
        url: `https://us02.procore.com/${PROJECT}/project/daily_log`,
        waitFor: '.ag-root, table, [class*="daily"], [class*="log"]',
        description: 'Daily Log list view',
      },
      {
        id: 'detail',
        type: 'detail',
        url: `https://us02.procore.com/${PROJECT}/project/daily_log`,
        selector: '.ag-row:first-child, tr[class*="row"]:first-child a, [class*="log-entry"]:first-child',
        waitFor: '[class*="detail"], [class*="daily"], form',
        description: 'Daily Log entry detail',
      },
    ],
  },

  'directory': {
    name: 'Directory',
    states: [
      {
        id: 'list',
        type: 'list',
        url: `${BASE}/directory/users`,
        waitFor: '.ag-root, table, [class*="directory"], [class*="user"]',
        description: 'Directory list view',
      },
      {
        id: 'create-form',
        type: 'create-form',
        url: `${BASE}/directory/users`,
        selector: 'button:has-text("Add Person"), button:has-text("Create"), button:has-text("Invite"), [data-cy*="create"]',
        waitFor: 'form, [role="dialog"]',
        description: 'Add Person/Company form',
      },
    ],
  },

  'documents': {
    name: 'Documents',
    states: [
      {
        id: 'list',
        type: 'list',
        url: `${BASE}/documents`,
        waitFor: '.ag-root, table, [class*="document"]',
        description: 'Documents list view',
      },
      {
        id: 'upload-form',
        type: 'create-form',
        url: `${BASE}/documents`,
        selector: 'button:has-text("Upload"), button:has-text("New Folder"), [data-cy*="upload"]',
        waitFor: 'form, [role="dialog"], input[type="file"]',
        description: 'Upload Document form',
      },
    ],
  },

};

export function getFeature(name) {
  if (!FEATURES[name]) {
    throw new Error(`Unknown feature "${name}". Available: ${Object.keys(FEATURES).join(', ')}`);
  }
  return FEATURES[name];
}
