export interface SitemapRoute {
  url: string;
  title: string;
  category: string;
  type: string;
  dynamic: boolean;
  /** Derived from URL: everything except the last path segment */
  parent?: string;
  /** Set on synthetic group-header rows (not real routes) */
  _group?: string;
  /** Item count, only set on group-header rows */
  _groupCount?: number;
}

/** Derive the parent path from a URL. e.g. /[projectId]/budget → /[projectId] */
export function deriveParent(url: string): string {
  const parts = url.split("/").filter(Boolean);
  if (parts.length <= 1) return "/";
  return "/" + parts.slice(0, -1).join("/");
}

export const staticRoutes: SitemapRoute[] = [
  // Main
  { url: "/", title: "Portfolio", category: "Main", type: "dashboard", dynamic: false },
  { url: "/pipeline", title: "Pipeline", category: "Main", type: "list", dynamic: false },
  { url: "/create-project", title: "Create Project", category: "Main", type: "form", dynamic: false },
  { url: "/knowledge", title: "Knowledge Base", category: "Main", type: "list", dynamic: false },
  { url: "/updates", title: "Updates", category: "Main", type: "list", dynamic: false },

  // Project — Financial
  { url: "/[projectId]/home", title: "Project Home", category: "Project — Financial", type: "dashboard", dynamic: true },
  { url: "/[projectId]/budget", title: "Budget", category: "Project — Financial", type: "list", dynamic: true },
  { url: "/[projectId]/budget/line-item/new", title: "Create Budget Line Items", category: "Project — Financial", type: "form", dynamic: true },
  { url: "/[projectId]/prime-contracts", title: "Prime Contracts", category: "Project — Financial", type: "list", dynamic: true },
  { url: "/[projectId]/prime-contracts/new", title: "New Prime Contract", category: "Project — Financial", type: "form", dynamic: true },
  { url: "/[projectId]/prime-contracts/[contractId]/edit", title: "Edit Prime Contract", category: "Project — Financial", type: "form", dynamic: true },
  { url: "/[projectId]/prime-contracts/[contractId]/invoices/new", title: "New Prime Contract Invoice", category: "Project — Financial", type: "form", dynamic: true },
  { url: "/[projectId]/prime-contracts/[contractId]/change-orders/pcos/new", title: "New Prime Contract PCO", category: "Project — Financial", type: "form", dynamic: true },
  { url: "/[projectId]/prime-contracts/[contractId]/change-orders/pcos/[pcoId]/edit", title: "Edit Prime Contract PCO", category: "Project — Financial", type: "form", dynamic: true },
  { url: "/[projectId]/commitments", title: "Commitments", category: "Project — Financial", type: "list", dynamic: true },
  { url: "/[projectId]/commitments/new", title: "New Commitment", category: "Project — Financial", type: "form", dynamic: true },
  { url: "/[projectId]/commitments/[commitmentId]/edit", title: "Edit Commitment", category: "Project — Financial", type: "form", dynamic: true },
  { url: "/[projectId]/commitments/[commitmentId]/pcos/new", title: "New Commitment PCO", category: "Project — Financial", type: "form", dynamic: true },
  { url: "/[projectId]/change-events", title: "Change Events", category: "Project — Financial", type: "list", dynamic: true },
  { url: "/[projectId]/change-events/new", title: "New Change Event", category: "Project — Financial", type: "form", dynamic: true },
  { url: "/[projectId]/change-events/[changeEventId]/edit", title: "Edit Change Event", category: "Project — Financial", type: "form", dynamic: true },
  { url: "/[projectId]/change-orders", title: "Change Orders", category: "Project — Financial", type: "list", dynamic: true },
  { url: "/[projectId]/change-orders/new", title: "New Change Order", category: "Project — Financial", type: "form", dynamic: true },
  { url: "/[projectId]/change-orders/[changeOrderId]/edit", title: "Edit Change Order", category: "Project — Financial", type: "form", dynamic: true },
  { url: "/[projectId]/change-orders/commitment/new", title: "Create Commitment Change Order", category: "Project — Financial", type: "form", dynamic: true },
  { url: "/[projectId]/change-orders/prime/new", title: "Create Prime Contract Change Order", category: "Project — Financial", type: "form", dynamic: true },
  { url: "/[projectId]/direct-costs", title: "Direct Costs", category: "Project — Financial", type: "list", dynamic: true },
  { url: "/[projectId]/direct-costs/new", title: "New Direct Cost", category: "Project — Financial", type: "form", dynamic: true },
  { url: "/[projectId]/invoices", title: "Invoicing", category: "Project — Financial", type: "list", dynamic: true },
  { url: "/[projectId]/invoices/new", title: "New Invoice", category: "Project — Financial", type: "form", dynamic: true },
  { url: "/[projectId]/invoices/owner/new", title: "New Owner Invoice", category: "Project — Financial", type: "form", dynamic: true },
  { url: "/[projectId]/invoicing/new", title: "New Legacy Owner Invoice", category: "Project — Financial", type: "form", dynamic: true },
  { url: "/[projectId]/invoicing/subcontractor/new", title: "Create New Subcontractor Invoice", category: "Project — Financial", type: "form", dynamic: true },
  { url: "/[projectId]/estimates", title: "Estimates", category: "Project — Financial", type: "list", dynamic: true },
  { url: "/[projectId]/estimates/new", title: "New Estimate", category: "Project — Financial", type: "form", dynamic: true },
  { url: "/[projectId]/pcos/new", title: "New Potential Change Order", category: "Project — Financial", type: "form", dynamic: true },
  { url: "/[projectId]/pcos/[pcoId]/edit", title: "Edit Potential Change Order", category: "Project — Financial", type: "form", dynamic: true },
  { url: "/[projectId]/prime-contract-pcos/new", title: "Create Prime Contract PCO", category: "Project — Financial", type: "form", dynamic: true },
  { url: "/[projectId]/prime-contract-pcos/[pcoId]/edit", title: "Edit Prime Contract PCO", category: "Project — Financial", type: "form", dynamic: true },
  { url: "/[projectId]/sov", title: "Schedule of Values", category: "Project — Financial", type: "list", dynamic: true },
  { url: "/[projectId]/reporting", title: "Reporting", category: "Project — Financial", type: "dashboard", dynamic: true },

  // Project — Field
  { url: "/[projectId]/schedule", title: "Schedule", category: "Project — Field", type: "list", dynamic: true },
  { url: "/[projectId]/rfis", title: "RFIs", category: "Project — Field", type: "list", dynamic: true },
  { url: "/[projectId]/rfis/new", title: "New RFI", category: "Project — Field", type: "form", dynamic: true },
  { url: "/[projectId]/submittals", title: "Submittals", category: "Project — Field", type: "list", dynamic: true },
  { url: "/[projectId]/submittals/new", title: "New Submittal", category: "Project — Field", type: "form", dynamic: true },
  { url: "/[projectId]/submittals/[submittalId]/edit", title: "Edit Submittal", category: "Project — Field", type: "form", dynamic: true },
  { url: "/[projectId]/drawings", title: "Drawings", category: "Project — Field", type: "list", dynamic: true },
  { url: "/[projectId]/punch-list", title: "Punch List", category: "Project — Field", type: "list", dynamic: true },
  { url: "/[projectId]/meetings", title: "Meetings", category: "Project — Field", type: "list", dynamic: true },
  { url: "/[projectId]/documents", title: "Documents", category: "Project — Field", type: "list", dynamic: true },
  { url: "/[projectId]/photos", title: "Photos", category: "Project — Field", type: "list", dynamic: true },
  { url: "/[projectId]/daily-log", title: "Daily Log", category: "Project — Field", type: "list", dynamic: true },
  { url: "/[projectId]/daily-log/new", title: "New Daily Log", category: "Project — Field", type: "form", dynamic: true },
  { url: "/[projectId]/daily-log/site-lead-checklist", title: "Site Lead Checklist", category: "Project — Field", type: "form", dynamic: true },
  { url: "/[projectId]/specifications", title: "Specifications", category: "Project — Field", type: "list", dynamic: true },
  { url: "/[projectId]/transmittals", title: "Transmittals", category: "Project — Field", type: "list", dynamic: true },
  { url: "/[projectId]/emails", title: "Emails", category: "Project — Field", type: "list", dynamic: true },

  // Project — Admin
  { url: "/[projectId]/directory/team", title: "Directory — Team", category: "Project — Admin", type: "list", dynamic: true },
  { url: "/[projectId]/directory/vendors", title: "Directory — Vendors", category: "Project — Admin", type: "list", dynamic: true },
  { url: "/[projectId]/directory/members", title: "Directory — Members", category: "Project — Admin", type: "list", dynamic: true },
  { url: "/[projectId]/directory/groups", title: "Directory — Distribution Groups", category: "Project — Admin", type: "list", dynamic: true },
  { url: "/[projectId]/setup", title: "Project Setup", category: "Project — Admin", type: "settings", dynamic: true },
  { url: "/[projectId]/admin", title: "Project Admin", category: "Project — Admin", type: "admin", dynamic: true },

  // Directory
  { url: "/directory/companies", title: "Companies", category: "Directory", type: "list", dynamic: false },
  { url: "/directory/clients", title: "Clients", category: "Directory", type: "list", dynamic: false },
  { url: "/directory/contacts", title: "Contacts", category: "Directory", type: "list", dynamic: false },
  { url: "/directory/vendors", title: "Vendors", category: "Directory", type: "list", dynamic: false },
  { url: "/directory/employees", title: "Employees", category: "Directory", type: "list", dynamic: false },
  { url: "/directory/users", title: "Users", category: "Directory", type: "list", dynamic: false },
  { url: "/directory/prospects", title: "Prospects", category: "Directory", type: "list", dynamic: false },
  { url: "/directory/groups", title: "Distribution Groups", category: "Directory", type: "list", dynamic: false },

  // Settings
  { url: "/settings", title: "Settings", category: "Settings", type: "settings", dynamic: false },
  { url: "/settings/account", title: "Account", category: "Settings", type: "settings", dynamic: false },
  { url: "/settings/members", title: "Members", category: "Settings", type: "settings", dynamic: false },
  { url: "/settings/integrations", title: "Integrations", category: "Settings", type: "settings", dynamic: false },
  { url: "/settings/security", title: "Security", category: "Settings", type: "settings", dynamic: false },
  { url: "/settings/preferences", title: "Preferences", category: "Settings", type: "settings", dynamic: false },
  { url: "/settings/audit", title: "Audit Log", category: "Settings", type: "settings", dynamic: false },

  // Admin
  { url: "/knowledge/manage", title: "Knowledge Sources", category: "Admin", type: "admin", dynamic: false },

  // AI
  { url: "/ai", title: "AI", category: "AI", type: "chat", dynamic: false },
  { url: "/rag", title: "RAG Chat", category: "AI", type: "chat", dynamic: false },

  // Auth
  { url: "/auth/login", title: "Login", category: "Auth", type: "auth", dynamic: false },
  { url: "/auth/sign-up", title: "Sign Up", category: "Auth", type: "auth", dynamic: false },
  { url: "/auth/forgot-password", title: "Forgot Password", category: "Auth", type: "auth", dynamic: false },

  // Utility
  { url: "/site-map", title: "Sitemap", category: "Utility", type: "utility", dynamic: false },
  { url: "/design-system", title: "Design System", category: "Utility", type: "utility", dynamic: false },
  { url: "/design", title: "Component Showcase", category: "Utility", type: "utility", dynamic: false },
  { url: "/api-docs", title: "API Docs", category: "Utility", type: "utility", dynamic: false },
  { url: "/style-guide", title: "Style Guide", category: "Utility", type: "utility", dynamic: false },
];

export function getRoutesByCategory(): Record<string, SitemapRoute[]> {
  const categorized: Record<string, SitemapRoute[]> = {};
  for (const route of staticRoutes) {
    if (!categorized[route.category]) categorized[route.category] = [];
    categorized[route.category].push(route);
  }
  return categorized;
}

export function searchRoutes(query: string): SitemapRoute[] {
  const q = query.toLowerCase();
  return staticRoutes.filter(
    (r) =>
      r.title.toLowerCase().includes(q) ||
      r.url.toLowerCase().includes(q) ||
      r.category.toLowerCase().includes(q),
  );
}

// Keep for XML sitemap compatibility
export function getAllRoutesFlat(): SitemapRoute[] {
  return staticRoutes;
}
