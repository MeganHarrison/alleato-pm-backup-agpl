/**
 * modal-configs.js
 * Per-tool list of pages to visit. The crawler auto-discovers clickable
 * triggers on each page; we only need to enumerate the URLs.
 *
 * Each page config can optionally provide:
 *   - triggerCap (default 60): max candidates to try per page
 */

const COMPANY = '562949953443325';
const PROJECT = '562949954728542';
const PROJECT_ALT = '562949955214671'; // used by invoicing
const BASE = `https://us02.procore.com/webclients/host/companies/${COMPANY}/projects/${PROJECT}/tools`;

export const MODAL_CONFIGS = {
  budget: {
    pages: [
      {
        id: 'budget-list',
        url: `https://us02.procore.com/${PROJECT}/project/budgeting`,
        triggerCap: 80,
      },
      {
        id: 'budget-details',
        url: `https://us02.procore.com/${PROJECT}/project/budgeting/detail_report`,
        triggerCap: 60,
      },
      {
        id: 'budget-modifications',
        url: `https://us02.procore.com/${PROJECT}/project/budgeting/modifications`,
        triggerCap: 40,
      },
      {
        id: 'cost-codes',
        url: `https://us02.procore.com/${PROJECT}/project/budgeting/cost_codes`,
        triggerCap: 40,
      },
      {
        id: 'forecasting',
        url: `https://us02.procore.com/${PROJECT}/project/budgeting/forecasting`,
        triggerCap: 50,
      },
      {
        id: 'project-status-snapshots',
        url: `https://us02.procore.com/${PROJECT}/project/budgeting/snapshots`,
        triggerCap: 30,
      },
      {
        id: 'change-history',
        url: `https://us02.procore.com/${PROJECT}/project/budgeting/change_history`,
        triggerCap: 30,
      },
      {
        id: 'settings',
        url: `https://us02.procore.com/${PROJECT}/project/budgeting/settings`,
        triggerCap: 40,
      },
    ],
  },

  commitments: {
    pages: [
      {
        id: 'purchase-orders',
        url: `${BASE}/contracts/commitments/purchase_order_contracts`,
        triggerCap: 60,
      },
      {
        id: 'po-change-orders',
        url: `${BASE}/contracts/commitments/purchase_order_change_orders`,
        triggerCap: 60,
      },
    ],
  },

  rfis: {
    pages: [
      {
        id: 'list',
        url: `${BASE}/rfis`,
        triggerCap: 60,
      },
    ],
  },

  'change-events': {
    pages: [
      {
        id: 'events',
        url: `${BASE}/change-events/events`,
        triggerCap: 60,
      },
    ],
  },

  invoicing: {
    pages: [
      {
        id: 'owner-invoices',
        url: `https://us02.procore.com/webclients/host/companies/${COMPANY}/projects/${PROJECT_ALT}/tools/invoicing`,
        triggerCap: 60,
      },
      {
        id: 'subcontractor-invoices',
        url: `https://us02.procore.com/webclients/host/companies/${COMPANY}/projects/${PROJECT_ALT}/tools/invoicing/subcontractor`,
        triggerCap: 60,
      },
    ],
  },
};

export const ALL_TOOLS = Object.keys(MODAL_CONFIGS);
