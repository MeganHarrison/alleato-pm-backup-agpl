export type DataIntegrityState =
  | "confirmed"
  | "estimated"
  | "ai_inference"
  | "incomplete";

export type SourceState = {
  status: "ready" | "incomplete" | "empty" | "error";
  label: string;
  detail: string;
  recoveryHref: string;
};

export type LifecycleMetric = "count" | "value" | "weightedValue";

export type LifecycleStageKey =
  | "lead"
  | "qualification"
  | "estimating"
  | "proposal"
  | "negotiation"
  | "preconstruction"
  | "active"
  | "closeout"
  | "completed";

export type LifecycleStage = {
  key: LifecycleStageKey;
  label: string;
  projectCount: number;
  totalValue: number;
  weightedValue: number;
  percentageOfLifecycle: number;
  valueCoverageCount: number;
  missingValueCount: number;
  averageDaysInStage: null;
  medianDaysInStage: null;
  overdueCount: null;
  conversionRate: null;
  priorPeriodChange: null;
  health: "healthy" | "watch" | "at_risk" | "critical" | "unavailable";
  healthReason: string;
  dataState: DataIntegrityState;
  highestValueProject: string | null;
  mostUrgentProject: string | null;
};

export type ActivityRange = "today" | "24h" | "7d" | "30d";

export type ActivityCategoryKey =
  | "communication"
  | "financial"
  | "project_delivery"
  | "intelligence";

export type ActivityBucket = {
  key: string;
  label: string;
  startAt: string;
  communication: number;
  financial: number;
  project_delivery: number;
  intelligence: number;
};

export type ActivityCategory = {
  key: ActivityCategoryKey;
  label: string;
  total: number;
  requiresActionCount: number;
  highRiskCount: number;
  changePercent: number | null;
  mostActiveProject: string | null;
  anomaly: string | null;
};

export type QuietProject = {
  projectId: number;
  projectName: string;
  lastActivityAt: string | null;
  hoursQuiet: number | null;
  href: string;
};

export type OpportunityCategoryKey =
  | "cost_savings"
  | "revenue_growth"
  | "schedule_acceleration"
  | "risk_reduction"
  | "quality_improvement"
  | "operational_efficiency";

export type OpportunityCategory = {
  key: OpportunityCategoryKey;
  label: string;
  count: number;
  averageConfidence: number;
  urgency: number;
  executiveActionCount: number;
  totalImpact: null;
  priorPeriodChange: null;
  highestPriorityTitle: string | null;
  dataState: "ai_inference";
};

export type ProjectFilterOption = {
  id: number;
  name: string;
};

export type ExecutiveDashboardVisualizations = {
  generatedAt: string;
  filters: {
    range: ActivityRange;
    projectId: number | null;
    projects: ProjectFilterOption[];
  };
  lifecycle: {
    source: SourceState;
    stages: LifecycleStage[];
    totalRecords: number;
    incompleteRecordCount: number;
    valueCoverageCount: number;
    comparisonAvailable: false;
    insight: string;
  };
  activity: {
    source: SourceState;
    range: ActivityRange;
    buckets: ActivityBucket[];
    categories: ActivityCategory[];
    totalEvents: number;
    activeProjectCount: number;
    requiringActionCount: number;
    highRiskCount: number;
    quietProjects: QuietProject[];
    sampled: boolean;
    sourceRecordCount: number;
    insight: string;
  };
  opportunities: {
    source: SourceState;
    categories: OpportunityCategory[];
    activeOpportunityCount: number;
    averageConfidence: number;
    executiveActionCount: number;
    totalOpportunityValue: null;
    comparisonAvailable: false;
    insight: string;
  };
};

export type VisualizationDetailKind =
  | "lifecycle"
  | "activity"
  | "opportunity";

export type VisualizationDetailItem = {
  id: string;
  title: string;
  projectId: number | null;
  projectName: string | null;
  href: string;
  sourceHref: string | null;
  sourceLabel: string;
  timestamp: string | null;
  value: number | null;
  weightedValue: number | null;
  confidence: number | null;
  severity: "neutral" | "watch" | "at_risk" | "critical";
  status: string;
  owner: string | null;
  summary: string;
  nextAction: string | null;
  dataState: DataIntegrityState;
  supportingSources: Array<{
    id: string;
    label: string;
    href: string | null;
    confidence: string;
  }>;
};

export type VisualizationDetailResponse = {
  generatedAt: string;
  kind: VisualizationDetailKind;
  key: string;
  label: string;
  source: SourceState;
  items: VisualizationDetailItem[];
};

export const LIFECYCLE_STAGE_LABELS: Record<LifecycleStageKey, string> = {
  lead: "Lead",
  qualification: "Qualification",
  estimating: "Estimating",
  proposal: "Proposal submitted",
  negotiation: "Contract negotiation",
  preconstruction: "Preconstruction",
  active: "Active construction",
  closeout: "Punch and closeout",
  completed: "Completed",
};

export const LIFECYCLE_STAGE_ORDER = Object.keys(
  LIFECYCLE_STAGE_LABELS,
) as LifecycleStageKey[];

export const ACTIVITY_CATEGORY_LABELS: Record<ActivityCategoryKey, string> = {
  communication: "Communication",
  financial: "Financial",
  project_delivery: "Project delivery",
  intelligence: "Intelligence",
};

export const OPPORTUNITY_CATEGORY_LABELS: Record<OpportunityCategoryKey, string> = {
  cost_savings: "Cost savings",
  revenue_growth: "Revenue growth",
  schedule_acceleration: "Schedule acceleration",
  risk_reduction: "Risk reduction",
  quality_improvement: "Quality improvement",
  operational_efficiency: "Operational efficiency",
};

export function matchesProjectFilter(
  recordProjectId: number | null,
  selectedProjectId: number | null,
) {
  return selectedProjectId === null || recordProjectId === selectedProjectId;
}
