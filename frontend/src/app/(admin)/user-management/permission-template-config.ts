import type {
  AppCapability,
  GranularFlag,
  PermissionModule,
} from "@/lib/permissions-shared";

export type PermissionTemplateGroupKey =
  | "financials"
  | "project-management"
  | "company";

type PermissionTemplateToolBase = {
  id: string;
  label: string;
  group: PermissionTemplateGroupKey;
  granularFlags: GranularFlag[];
};

export type PermissionTemplateModuleTool = PermissionTemplateToolBase & {
  kind: "module";
  moduleKey: PermissionModule;
};

export type PermissionTemplateCapabilityTool = PermissionTemplateToolBase & {
  kind: "capability";
  capabilityKey: AppCapability;
};

export type PermissionTemplateTool =
  | PermissionTemplateModuleTool
  | PermissionTemplateCapabilityTool;

export const PERMISSION_TEMPLATE_GROUPS: Array<{
  key: PermissionTemplateGroupKey;
  label: string;
}> = [
  { key: "financials", label: "Financials" },
  { key: "project-management", label: "Project Management" },
  { key: "company", label: "Company" },
];

export const PERMISSION_TEMPLATE_TOOLS: PermissionTemplateTool[] = [
  {
    id: "budget",
    kind: "module",
    moduleKey: "budget",
    label: "Budget",
    group: "financials",
    granularFlags: ["create_budget_modifications", "approve_budget_changes"],
  },
  {
    id: "contracts",
    kind: "module",
    moduleKey: "contracts",
    label: "Contracts",
    group: "financials",
    granularFlags: [],
  },
  {
    id: "commitments",
    kind: "module",
    moduleKey: "commitments",
    label: "Commitments",
    group: "financials",
    granularFlags: [
      "view_private_commitments",
      "edit_own_ssov",
      "bulk_edit_subcontractor_invoice_status",
      "approve_invoices",
    ],
  },
  {
    id: "estimates",
    kind: "module",
    moduleKey: "estimates",
    label: "Estimates",
    group: "financials",
    granularFlags: [],
  },
  {
    id: "change-orders",
    kind: "module",
    moduleKey: "change_orders",
    label: "Change Orders",
    group: "financials",
    granularFlags: ["approve_change_orders"],
  },
  {
    id: "change-events",
    kind: "module",
    moduleKey: "change_events",
    label: "Change Events",
    group: "financials",
    granularFlags: ["create_change_events"],
  },
  {
    id: "accounting",
    kind: "capability",
    capabilityKey: "view_accounting",
    label: "Accounting",
    group: "financials",
    granularFlags: ["view_accounting"],
  },
  {
    id: "documents",
    kind: "module",
    moduleKey: "documents",
    label: "Documents",
    group: "project-management",
    granularFlags: [],
  },
  {
    id: "schedule",
    kind: "module",
    moduleKey: "schedule",
    label: "Schedule",
    group: "project-management",
    granularFlags: [],
  },
  {
    id: "submittals",
    kind: "module",
    moduleKey: "submittals",
    label: "Submittals",
    group: "project-management",
    granularFlags: [],
  },
  {
    id: "rfis",
    kind: "module",
    moduleKey: "rfis",
    label: "RFIs",
    group: "project-management",
    granularFlags: [],
  },
  {
    id: "directory",
    kind: "module",
    moduleKey: "directory",
    label: "Directory",
    group: "company",
    granularFlags: ["manage_project_directory"],
  },
  {
    id: "emails",
    kind: "module",
    moduleKey: "emails",
    label: "Emails",
    group: "company",
    granularFlags: [],
  },
  {
    id: "executive-briefing",
    kind: "capability",
    capabilityKey: "view_executive_briefing",
    label: "Executive Briefing",
    group: "company",
    granularFlags: ["view_executive_briefing"],
  },
  {
    id: "executive-details",
    kind: "capability",
    capabilityKey: "view_executive_details",
    label: "Executive Details",
    group: "company",
    granularFlags: ["view_executive_details"],
  },
];

export const PERMISSION_TEMPLATE_MODULES: PermissionTemplateModuleTool[] =
  PERMISSION_TEMPLATE_TOOLS.filter(
    (tool): tool is PermissionTemplateModuleTool => tool.kind === "module",
  );

export function getPermissionTemplateToolsByGroup(
  groupKey: PermissionTemplateGroupKey,
): PermissionTemplateTool[] {
  return PERMISSION_TEMPLATE_TOOLS.filter((tool) => tool.group === groupKey);
}
