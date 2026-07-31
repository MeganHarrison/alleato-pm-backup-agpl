import Link from "next/link";

import {
  type ColumnConfig,
  type FilterConfig,
  type TableColumn,
} from "@/components/tables/unified";
import {
  aiFeatureCatalog,
  type AiFeatureCategory,
  type AiFeatureDetail,
} from "@/features/ai/ai-feature-catalog";

export type AiFeature = AiFeatureDetail;
export const aiFeatures = aiFeatureCatalog;

export const aiFeatureColumns: ColumnConfig[] = [
  { id: "name", label: "Feature", alwaysVisible: true },
  { id: "summary", label: "What it helps with", defaultVisible: true },
  { id: "category", label: "Category", defaultVisible: true },
  { id: "workflow", label: "Workflow", defaultVisible: true },
];

export const aiFeatureDefaultVisibleColumns = aiFeatureColumns
  .filter((column) => column.alwaysVisible || column.defaultVisible)
  .map((column) => column.id);

export const aiFeatureFilters: FilterConfig[] = [
  {
    id: "category",
    label: "Category",
    type: "select",
    options: [
      { value: "assistant", label: "Assistant" },
      { value: "financial", label: "Financial intelligence" },
      { value: "governance", label: "Governance" },
      { value: "knowledge", label: "Knowledge" },
      { value: "personalization", label: "Personalization" },
    ],
  },
];

function categoryLabel(category: AiFeatureCategory) {
  const labels: Record<AiFeatureCategory, string> = {
    assistant: "Assistant",
    financial: "Financial intelligence",
    governance: "Governance",
    knowledge: "Knowledge",
    personalization: "Personalization",
  };

  return labels[category];
}

export function buildAiFeatureTableColumns(): TableColumn<AiFeature>[] {
  return [
    {
      id: "name",
      label: "Feature",
      alwaysVisible: true,
      sortable: true,
      sortValue: (feature) => feature.name,
      csvValue: (feature) => feature.name,
      render: (feature) => (
        <Link
          href={feature.href}
          title={feature.name}
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          {feature.name}
        </Link>
      ),
      width: 280,
    },
    {
      id: "summary",
      label: "What it helps with",
      defaultVisible: true,
      sortable: true,
      sortValue: (feature) => feature.summary,
      csvValue: (feature) => feature.summary,
      render: (feature) => (
        <span title={feature.summary} className="text-sm text-muted-foreground">
          {feature.summary}
        </span>
      ),
    },
    {
      id: "category",
      label: "Category",
      defaultVisible: true,
      sortable: true,
      sortValue: (feature) => feature.category,
      csvValue: (feature) => categoryLabel(feature.category),
      render: (feature) => (
        <span className="text-sm text-muted-foreground">
          {categoryLabel(feature.category)}
        </span>
      ),
      width: 160,
    },
    {
      id: "workflow",
      label: "Workflow",
      defaultVisible: true,
      sortable: true,
      sortValue: (feature) => feature.workflow,
      csvValue: (feature) => feature.workflow,
      render: (feature) => (
        <span className="text-sm text-muted-foreground">
          {feature.workflow}
        </span>
      ),
      width: 210,
    },
  ];
}
