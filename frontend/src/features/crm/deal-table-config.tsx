import { StatusBadge } from "@/components/ds";
import type { ColumnConfig, TableColumn } from "@/components/tables/unified";
import { formatCurrency, formatDate } from "@/lib/format";
import type { CrmDeal, CrmStage } from "@/lib/crm/types";

export const crmDealColumnConfig: ColumnConfig[] = [
  { id: "name", label: "Deal", alwaysVisible: true },
  { id: "company", label: "Relationship", defaultVisible: true },
  { id: "stage", label: "Stage", defaultVisible: true },
  { id: "value", label: "Value", defaultVisible: true },
  { id: "weighted", label: "Weighted", defaultVisible: true },
  { id: "owner", label: "Owner", defaultVisible: true },
  { id: "expected_close", label: "Expected close", defaultVisible: true },
  { id: "status", label: "Status", defaultVisible: true },
  { id: "source", label: "Source", defaultVisible: false },
];

export const crmDealDefaultColumns = crmDealColumnConfig
  .filter((column) => column.alwaysVisible || column.defaultVisible)
  .map((column) => column.id);

export function buildCrmDealColumns(
  stages: CrmStage[],
): TableColumn<CrmDeal>[] {
  const stageNames = new Map(stages.map((stage) => [stage.id, stage.name]));
  return [
    {
      ...crmDealColumnConfig[0],
      render: (deal) => <span className="font-medium">{deal.name}</span>,
      sortable: true,
      sortValue: (deal) => deal.name,
      csvValue: (deal) => deal.name,
    },
    {
      ...crmDealColumnConfig[1],
      render: (deal) => <span>{deal.companyName}</span>,
      sortable: true,
      sortValue: (deal) => deal.companyName,
      csvValue: (deal) => deal.companyName,
    },
    {
      ...crmDealColumnConfig[2],
      render: (deal) => <span>{stageNames.get(deal.stageId)}</span>,
      sortable: true,
      sortValue: (deal) => stageNames.get(deal.stageId) ?? "",
      csvValue: (deal) => stageNames.get(deal.stageId) ?? "",
    },
    {
      ...crmDealColumnConfig[3],
      render: (deal) => (
        <span className="tabular-nums">
          {formatCurrency(deal.valueEstimate)}
        </span>
      ),
      sortable: true,
      sortValue: (deal) => deal.valueEstimate,
      csvValue: (deal) => String(deal.valueEstimate),
    },
    {
      ...crmDealColumnConfig[4],
      render: (deal) => (
        <span className="tabular-nums">
          {formatCurrency((deal.valueEstimate * deal.probability) / 100)}
        </span>
      ),
      sortable: true,
      sortValue: (deal) => (deal.valueEstimate * deal.probability) / 100,
      csvValue: (deal) => String((deal.valueEstimate * deal.probability) / 100),
    },
    {
      ...crmDealColumnConfig[5],
      render: (deal) => <span>{deal.owner.name}</span>,
      sortable: true,
      sortValue: (deal) => deal.owner.name,
      csvValue: (deal) => deal.owner.name,
    },
    {
      ...crmDealColumnConfig[6],
      render: (deal) => (
        <span>
          {deal.expectedCloseDate ? formatDate(deal.expectedCloseDate) : ""}
        </span>
      ),
      sortable: true,
      sortValue: (deal) => deal.expectedCloseDate ?? "",
      csvValue: (deal) => deal.expectedCloseDate ?? "",
    },
    {
      ...crmDealColumnConfig[7],
      editable: false,
      render: (deal) => <StatusBadge status={deal.status} />,
      sortable: true,
      sortValue: (deal) => deal.status,
      csvValue: (deal) => deal.status,
    },
    {
      ...crmDealColumnConfig[8],
      render: (deal) => <span>{deal.source}</span>,
      sortable: true,
      sortValue: (deal) => deal.source,
      csvValue: (deal) => deal.source,
    },
  ];
}
