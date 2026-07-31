import { StatusBadge } from "@/components/ds";
import type { ColumnConfig, TableColumn } from "@/components/tables/unified";
import { formatDate } from "@/lib/format";
import type { CrmActivity } from "@/lib/crm/types";

export const crmActivityColumnConfig: ColumnConfig[] = [
  { id: "subject", label: "Activity", alwaysVisible: true },
  { id: "company", label: "Relationship", defaultVisible: true },
  { id: "type", label: "Type", defaultVisible: true },
  { id: "occurred", label: "Occurred", defaultVisible: true },
  { id: "created_by", label: "Recorded by", defaultVisible: true },
  { id: "origin", label: "Origin", defaultVisible: true },
  { id: "visibility", label: "Visibility", defaultVisible: true },
];

export const crmActivityDefaultColumns = crmActivityColumnConfig.map(
  (column) => column.id,
);

export const crmActivityColumns: TableColumn<CrmActivity>[] = [
  {
    ...crmActivityColumnConfig[0],
    render: (activity) => (
      <span className="font-medium">{activity.subject}</span>
    ),
    sortable: true,
    sortValue: (activity) => activity.subject,
  },
  {
    ...crmActivityColumnConfig[1],
    render: (activity) => <span>{activity.companyName}</span>,
    sortable: true,
    sortValue: (activity) => activity.companyName,
  },
  {
    ...crmActivityColumnConfig[2],
    editable: false,
    render: (activity) => <StatusBadge status={activity.activityType} />,
    sortable: true,
    sortValue: (activity) => activity.activityType,
  },
  {
    ...crmActivityColumnConfig[3],
    render: (activity) => <span>{formatDate(activity.occurredAt)}</span>,
    sortable: true,
    sortValue: (activity) => activity.occurredAt,
  },
  {
    ...crmActivityColumnConfig[4],
    render: (activity) => <span>{activity.createdBy}</span>,
    sortable: true,
    sortValue: (activity) => activity.createdBy,
  },
  {
    ...crmActivityColumnConfig[5],
    render: (activity) => <span>{activity.recordOrigin}</span>,
    sortable: true,
    sortValue: (activity) => activity.recordOrigin,
  },
  {
    ...crmActivityColumnConfig[6],
    editable: false,
    render: (activity) => <StatusBadge status={activity.visibilityScope} />,
    sortable: true,
    sortValue: (activity) => activity.visibilityScope,
  },
];
