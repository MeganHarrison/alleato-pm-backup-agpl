import type { EstimateRow } from "@/lib/schemas/estimates";
import { EstimateStatusLabels } from "@/lib/schemas/estimates";

export const DEFAULT_VISIBLE_COLUMNS = [
  "title",
  "estimate_number",
  "revision",
  "status",
  "estimator",
  "estimate_date",
  "updated_at",
];

export const ESTIMATE_FILTERS = [
  {
    id: "status",
    label: "Status",
    type: "select" as const,
    options: [
      { value: "all", label: "All Statuses" },
      { value: "draft", label: "Draft" },
      { value: "pending_review", label: "Pending Review" },
      { value: "approved", label: "Approved" },
      { value: "rejected", label: "Rejected" },
    ],
  },
];

export function formatDate(date: string | null): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// custom formatting: rounds to whole dollars (no cents) for estimate display
export function formatCurrency(amount: number | null): string {
  if (amount === null || amount === undefined) return "$0.00";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function getStatusColor(status: string): string {
  switch (status) {
    case "approved":
      return "bg-emerald-500";
    case "rejected":
      return "bg-rose-500";
    case "pending_review":
      return "bg-amber-500";
    default:
      return "bg-muted-foreground";
  }
}

export function getStatusLabel(status: string): string {
  return (
    EstimateStatusLabels[status as keyof typeof EstimateStatusLabels] ?? status
  );
}

export function getEstimateSearchableText(item: EstimateRow): string {
  return [
    item.title,
    item.estimate_number ?? "",
    item.estimator ?? "",
    item.location ?? "",
    item.status,
  ]
    .join(" ")
    .toLowerCase();
}
