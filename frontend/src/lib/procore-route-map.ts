/**
 * Maps URL pathname patterns to Procore manifest feature slugs.
 * Used by the Procore Reference Panel to auto-load the right screenshots.
 */

export interface ProcoreScreenshot {
  stateId: string;
  label: string;
  src: string;
}

/** Maps a pathname to a feature slug. Returns null if no match. */
export function featureFromPathname(pathname: string): string | null {
  // Strip leading /[projectId]/ segment
  const stripped = pathname.replace(/^\/\d+\//, "/");

  if (stripped.startsWith("/budget")) return "budget";
  if (stripped.startsWith("/change-events")) return "change-events";
  if (stripped.startsWith("/change-orders")) return "change-orders";
  if (stripped.startsWith("/commitments")) return "commitments";
  if (stripped.startsWith("/daily-log")) return "daily-log";
  if (stripped.startsWith("/direct-costs")) return "direct-costs";
  if (stripped.startsWith("/directory")) return "directory";
  if (stripped.startsWith("/documents")) return "documents";
  if (stripped.startsWith("/drawings")) return "drawings";
  if (stripped.startsWith("/invoicing")) return "invoicing";
  if (stripped.startsWith("/photos")) return "photos";
  if (stripped.startsWith("/prime-contracts")) return "prime-contracts";
  if (stripped.startsWith("/punch-list")) return "punch-list";
  if (stripped.startsWith("/rfis")) return "rfis";
  if (stripped.startsWith("/specifications")) return "specifications";
  if (stripped.startsWith("/submittals")) return "submittals";
  if (stripped.startsWith("/meetings")) return "meetings";

  return null;
}

/**
 * Human-readable label for a screenshot state ID.
 * Falls back to title-casing the state ID.
 */
export function stateLabel(stateId: string): string {
  const overrides: Record<string, string> = {
    "list": "List View",
    "list-purchase-orders": "Purchase Orders List",
    "list-purchase-order-change-orders": "PO Change Orders List",
    "create-form": "Create Form",
    "detail": "Detail View",
    "detail-schedule-of-values": "Schedule of Values",
    "detail-change-orders": "Change Orders Tab",
    "detail-payments": "Payments Tab",
    "detail-add-to-dropdown": "Add To Dropdown",
    "detail-send-rfqs": "Send RFQs",
    "detail-line-items": "Line Items",
    "detail-markup": "Markup",
    "detail-prime-contract-cos": "Prime Contract COs",
    "upload-form": "Upload Form",
    "list-owner": "Owner Invoices",
    "list-subcontractor": "Subcontractor Invoices",
    "po-invoices-list": "PO Invoices",
    "budget-details": "Budget Details",
    "budget-modifications": "Budget Modifications",
    "cost-codes": "Cost Codes",
    "forecasting": "Forecasting",
    "project-status-snapshots": "Project Status Snapshots",
    "change-history": "Change History",
    "settings": "Settings",
  };
  return overrides[stateId] ?? stateId.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Maps feature slug + state ID → our app route.
 * Uses `:projectId` as a placeholder — callers should replace it with a real project ID.
 * Returns null if no route is known for that state.
 */
const APP_ROUTES: Record<string, Record<string, string>> = {
  "budget": {
    "budget-details": "/:projectId/budget",
    "budget-modifications": "/:projectId/budget?tab=modifications",
    "forecasting": "/:projectId/budget?tab=forecasting",
    "cost-codes": "/:projectId/budget?tab=cost-codes",
    "project-status-snapshots": "/:projectId/budget?tab=snapshots",
    "change-history": "/:projectId/budget?tab=history",
    "settings": "/:projectId/budget?tab=settings",
    "list": "/:projectId/budget",
  },
  "change-events": {
    "list": "/:projectId/change-events",
    "create-form": "/:projectId/change-events/new",
    "detail": "/:projectId/change-events",
    "detail-line-items": "/:projectId/change-events",
  },
  "change-orders": {
    "list": "/:projectId/change-orders",
    "list-purchase-orders": "/:projectId/change-orders?tab=purchase-orders",
    "list-purchase-order-change-orders": "/:projectId/change-orders?tab=po-change-orders",
    "create-form": "/:projectId/change-orders/new",
    "detail": "/:projectId/change-orders",
  },
  "commitments": {
    "list": "/:projectId/commitments",
    "create-form": "/:projectId/commitments/new",
    "detail": "/:projectId/commitments",
    "detail-schedule-of-values": "/:projectId/commitments",
    "detail-change-orders": "/:projectId/commitments",
    "detail-payments": "/:projectId/commitments",
  },
  "direct-costs": {
    "list": "/:projectId/direct-costs",
    "create-form": "/:projectId/direct-costs/new",
    "detail": "/:projectId/direct-costs",
  },
  "invoicing": {
    "list-owner": "/:projectId/invoices",
    "list-subcontractor": "/:projectId/invoices?tab=subcontractor",
    "po-invoices-list": "/:projectId/invoices?tab=subcontractor",
    "create-form": "/:projectId/invoices/new?tab=owner",
    "upload-form": "/:projectId/invoicing/upload",
  },
  "prime-contracts": {
    "list": "/:projectId/prime-contracts",
    "create-form": "/:projectId/prime-contracts/new",
    "detail": "/:projectId/prime-contracts",
    "detail-schedule-of-values": "/:projectId/prime-contracts",
    "detail-change-orders": "/:projectId/prime-contracts",
    "detail-payments": "/:projectId/prime-contracts",
  },
  "rfis": {
    "list": "/:projectId/rfis",
    "create-form": "/:projectId/rfis/new",
    "detail": "/:projectId/rfis",
  },
  "submittals": {
    "list": "/:projectId/submittals",
    "create-form": "/:projectId/submittals/new",
    "detail": "/:projectId/submittals",
  },
  "directory": {
    "list": "/directory/companies",
    "create-form": "/directory/companies",
  },
  "daily-log": {
    "list": "/:projectId/daily-log",
    "create-form": "/:projectId/daily-log/new",
  },
  "meetings": {
    "list": "/:projectId/meetings",
    "create-form": "/:projectId/meetings/new",
    "detail": "/:projectId/meetings",
  },
};

export function appRouteForState(feature: string, stateId: string, projectId?: number | null): string | null {
  const featureRoutes = APP_ROUTES[feature];
  if (!featureRoutes) return null;
  const route = featureRoutes[stateId];
  if (!route) return null;
  if (projectId) return route.replace(":projectId", String(projectId));
  return route; // caller can display as-is (no projectId substituted)
}

/** Builds screenshot URLs for a feature from its manifest state IDs. */
export function screenshotsForFeature(feature: string, stateIds: string[]): ProcoreScreenshot[] {
  return stateIds.map((stateId) => ({
    stateId,
    label: stateLabel(stateId),
    src: `/api/procore-screenshots/${feature}/${stateId}.png`,
  }));
}
