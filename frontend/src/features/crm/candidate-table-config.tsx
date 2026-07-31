import { StatusBadge } from "@/components/ds";
import type { ColumnConfig, TableColumn } from "@/components/tables/unified";
import { formatDate } from "@/lib/format";
import type { CrmActivityCandidate } from "@/lib/crm/types";

export const crmCandidateColumnConfig: ColumnConfig[] = [
  { id: "subject", label: "Communication", alwaysVisible: true },
  { id: "company", label: "Suggested account", defaultVisible: true },
  { id: "source", label: "Source", defaultVisible: true },
  { id: "confidence", label: "Confidence", defaultVisible: true },
  { id: "evidence", label: "Match evidence", defaultVisible: true },
  { id: "visibility", label: "Visibility", defaultVisible: true },
  { id: "occurred", label: "Occurred", defaultVisible: true },
  { id: "status", label: "Status", defaultVisible: true },
];

export const crmCandidateDefaultColumns = crmCandidateColumnConfig.map(
  (column) => column.id,
);

export const crmCandidateColumns: TableColumn<CrmActivityCandidate>[] = [
  {
    ...crmCandidateColumnConfig[0],
    render: (candidate) => <span className="font-medium">{candidate.subject}</span>,
    sortable: true,
    sortValue: (candidate) => candidate.subject,
  },
  {
    ...crmCandidateColumnConfig[1],
    render: (candidate) => <span>{candidate.proposedCompanyName}</span>,
    sortable: true,
    sortValue: (candidate) => candidate.proposedCompanyName,
  },
  {
    ...crmCandidateColumnConfig[2],
    editable: false,
    render: (candidate) => <StatusBadge status={candidate.sourceSystem} />,
    sortable: true,
    sortValue: (candidate) => candidate.sourceSystem,
  },
  {
    ...crmCandidateColumnConfig[3],
    render: (candidate) => (
      <span className="tabular-nums">{Math.round(candidate.matchConfidence * 100)}%</span>
    ),
    sortable: true,
    sortValue: (candidate) => candidate.matchConfidence,
  },
  {
    ...crmCandidateColumnConfig[4],
    render: (candidate) => <span>{candidate.matchSignals.join(", ")}</span>,
    csvValue: (candidate) => candidate.matchSignals.join("; "),
  },
  {
    ...crmCandidateColumnConfig[5],
    editable: false,
    render: (candidate) => <StatusBadge status={candidate.visibilityScope} />,
    sortable: true,
    sortValue: (candidate) => candidate.visibilityScope,
  },
  {
    ...crmCandidateColumnConfig[6],
    render: (candidate) => <span>{formatDate(candidate.occurredAt)}</span>,
    sortable: true,
    sortValue: (candidate) => candidate.occurredAt,
  },
  {
    ...crmCandidateColumnConfig[7],
    editable: false,
    render: (candidate) => <StatusBadge status={candidate.status} />,
    sortable: true,
    sortValue: (candidate) => candidate.status,
  },
];
