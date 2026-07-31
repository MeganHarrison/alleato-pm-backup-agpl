/**
 * Permissions — shared types and constants.
 *
 * This file is safe to import from client components. It has no runtime
 * dependency on server-only modules like `next/headers` or the server
 * Supabase client. The server-side query/mutation helpers live in
 * `./permissions.ts` which imports these types.
 */

export type PermissionLevel = "none" | "read" | "write" | "admin";

export type PermissionModule =
  | "directory"
  | "budget"
  | "contracts"
  | "commitments"
  | "estimates"
  | "documents"
  | "schedule"
  | "submittals"
  | "rfis"
  | "change_orders"
  | "change_events"
  | "emails"
  | "crm";

/**
 * Granular capability flags layered on top of the base None/Read/Write/Admin
 * levels. Modeled after Procore's granular permissions — named capabilities
 * that can be toggled on a template independent of the base module level.
 */
export type GranularFlag =
  | "view_private_commitments"
  | "edit_own_ssov"
  | "bulk_edit_subcontractor_invoice_status"
  | "approve_change_orders"
  | "approve_budget_changes"
  | "approve_invoices"
  | "create_change_events"
  | "create_budget_modifications"
  | "manage_project_directory"
  | "view_executive_briefing"
  | "view_executive_details"
  | "view_accounting";

export type AppCapability =
  | "view_executive_briefing"
  | "view_executive_details"
  | "view_accounting";

export const ALL_MODULES: PermissionModule[] = [
  "directory",
  "budget",
  "contracts",
  "commitments",
  "estimates",
  "documents",
  "schedule",
  "submittals",
  "rfis",
  "change_orders",
  "change_events",
  "emails",
  "crm",
];

export const ALL_GRANULAR_FLAGS: GranularFlag[] = [
  "view_private_commitments",
  "edit_own_ssov",
  "bulk_edit_subcontractor_invoice_status",
  "approve_change_orders",
  "approve_budget_changes",
  "approve_invoices",
  "create_change_events",
  "create_budget_modifications",
  "manage_project_directory",
  "view_executive_briefing",
  "view_executive_details",
  "view_accounting",
];

export const APP_CAPABILITY_FLAGS: AppCapability[] = [
  "view_executive_briefing",
  "view_executive_details",
  "view_accounting",
];

export type GranularOverrideEffect = "allow" | "deny";

/**
 * Collapse company- and project-scoped granular overrides deterministically.
 * A deny always wins when both scopes contain the same flag, matching the
 * database authorization functions regardless of row-return order.
 */
export function reduceGranularPermissionOverrides(
  rows: ReadonlyArray<{ flag: string; effect: string }>,
): Partial<Record<GranularFlag, GranularOverrideEffect>> {
  return rows.reduce(
    (acc, row) => {
      if (
        ALL_GRANULAR_FLAGS.includes(row.flag as GranularFlag) &&
        (row.effect === "allow" || row.effect === "deny")
      ) {
        const flag = row.flag as GranularFlag;
        if (row.effect === "deny" || acc[flag] !== "deny") {
          acc[flag] = row.effect;
        }
      }
      return acc;
    },
    {} as Partial<Record<GranularFlag, GranularOverrideEffect>>,
  );
}

export const GRANULAR_FLAG_LABELS: Record<GranularFlag, string> = {
  view_private_commitments:               "View private commitments",
  edit_own_ssov:                          "Edit own schedule of values (invoice contact)",
  bulk_edit_subcontractor_invoice_status: "Bulk edit subcontractor invoice status",
  approve_change_orders:                  "Approve change orders",
  approve_budget_changes:                 "Approve budget changes",
  approve_invoices:                       "Approve invoices",
  create_change_events:                   "Create change events",
  create_budget_modifications:            "Create budget modifications",
  manage_project_directory:               "Manage project directory",
  view_executive_briefing:                "View executive briefing",
  view_executive_details:                 "View executive claims, evidence, and artifacts",
  view_accounting:                        "View accounting",
};

export interface UserPermissions {
  userId: string;
  personId: string;
  projectId: number;
  template?: {
    id: string;
    name: string;
    rules: Record<PermissionModule, PermissionLevel[]>;
    granularFlags: GranularFlag[];
  };
  overrides: Record<PermissionModule, PermissionLevel>;
  /** Modules with a persisted override, including an explicit deny (`none`). */
  explicitOverrideModules?: PermissionModule[];
  granularOverrides?: Partial<Record<GranularFlag, GranularOverrideEffect>>;
  isAdmin: boolean;
}

export interface PermissionTemplate {
  id: string;
  name: string;
  description?: string;
  rules_json: Record<PermissionModule, PermissionLevel[]>;
  granular_flags: GranularFlag[];
  is_system: boolean;
  scope?: string;
}

// ---------------------------------------------------------------------------
// Pure check helpers — safe to call from client or server.
// ---------------------------------------------------------------------------

/**
 * Check if a user has a specific permission level for a module.
 * Hierarchy: admin > write > read > none
 */
export function hasPermission(
  permissions: UserPermissions,
  module: PermissionModule,
  level: PermissionLevel,
): boolean {
  if (permissions.isAdmin) return true;

  if (permissions.explicitOverrideModules?.includes(module)) {
    const override = permissions.overrides[module];
    return override !== "none" && checkPermissionLevel(override, level);
  }

  if (permissions.overrides[module] && permissions.overrides[module] !== "none") {
    return checkPermissionLevel(permissions.overrides[module], level);
  }

  if (permissions.template?.rules[module]) {
    const templateLevels = permissions.template.rules[module];
    return templateLevels.some((tl) => checkPermissionLevel(tl, level));
  }

  return false;
}

/**
 * Get the highest permission level a user has for a module.
 */
export function getPermissionLevel(
  permissions: UserPermissions,
  module: PermissionModule,
): PermissionLevel {
  if (permissions.isAdmin) return "admin";

  if (permissions.explicitOverrideModules?.includes(module)) {
    return permissions.overrides[module];
  }

  if (permissions.overrides[module] && permissions.overrides[module] !== "none") {
    return permissions.overrides[module];
  }

  if (permissions.template?.rules[module]) {
    const levels = permissions.template.rules[module];
    if (levels.includes("admin")) return "admin";
    if (levels.includes("write")) return "write";
    if (levels.includes("read")) return "read";
  }

  return "none";
}

/**
 * Check if a user has a specific granular capability flag.
 * App admins always pass. Otherwise the flag must exist on the user's
 * assigned template.
 */
export function hasGranular(
  permissions: UserPermissions,
  flag: GranularFlag,
): boolean {
  if (permissions.isAdmin) return true;
  const override = permissions.granularOverrides?.[flag];
  if (override === "deny") return false;
  if (override === "allow") return true;
  return permissions.template?.granularFlags.includes(flag) ?? false;
}

function checkPermissionLevel(
  userLevel: PermissionLevel,
  requiredLevel: PermissionLevel,
): boolean {
  const order: PermissionLevel[] = ["none", "read", "write", "admin"];
  return order.indexOf(userLevel) >= order.indexOf(requiredLevel);
}
