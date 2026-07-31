import type { Json, Tables } from "@/types/database.types";

export type FeatureRequestType =
  | "new_feature"
  | "workflow_improvement"
  | "bug"
  | "report_dashboard"
  | "automation"
  | "ai_assistant_capability"
  | "data_cleanup"
  | "integration"
  | "permission_admin";

export type FeatureRequestStatus =
  | "captured"
  | "needs_clarification"
  | "ready_for_planning"
  | "plan_generated"
  | "linear_drafted"
  | "ready_for_build"
  | "handoff_generated"
  | "sent_to_claude_code"
  | "in_progress"
  | "ready_for_review"
  | "accepted"
  | "rejected";

export type ReadinessLevel = "low" | "medium" | "high";
export type AcceptanceStatus = "missing" | "partial" | "complete";
export type ImplementationRisk = "low" | "medium" | "high";
export type FeatureRequestPriority = "low" | "medium" | "high" | "critical";
export type LinearSyncStatus = "not_started" | "drafted" | "created" | "synced" | "blocked";
export type LinearSubIssueStatus = "draft" | "created" | "synced" | "blocked";

export type FeatureRequestRow = Tables<"feature_requests">;
export type FeatureRequestEventRow = Tables<"feature_request_events">;
export type FeatureRequestLinearEventRow = Tables<"feature_request_linear_events">;
export type FeatureRequestLinearSubIssueRow = Tables<"feature_request_linear_sub_issues">;
export type ImplementationPlanRow = Tables<"implementation_plans">;
export type ExecutionHandoffRow = Tables<"execution_handoffs">;

export type JsonList = Json[];

export type FeatureRequestPacketInput = {
  title?: string;
  requesterName?: string;
  requesterUserId?: string | null;
  requesterPersonId?: string | null;
  source?: string;
  projectId?: number | null;
  companyId?: string | null;
  requestType?: FeatureRequestType;
  rawRequest: string;
  assistantSummary?: string;
  stakeholderProblem?: string | null;
  desiredOutcome?: string | null;
  affectedUsers?: string[];
  affectedPages?: string[];
  affectedWorkflows?: string[];
  acceptanceCriteria?: string[];
  verificationSteps?: string[];
  openQuestions?: string[];
  assumptions?: string[];
  priority?: FeatureRequestPriority;
  linearIssueId?: string | null;
  linearIssueUrl?: string | null;
  linearDraftBody?: string | null;
  linearSyncStatus?: LinearSyncStatus | null;
  linearLastSyncedAt?: string | null;
  linearSyncError?: string | null;
  sourceSessionId?: string | null;
  sourceMessageId?: string | null;
  sourceMetadata?: Record<string, Json>;
  createdBy?: string | null;
};

export type FeatureRequestUpdateInput = Partial<
  Omit<FeatureRequestPacketInput, "rawRequest" | "createdBy">
> & {
  rawRequest?: string;
  status?: FeatureRequestStatus;
  readyForBuild?: boolean;
  updatedBy?: string | null;
};

export type FeatureRequestReadiness = {
  readyForBuild: boolean;
  status: FeatureRequestStatus;
  label: string;
  missingRequirements: string[];
  goalClarity: ReadinessLevel;
  dataClarity: ReadinessLevel;
  uxClarity: ReadinessLevel;
  acceptanceStatus: AcceptanceStatus;
  implementationRisk: ImplementationRisk;
  blockedMessage: string | null;
};

export type ImplementationPlanInput = {
  summary?: string;
  affectedRoutes?: string[];
  affectedComponents?: string[];
  affectedTables?: string[];
  dataRequirements?: string[];
  implementationSteps?: string[];
  acceptanceCriteria?: string[];
  verificationSteps?: string[];
  risks?: string[];
  openQuestions?: string[];
  generatedBy?: string | null;
};

export type LinearIssueDraft = {
  title: string;
  body: string;
};

export type LinearSubIssueDraftInput = {
  title: string;
  body: string;
  sourceStep?: string | null;
  sortOrder?: number;
};

export type FeatureRequestDetail = {
  request: FeatureRequestRow;
  events: FeatureRequestEventRow[];
  linearEvents: FeatureRequestLinearEventRow[];
  linearSubIssues: FeatureRequestLinearSubIssueRow[];
  latestPlan: ImplementationPlanRow | null;
  handoffs: ExecutionHandoffRow[];
};

export type FeatureRequestPacketWidgetPayload = {
  type: "feature_request_packet";
  id: string;
  title: string;
  requestId: string;
  status: FeatureRequestStatus;
  readinessLabel: string;
  readyForBuild: boolean;
  openQuestions: string[];
  acceptanceCriteriaCount: number;
  linearIssueUrl?: string | null;
  linearSyncStatus?: string | null;
  handoffPath?: string | null;
  detailHref: string;
};
