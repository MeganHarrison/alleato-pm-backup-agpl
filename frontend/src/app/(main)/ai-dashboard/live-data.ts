"use client";

import { useQuery } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api-client";
import type {
  ActivityRange,
  ExecutiveDashboardVisualizations,
  VisualizationDetailKind,
  VisualizationDetailResponse,
} from "@/lib/ai-dashboard/dashboard-visualization-contract";

export type PortfolioProject = {
  projectId: number;
  projectName: string;
  coverage: "ready" | "limited";
  freshness: string;
  sourceEvidenceCount: number;
  healthStatus: string | null;
  projection: {
    updatedAt: string | null;
    projectionGeneratedAt: string | null;
  } | null;
  openAttentionIds: string[];
  openConflictIds: string[];
  limitedReasons: Array<{
    code: string;
    owner: string;
    recoveryPath: string;
  }>;
};

export type PortfolioState = {
  canonicalPacket: {
    id: string;
    generatedAt: string;
    freshness: string;
  };
  projects: PortfolioProject[];
  summary: {
    eligibleProjectCount: number;
    readyProjectCount: number;
    limitedProjectCount: number;
    openAttentionCount: number;
    openConflictCount: number;
  };
};

export type AttentionItem = {
  id: string;
  projectId: number | null;
  category: string;
  title: string;
  summary: string;
  priority: string;
  impactOfDelay: string;
  lifecycle: string;
  accountableOwnerLabel: string;
  dueAt: string | null;
  createdAt: string;
  evidence: Array<{ id: string; sourceOccurredAt: string | null }>;
};

export type AttentionFeed = {
  canonicalPacket: {
    id: string;
    generatedAt: string;
    freshness: string;
    evidenceCount: number;
  };
  items: AttentionItem[];
};

export type SystemHealth = {
  nodes: Array<{
    id: string;
    title: string;
    owner: string;
    health: "healthy" | "exception";
    affectedSurface: string;
  }>;
  exceptions: Array<{
    id: string;
    title: string;
    affectedSurface: string;
    owner: string;
    recoveryPath: string;
    detail: string;
  }>;
};

export type DailyBriefResponse = {
  sourceOfTruth: "intelligence_packets";
  targetSlug: string;
  packet: {
    id: string;
    title: string;
    generatedAt: string | null;
    businessDate: string;
    freshnessStatus: string | null;
    sourceCount: number;
    currentStatus: string | null;
    strategicRead: string | null;
    whyItMatters: string | null;
    recommendedNextMoves: string[];
  };
};

type AgingBucket = { label: string; count: number; total: number };
type AgingResult = {
  current: AgingBucket;
  days31to60: AgingBucket;
  days61to90: AgingBucket;
  days90plus: AgingBucket;
  totalOutstanding: number;
};

export type AccountingDashboard = {
  arAging: AgingResult;
  apAging: AgingResult;
  cashPosition: {
    totalArOutstanding: number;
    totalApOutstanding: number;
    netCashPosition: number;
    paymentsReceivedThisMonth: number;
    checksIssuedThisMonth: number;
  };
  monthlyRevenueMargin: Array<{
    month: string;
    revenue: number;
    cost: number;
    netMargin: number;
    netMarginPercent: number | null;
  }>;
  revenueByProject?: Array<{
    projectCode: string;
    description: string | null;
    customer: string | null;
    totalInvoiced: number;
    totalCollected: number;
    outstandingBalance: number;
  }>;
  costBreakdownSeries?: {
    byDivision: Array<{ groupLabel: string; totalCost: number }>;
    byAccount: Array<{ groupLabel: string; totalCost: number }>;
  };
  reconciliation: {
    duplicateCount: number;
    onHoldCount: number;
    syncIssueCount: number;
    dollarsAtRisk: number;
    lastRunAt: string | null;
  };
  generatedAt: string;
};

export type WipRow = {
  projectCode: string;
  projectDescription: string | null;
  customer: string | null;
  contractValue: number;
  costsToDate: number;
  earnedRevenue: number;
  billedToDate: number;
  overUnderBilling: number;
  forecastGrossProfit: number;
  forecastGrossMarginPct: number;
  wipPosition: "overbilled" | "underbilled" | "balanced";
  latestSyncAt: string | null;
};

export type WipResponse = {
  rows: WipRow[];
  summary: {
    projectCount: number;
    contractValue: number;
    revisedCostBudget: number;
    costsToDate: number;
    estimatedFinalCost: number;
    earnedRevenue: number;
    billedToDate: number;
    overUnderBilling: number;
    forecastGrossProfit: number;
  };
  forecastDataAvailable: boolean;
  generatedAt: string;
};

