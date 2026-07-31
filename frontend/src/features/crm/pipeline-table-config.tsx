import type { ColumnConfig, TableColumn } from "@/components/tables/unified";
import { StatusBadge } from "@/components/ds";
import { formatDate } from "@/lib/format";

export interface DealPerson {
  id: string;
  first_name: string | null;
  last_name: string | null;
}

export interface DealListItem {
  id: string;
  name: string;
  status: "open" | "won" | "lost";
  value: number | null;
  expected_close_date: string | null;
  lead_source: string | null;
  description: string | null;
  created_at: string | null;
  updated_at: string | null;
  company: { id: string; name: string; lifecycle_stage: string } | null;
  stage: {
    id: string;
    name: string;
    sort_order: number;
    is_terminal: boolean;
    outcome: "won" | "lost" | null;
  } | null;
  owner: DealPerson | null;
  primary_contact: DealPerson | null;
}

export function personName(person: DealPerson | null): string {
  if (!person) return "";
  return [person.first_name, person.last_name].filter(Boolean).join(" ");
}

export function formatDealValue(value: number | null): string {
  if (value == null) return "";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export const pipelineColumns: ColumnConfig[] = [
  { id: "name", label: "Deal", alwaysVisible: true },
  { id: "company", label: "Company", defaultVisible: true },
  { id: "stage", label: "Stage", defaultVisible: true },
  { id: "value", label: "Value", defaultVisible: true },
  { id: "owner", label: "Owner", defaultVisible: true },
  { id: "expected_close_date", label: "Expected Close", defaultVisible: true },
  { id: "status", label: "Status", defaultVisible: true },
  { id: "lead_source", label: "Lead Source", defaultVisible: false },
  { id: "created_at", label: "Created", defaultVisible: false },
];

export const pipelineDefaultVisibleColumns = pipelineColumns
  .filter((col) => col.defaultVisible !== false || col.alwaysVisible)
  .map((col) => col.id);

export function buildPipelineTableColumns(): TableColumn<DealListItem>[] {
  return [
    {
      ...pipelineColumns[0],
      render: (item) => <span className="font-medium">{item.name}</span>,
      sortable: true,
      sortValue: (item) => item.name,
      csvValue: (item) => item.name,
    },
    {
      ...pipelineColumns[1],
      render: (item) => <span>{item.company?.name}</span>,
      sortable: true,
      sortValue: (item) => item.company?.name ?? "",
      csvValue: (item) => item.company?.name ?? "",
    },
    {
      ...pipelineColumns[2],
      render: (item) => <span>{item.stage?.name}</span>,
      sortable: true,
      sortValue: (item) => item.stage?.sort_order ?? 0,
      csvValue: (item) => item.stage?.name ?? "",
    },
    {
      ...pipelineColumns[3],
      render: (item) => <span className="tabular-nums">{formatDealValue(item.value)}</span>,
      sortable: true,
      sortValue: (item) => item.value ?? 0,
      csvValue: (item) => (item.value == null ? "" : String(item.value)),
    },
    {
      ...pipelineColumns[4],
      render: (item) => <span>{personName(item.owner)}</span>,
      sortable: true,
      sortValue: (item) => personName(item.owner),
      csvValue: (item) => personName(item.owner),
    },
    {
      ...pipelineColumns[5],
      render: (item) => (
        <span>{item.expected_close_date ? formatDate(item.expected_close_date) : ""}</span>
      ),
      sortable: true,
      sortValue: (item) => item.expected_close_date ?? "",
      csvValue: (item) => item.expected_close_date ?? "",
    },
    {
      ...pipelineColumns[6],
      // Status is derived from the stage outcome (won/lost) — not directly editable.
      editable: false,
      render: (item) => <StatusBadge status={item.status} />,
      sortable: true,
      sortValue: (item) => item.status,
      csvValue: (item) => item.status,
    },
    {
      ...pipelineColumns[7],
      render: (item) => <span>{item.lead_source}</span>,
      sortValue: (item) => item.lead_source ?? "",
      csvValue: (item) => item.lead_source ?? "",
    },
    {
      ...pipelineColumns[8],
      render: (item) => <span>{item.created_at ? formatDate(item.created_at) : ""}</span>,
      sortable: true,
      sortValue: (item) => item.created_at ?? "",
      csvValue: (item) => item.created_at ?? "",
    },
  ];
}
