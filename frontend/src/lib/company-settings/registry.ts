export type CompanySettingsAvailability = "available" | "protected";

export interface CompanySettingsItem {
  id: string;
  title: string;
  description: string;
  availability: CompanySettingsAvailability;
  href?: string;
  actionLabel?: string;
  protectionReason?: string;
}

export interface CompanySettingsSection {
  id: string;
  label: string;
  items: CompanySettingsItem[];
}

/**
 * The single registry for company-wide configuration entry points.
 *
 * A registry entry is available only when it points to the canonical owner for
 * its data and safety rules. Protected entries deliberately remain visible so
 * admins understand the current boundary instead of encountering a silent
 * missing setting.
 */
export const COMPANY_SETTINGS_SECTIONS: CompanySettingsSection[] = [
  {
    id: "organization",
    label: "Access & organization",
    items: [
      {
        id: "users",
        title: "Users",
        description: "Invite people, control company access, and manage project membership.",
        availability: "available",
        href: "/user-management",
        actionLabel: "Manage users",
      },
      {
        id: "company-permission-templates",
        title: "Company permission templates",
        description: "Define reusable access templates before applying them to users.",
        availability: "available",
        href: "/user-management?tab=company-templates",
        actionLabel: "Manage templates",
      },
      {
        id: "company-context",
        title: "Company context",
        description: "Maintain the company profile and operating context used across Alleato.",
        availability: "available",
        href: "/admin/company-info",
        actionLabel: "Manage company context",
      },
    ],
  },
  {
    id: "directory",
    label: "Directory catalogs",
    items: [
      {
        id: "companies",
        title: "Companies",
        description: "Maintain the company directory used by project teams and financial workflows.",
        availability: "available",
        href: "/directory/companies",
        actionLabel: "Manage companies",
      },
      {
        id: "project-roles",
        title: "Project roles",
        description: "Role definitions belong to each project directory, where membership and assignments are visible together.",
        availability: "protected",
        protectionReason: "Choose a project, then open its directory to manage project roles safely.",
      },
      {
        id: "trades",
        title: "Trades",
        description: "A shared trade catalog needs its own source-of-truth data owner before it can be edited here.",
        availability: "protected",
        protectionReason: "Trades are not yet backed by a canonical company-level registry, so editing is intentionally unavailable.",
      },
    ],
  },
  {
    id: "meetings",
    label: "Meetings",
    items: [
      {
        id: "meeting-templates",
        title: "Meeting templates",
        description: "Standardize recurring agendas and meeting structure.",
        availability: "available",
        href: "/meeting-templates",
        actionLabel: "Manage templates",
      },
      {
        id: "meeting-types",
        title: "Meeting types",
        description: "Meeting type is currently stored as source metadata, not a managed configuration catalog.",
        availability: "protected",
        protectionReason: "Create a validated company meeting-type registry before making these values configurable.",
      },
    ],
  },
  {
    id: "financial",
    label: "Financial codebooks",
    items: [
      {
        id: "cost-codes",
        title: "Cost codes",
        description: "Cost codes are currently activated through project budget workflows.",
        availability: "protected",
        protectionReason: "A company-level cost-code owner is required before changes can safely affect active financial records.",
      },
    ],
  },
  {
    id: "workflow",
    label: "Workflow policy",
    items: [
      {
        id: "workflow-statuses",
        title: "Workflow statuses",
        description: "Required stages preserve reporting, approvals, and historical record integrity.",
        availability: "protected",
        protectionReason: "System stages cannot be edited here. Any future configuration must preserve required transitions and where-used rules.",
      },
    ],
  },
  {
    id: "operations",
    label: "Audit & operations",
    items: [
      {
        id: "project-creation-log",
        title: "Project creation log",
        description: "See who or what created each project and the correlation evidence captured at creation time.",
        availability: "available",
        href: "/company-settings/project-creation-log",
        actionLabel: "View creation log",
      },
    ],
  },
];

export const DEFAULT_COMPANY_SETTINGS_SECTION_ID =
  COMPANY_SETTINGS_SECTIONS[0].id;