export type DocumentLifecycleResponse = {
  documents: Array<{
    id: string;
    title: string | null;
    created_at: string | null;
    project_name: string | null;
    lifecycle_label: string;
    pipeline_stage: string;
    task_count: number;
    error_message: string | null;
  }>;
  total: number;
};

export type RagPipelineRange = "24h" | "3d" | "7d" | "30d";

export type RagPipelineSummary = {
  generatedAt: string;
  range: RagPipelineRange;
  sources: Array<{
    key: "meetings" | "teams" | "emails" | "sharepoint";
    label: string;
    vectorized: number;
    received: number;
    sourceTableHref: string;
  }>;
};

const queryDefaults = {
  staleTime: 60_000,
  retry: 1,
} as const;

export function usePortfolioState() {
  return useQuery({
    queryKey: ["ai-dashboard", "portfolio-state"],
    queryFn: () => apiFetch<PortfolioState>("/api/executive/portfolio-state"),
    ...queryDefaults,
  });
}

export function useAttentionFeed() {
  return useQuery({
    queryKey: ["ai-dashboard", "attention"],
    queryFn: () => apiFetch<AttentionFeed>("/api/executive/attention"),
    ...queryDefaults,
  });
}

export function useSystemHealth() {
  return useQuery({
    queryKey: ["ai-dashboard", "system-health"],
    queryFn: () => apiFetch<SystemHealth>("/api/executive/system-health"),
    ...queryDefaults,
  });
}

export function useDailyBrief() {
  return useQuery({
    queryKey: ["ai-dashboard", "daily-brief"],
    queryFn: () =>
      apiFetch<DailyBriefResponse>("/api/executive/daily-brief/widget"),
    ...queryDefaults,
  });
}

export function useAccountingDashboard() {
  return useQuery({
    queryKey: ["ai-dashboard", "accounting"],
    queryFn: () => apiFetch<AccountingDashboard>("/api/accounting/dashboard"),
    ...queryDefaults,
  });
}

export function useWipPortfolio() {
  return useQuery({
    queryKey: ["ai-dashboard", "wip"],
    queryFn: () => apiFetch<WipResponse>("/api/accounting/wip"),
    ...queryDefaults,
  });
}

export function useDocumentLifecycle() {
  return useQuery({
    queryKey: ["ai-dashboard", "document-lifecycle"],
    queryFn: () =>
      apiFetch<DocumentLifecycleResponse>(
        "/api/documents/status?type=meeting&source=fireflies&per_page=100",
      ),
    ...queryDefaults,
  });
}

export function useRagPipeline(range: RagPipelineRange) {
  return useQuery({
    queryKey: ["ai-dashboard", "rag-pipeline", range],
    queryFn: () => apiFetch<RagPipelineSummary>(`/api/ai-dashboard/rag-pipeline?range=${range}`),
    ...queryDefaults,
  });
}

export function useDashboardVisualizations(
  range: ActivityRange,
  projectId: number | null,
) {
  const params = new URLSearchParams({ range });
  if (projectId !== null) params.set("projectId", String(projectId));

  return useQuery({
    queryKey: ["ai-dashboard", "visualizations", range, projectId],
    queryFn: () =>
      apiFetch<ExecutiveDashboardVisualizations>(
        `/api/ai-dashboard/visualizations?${params.toString()}`,
      ),
    ...queryDefaults,
  });
}

export function useVisualizationDetail(
  kind: VisualizationDetailKind,
  key: string | null,
  range: ActivityRange,
  projectId: number | null,
) {
  const params = new URLSearchParams({ range, detail: kind });
  if (key) params.set("key", key);
  if (projectId !== null) params.set("projectId", String(projectId));

  return useQuery({
    queryKey: ["ai-dashboard", "visualization-detail", kind, key, range, projectId],
    queryFn: () =>
      apiFetch<VisualizationDetailResponse>(
        `/api/ai-dashboard/visualizations?${params.toString()}`,
      ),
    enabled: Boolean(key),
    ...queryDefaults,
  });
}

export function formatCurrency(value: number, compact = false) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: compact ? 1 : 0,
  }).format(value);
}

export function formatDate(value: string | null | undefined) {
  if (!value) return "Unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unavailable";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return "Unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unavailable";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function sourceError(error: unknown, source: string) {
  const detail = error instanceof Error ? error.message : "Unknown source error.";
  return `${source} could not be loaded. ${detail}`;
}
