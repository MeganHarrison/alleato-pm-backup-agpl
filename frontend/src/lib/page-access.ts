import type { PermissionModule } from "@/lib/permissions-shared";

export type PageAccessLevel =
  | "public"
  | "signed_in"
  | "project_member"
  | "module_read"
  | "module_write"
  | "module_admin"
  | "app_admin"
  | "developer";

export type PageAccessPolicy = {
  route: string;
  accessLevel: PageAccessLevel;
  permissionModule: PermissionModule | null;
  notes: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
};

export type PageAccessPolicyInput = {
  route: string;
  accessLevel: PageAccessLevel;
  permissionModule?: PermissionModule | null;
  notes?: string | null;
};

export const PAGE_ACCESS_LEVEL_LABELS: Record<PageAccessLevel, string> = {
  public: "Public",
  signed_in: "Signed in",
  project_member: "Project member",
  module_read: "Module read",
  module_write: "Module write",
  module_admin: "Module admin",
  app_admin: "App admin",
  developer: "Developer",
};

export const PAGE_ACCESS_LEVELS: PageAccessLevel[] = [
  "public",
  "signed_in",
  "project_member",
  "module_read",
  "module_write",
  "module_admin",
  "app_admin",
  "developer",
];

export const PAGE_ACCESS_MODULES: PermissionModule[] = [
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
];

export const PAGE_ACCESS_MODULE_LABELS: Record<PermissionModule, string> = {
  directory: "Directory",
  budget: "Budget",
  contracts: "Contracts",
  commitments: "Commitments",
  estimates: "Estimates",
  documents: "Documents",
  schedule: "Schedule",
  submittals: "Submittals",
  rfis: "RFIs",
  change_orders: "Change Orders",
  change_events: "Change Events",
  emails: "Emails",
};

export function accessLevelRequiresModule(accessLevel: PageAccessLevel): boolean {
  return accessLevel === "module_read" || accessLevel === "module_write" || accessLevel === "module_admin";
}

export function inferPageAccessDefaults(input: {
  route: string;
  file: string;
  category: string;
}): Pick<PageAccessPolicy, "accessLevel" | "permissionModule"> {
  const route = input.route.toLowerCase();
  const file = input.file.toLowerCase();
  const category = input.category.toLowerCase();

  if (route.startsWith("/auth") || route === "/access-denied") {
    return { accessLevel: "public", permissionModule: null };
  }

  if (file.includes("/(developer)/")) {
    return { accessLevel: "developer", permissionModule: null };
  }

  if (file.includes("/(admin)/") || route.startsWith("/admin") || category === "admin") {
    return { accessLevel: "app_admin", permissionModule: null };
  }

  if (!route.includes("[projectid]")) {
    return { accessLevel: "signed_in", permissionModule: null };
  }

  if (
    route.includes("budget") ||
    route.includes("estimate") ||
    route.includes("direct-cost")
  ) {
    return { accessLevel: "module_read", permissionModule: "budget" };
  }

  if (
    route.includes("contract") ||
    route.includes("commitment") ||
    route.includes("invoice") ||
    route.includes("change-order")
  ) {
    return { accessLevel: "module_read", permissionModule: "contracts" };
  }

  if (route.includes("change-event")) {
    return { accessLevel: "module_read", permissionModule: "change_orders" };
  }

  if (route.includes("document") || route.includes("drawing") || route.includes("file")) {
    return { accessLevel: "module_read", permissionModule: "documents" };
  }

  if (route.includes("schedule")) {
    return { accessLevel: "module_read", permissionModule: "schedule" };
  }

  if (route.includes("submittal")) {
    return { accessLevel: "module_read", permissionModule: "submittals" };
  }

  if (route.includes("rfi")) {
    return { accessLevel: "module_read", permissionModule: "rfis" };
  }

  if (route.includes("directory") || route.includes("team")) {
    return { accessLevel: "module_read", permissionModule: "directory" };
  }

  return { accessLevel: "project_member", permissionModule: null };
}

export function normalizePageAccessInput(input: PageAccessPolicyInput): PageAccessPolicyInput {
  const permissionModule = accessLevelRequiresModule(input.accessLevel)
    ? input.permissionModule ?? "directory"
    : null;

  return {
    route: input.route,
    accessLevel: input.accessLevel,
    permissionModule,
    notes: input.notes ?? null,
  };
}
