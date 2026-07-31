interface TabConfig {
  label: string;
  href: string;
  count?: number;
  isActive?: boolean;
}

export function getDirectoryTabs(currentPath: string): TabConfig[] {
  return [
    {
      label: "Companies",
      href: "/directory/companies",
      isActive: currentPath === "/directory/companies",
    },
    {
      label: "Clients",
      href: "/directory/clients",
      isActive: currentPath === "/directory/clients",
    },
    {
      label: "Contacts",
      href: "/directory/contacts",
      isActive: currentPath === "/directory/contacts",
    },
    {
      label: "Vendors",
      href: "/directory/vendors",
      isActive: currentPath === "/directory/vendors",
    },
    {
      label: "Prospects",
      href: "/directory/prospects",
      isActive: currentPath === "/directory/prospects",
    },
    {
      label: "Distribution Groups",
      href: "/directory/groups",
      isActive: currentPath === "/directory/groups",
    },
    {
      label: "Employees",
      href: "/directory/employees",
      isActive: currentPath === "/directory/employees",
    },
  ];
}

export function getAccessControlTabs(currentPath: string): TabConfig[] {
  return [
    {
      label: "Users",
      href: "/directory/users",
      isActive: currentPath === "/directory/users",
    },
    {
      label: "Permissions",
      href: "/directory/permissions",
      isActive: currentPath === "/directory/permissions",
    },
    {
      label: "Templates",
      href: "/directory/templates",
      isActive: currentPath === "/directory/templates",
    },
  ];
}

export function getProjectDirectoryTabs(
  projectId: string,
  currentPath: string,
): TabConfig[] {
  return [
    {
      label: "Team",
      href: `/${projectId}/directory/team`,
      isActive: currentPath === `/${projectId}/directory/team`,
    },
    {
      label: "Vendors",
      href: `/${projectId}/directory/vendors`,
      isActive: currentPath === `/${projectId}/directory/vendors`,
    },
    {
      label: "Members",
      href: `/${projectId}/directory/members`,
      isActive: currentPath === `/${projectId}/directory/members`,
    },
    {
      label: "Distribution Groups",
      href: `/${projectId}/directory/groups`,
      isActive: currentPath === `/${projectId}/directory/groups`,
    },
  ];
}
