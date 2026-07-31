import type { ColumnConfig, FilterConfig } from "@/components/tables/unified";

export const appErrorColumnConfig: ColumnConfig[] = [
  { id: "severity", label: "Severity", alwaysVisible: true },
  { id: "source", label: "Source", defaultVisible: true },
  { id: "message", label: "Message", alwaysVisible: true },
  { id: "route", label: "Route", defaultVisible: true },
  { id: "events", label: "Events", defaultVisible: true },
  { id: "last_seen", label: "Last Seen", defaultVisible: true },
  { id: "status", label: "Status", defaultVisible: true },
];

export const appErrorDefaultVisibleColumns = appErrorColumnConfig
  .filter((c) => c.defaultVisible || c.alwaysVisible)
  .map((c) => c.id);

export const appErrorFilters: FilterConfig[] = [
  {
    id: "status",
    label: "Status",
    type: "select",
    options: [
      { value: "active", label: "Active" },
      { value: "new", label: "New" },
      { value: "triaged", label: "Triaged" },
      { value: "in_progress", label: "In Progress" },
      { value: "needs_human", label: "Needs Human" },
      { value: "fixed", label: "Fixed" },
      { value: "ignored", label: "Ignored" },
      { value: "all", label: "All" },
    ],
  },
  {
    id: "severity",
    label: "Severity",
    type: "select",
    options: [
      { value: "critical", label: "Critical" },
      { value: "high", label: "High" },
      { value: "medium", label: "Medium" },
      { value: "low", label: "Low" },
    ],
  },
  {
    id: "source",
    label: "Source",
    type: "select",
    options: [
      { value: "browser", label: "Browser" },
      { value: "api", label: "API" },
      { value: "server", label: "Server" },
    ],
  },
];
