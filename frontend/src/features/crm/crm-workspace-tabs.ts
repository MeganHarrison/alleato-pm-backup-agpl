export function buildCrmWorkspaceTabs(pathname: string | null) {
  const currentPath = pathname ?? "";
  return [
    { label: "Relationships", href: "/crm", isActive: currentPath === "/crm" },
    {
      label: "Leads",
      href: "/crm/leads",
      isActive: currentPath === "/crm/leads",
    },
    {
      label: "Actions",
      href: "/crm/tasks",
      isActive: currentPath === "/crm/tasks",
    },
    {
      label: "Pipeline",
      href: "/crm/pipeline",
      isActive: currentPath === "/crm/pipeline",
    },
    {
      label: "Command",
      href: "/crm/command-center",
      isActive: currentPath === "/crm/command-center",
    },
    {
      label: "Growth",
      href: "/crm/growth",
      isActive: currentPath === "/crm/growth",
    },
    {
      label: "Deals",
      href: "/crm/deals",
      isActive: currentPath.startsWith("/crm/deals"),
    },
    {
      label: "Activity",
      href: "/crm/activities",
      isActive: currentPath === "/crm/activities",
    },
    {
      label: "Matching",
      href: "/crm/settings/matching",
      isActive: currentPath === "/crm/settings/matching",
    },
    {
      label: "Settings",
      href: "/crm/settings",
      isActive: currentPath === "/crm/settings",
    },
  ];
}
