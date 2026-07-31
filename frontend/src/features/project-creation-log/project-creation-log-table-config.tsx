import Link from "next/link";
import type {
  ColumnConfig,
  FilterConfig,
  TableColumn,
} from "@/components/tables/unified";
import {
  CellDate,
  CellStackText,
  CellText,
  TABLE_LINK_CLASSNAME,
} from "@/components/tables/unified";

export interface ProjectCreationLogItem {
  id: string;
  project_id: number | null;
  project_name: string | null;
  project_number: string | null;
  created_by: string | null;
  created_by_name: string | null;
  created_via: string;
  creation_request_id: string | null;
  creation_run_id: string | null;
  created_at: string;
  attribution_status: "complete" | "legacy_gap";
  project_exists: boolean;
}

const SOURCE_LABELS: Record<string, string> = {
  web_app: "Web app",
  api: "API",
  test_bootstrap: "Test bootstrap",
  acumatica_sync: "Acumatica sync",
  import: "Import",
  automation: "Automation",
  direct_database: "Direct database",
  legacy_unknown: "Legacy unknown",
};

export const projectCreationLogColumnConfig: ColumnConfig[] = [
  { id: "project", label: "Project", alwaysVisible: true },
  { id: "actor", label: "Actor", defaultVisible: true },
  { id: "created_at", label: "Created", defaultVisible: true },
  { id: "created_via", label: "Source / evidence", defaultVisible: true },
  { id: "reference", label: "Reference", defaultVisible: true },
];

export const projectCreationLogDefaultVisibleColumns =
  projectCreationLogColumnConfig
    .filter((column) => column.alwaysVisible || column.defaultVisible)
    .map((column) => column.id);

export const projectCreationLogFilters: FilterConfig[] = [
  {
    id: "created_via",
    label: "Source",
    type: "select",
    options: Object.entries(SOURCE_LABELS).map(([value, label]) => ({
      value,
      label,
    })),
  },
  {
    id: "attribution_status",
    label: "Attribution",
    type: "select",
    options: [
      { value: "complete", label: "Complete" },
      { value: "legacy_gap", label: "Legacy gap" },
    ],
  },
];

function projectActor(item: ProjectCreationLogItem) {
  if (item.created_by_name) return item.created_by_name;
  if (item.created_by) return `User ${item.created_by.slice(0, 8)}…`;
  return "Not captured";
}

export function buildProjectCreationLogColumns(): TableColumn<ProjectCreationLogItem>[] {
  return [
    {
      id: "project",
      label: "Project",
      alwaysVisible: true,
      width: 260,
      render: (item) => {
        const name =
          item.project_name?.trim() ||
          `Project ${item.project_id ?? "unknown"}`;
        const content = (
          <CellStackText
            primary={name}
            secondary={
              item.project_number ? `Job ${item.project_number}` : undefined
            }
          />
        );

        return item.project_exists && item.project_id ? (
          <Link
            href={`/${item.project_id}/home`}
            className={TABLE_LINK_CLASSNAME}
          >
            {content}
          </Link>
        ) : (
          content
        );
      },
      csvValue: (item) => item.project_name ?? String(item.project_id ?? ""),
    },
    {
      id: "actor",
      label: "Actor",
      defaultVisible: true,
      width: 190,
      render: (item) => (
        <CellStackText
          primary={projectActor(item)}
          secondary={item.created_by ?? undefined}
        />
      ),
      csvValue: projectActor,
    },
    {
      id: "created_at",
      label: "Created",
      defaultVisible: true,
      width: 170,
      render: (item) => <CellDate value={item.created_at} showTime />,
      csvValue: (item) => item.created_at,
    },
    {
      id: "created_via",
      label: "Source / evidence",
      defaultVisible: true,
      width: 170,
      render: (item) => (
        <CellStackText
          primary={SOURCE_LABELS[item.created_via] ?? item.created_via}
          secondary={
            item.attribution_status === "legacy_gap" ? "Legacy gap" : "Complete"
          }
        />
      ),
      csvValue: (item) =>
        `${SOURCE_LABELS[item.created_via] ?? item.created_via}; ${
          item.attribution_status === "legacy_gap" ? "Legacy gap" : "Complete"
        }`,
    },
    {
      id: "reference",
      label: "Reference",
      defaultVisible: true,
      width: 260,
      render: (item) => (
        <CellText
          value={item.creation_request_id ?? item.creation_run_id}
          className="font-mono text-xs"
          muted
        />
      ),
      csvValue: (item) =>
        item.creation_request_id ?? item.creation_run_id ?? "",
    },
  ];
}
