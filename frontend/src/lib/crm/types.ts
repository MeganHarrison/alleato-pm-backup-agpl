export type CrmLifecycleStage =
  | "lead"
  | "prospect"
  | "active_client"
  | "past_client"
  | "dormant";

export type CrmHealthStatus = "active" | "watch" | "stale" | "unknown";
export type CrmDealStatus = "open" | "won" | "lost";
export type CrmVisibilityScope = "standard" | "restricted" | "private_source";
export type CrmCandidateStatus =
  | "pending"
  | "accepted"
  | "rejected"
  | "superseded"
  | "withdrawn";

export interface CrmOwner {
  id: string;
  name: string;
  initials: string;
}

export interface CrmAccount {
  companyId: string;
  name: string;
  lifecycleStage: CrmLifecycleStage;
  owner: CrmOwner;
  healthStatus: CrmHealthStatus;
  healthReason: string;
  healthEvaluatedAt: string;
  lastMeaningfulActivityAt: string | null;
  nextFollowUpAt: string | null;
  openDealValue: number;
  rowVersion: number;
}

export interface CrmLead {
  id: string;
  fullName: string;
  prospectCompanyName: string;
  jobTitle: string | null;
  email: string | null;
  phone: string | null;
  websiteUrl: string | null;
  linkedinUrl: string | null;
  facebookUrl: string | null;
  xUrl: string | null;
  photoStoragePath: string | null;
  source: string;
  owner: CrmOwner;
  status: "lead" | "qualified" | "converted" | "disqualified";
  healthStatus: CrmHealthStatus;
  healthReason: string;
  healthEvaluatedAt: string;
  lastMeaningfulActivityAt: string | null;
  nextFollowUpAt: string | null;
  openDealValue: number;
  convertedCompanyId: string | null;
  rowVersion: number;
}

export type CrmRelationshipTarget =
  | { type: "account"; id: string; name: string; owner: CrmOwner }
  | { type: "lead"; id: string; name: string; owner: CrmOwner };

export interface CrmStage {
  id: string;
  name: string;
  sortOrder: number;
  stageType: CrmDealStatus;
  defaultProbability: number;
}

export interface CrmDeal {
  id: string;
  name: string;
  companyId: string | null;
  leadId?: string | null;
  companyName: string;
  owner: CrmOwner;
  stageId: string;
  status: CrmDealStatus;
  valueEstimate: number;
  probability: number;
  expectedCloseDate: string | null;
  closedAt: string | null;
  projectId: number | null;
  projectSyncStatus:
    | "not_started"
    | "pending"
    | "failed"
    | "linked"
    | "erp_synchronized";
  source: string;
  lostReason: string | null;
  forecastCategory?: "pipeline" | "best_case" | "commit" | "omitted";
  pursuitType?:
    | "negotiated"
    | "invited_bid"
    | "public_bid"
    | "service"
    | "other"
    | null;
  bidDueDate?: string | null;
  qualificationScore?: number | null;
  winLossNotes?: string | null;
  updatedAt: string;
  rowVersion: number;
}

export interface CrmActivity {
  id: string;
  companyId: string | null;
  leadId?: string | null;
  companyName: string;
  dealId: string | null;
  activityType: "call" | "email" | "meeting" | "note";
  subject: string;
  occurredAt: string;
  createdBy: string;
  recordOrigin: "manual" | "auto";
  sourceSystem?: "fireflies" | "outlook" | "teams" | null;
  sourceExternalKey?: string | null;
  visibilityScope: CrmVisibilityScope;
}

export interface CrmFollowUp {
  id: string;
  companyId: string | null;
  leadId?: string | null;
  dealId: string | null;
  title: string;
  dueDate: string;
  assignee: string;
  status: "open" | "in_progress" | "blocked" | "done" | "cancelled";
  priority: "low" | "medium" | "high" | "urgent";
}

export interface CrmDealStageEvent {
  id: string;
  dealId: string;
  fromStageId: string | null;
  fromStageName: string | null;
  toStageId: string;
  toStageName: string;
  changedBy: string;
  changedAt: string;
  reason: string | null;
}

export interface CrmActivityCandidate {
  id: string;
  sourceSystem: "fireflies" | "outlook" | "teams";
  sourceExternalKey: string;
  contentHash: string;
  proposedCompanyId: string;
  proposedCompanyName: string;
  subject: string;
  matchConfidence: number;
  matchSignals: string[];
  visibilityScope: CrmVisibilityScope;
  status: CrmCandidateStatus;
  occurredAt: string;
}

export interface CrmSettings {
  meaningfulActivityTypes: Array<CrmActivity["activityType"]>;
  activeDays: number;
  watchDays: number;
  staleDealDays: number;
  reportingTimezone: string;
  autoAcceptEnabled: boolean;
  freeEmailDomains: string[];
}

export interface CrmDashboardMetrics {
  openPipeline: number;
  weightedPipeline: number;
  winRate: number | null;
  overdueFollowUps: number;
  staleRelationships: number;
  activityThisWeek: number;
}

export interface CrmConversionAttempt {
  idempotencyKey: string;
  dealId: string;
  status:
    | "pending"
    | "project_created"
    | "erp_pending"
    | "completed"
    | "failed_recoverable"
    | "failed_permanent";
  projectId: number | null;
  erpExternalId: string | null;
  attemptCount: number;
  errorMessage: string | null;
}

export interface CrmMicrosoftConnection {
  personId: string;
  connectionStatus:
    | "disconnected"
    | "consent_required"
    | "connected"
    | "degraded"
    | "error";
  mailConnected: boolean;
  calendarConnected: boolean;
  grantedScopes: string[];
  privacyMode: "business_only" | "selected_folders" | "disabled";
  automaticMatchingEnabled: boolean;
  lastSuccessfulSyncAt: string | null;
  lastError: string | null;
  updatedAt: string;
}

export interface CrmForecastSnapshot {
  id: string;
  snapshotWeek: string;
  ownerPersonId: string;
  category: "pipeline" | "best_case" | "commit" | "omitted";
  dealCount: number;
  totalValue: number;
  weightedValue: number;
  capturedAt: string;
}

export interface CrmStageRequirement {
  id: string;
  stageId: string;
  label: string;
  requirementKey: string;
  isRequired: boolean;
  guidance: string | null;
  sortOrder: number;
}

export interface CrmSalesAsset {
  id: string;
  assetType: "cadence" | "playbook" | "email_template" | "meeting_template";
  name: string;
  description: string | null;
  steps: Array<Record<string, unknown>>;
  approvalStatus: "draft" | "pending_review" | "approved" | "retired";
  createdByPersonId: string;
  approvedAt: string | null;
}

export interface CrmRelationshipIntelligence {
  id: string;
  companyId: string | null;
  leadId: string | null;
  intelligenceType:
    | "account_plan"
    | "stakeholder"
    | "company_hierarchy"
    | "duplicate_candidate"
    | "subcontractor_qualification"
    | "partner_performance"
    | "buildingconnected_import"
    | "pursuit_outcome";
  title: string;
  status:
    | "draft"
    | "active"
    | "needs_review"
    | "approved"
    | "rejected"
    | "archived";
  details: Record<string, unknown>;
  sourceSystem: "manual" | "buildingconnected_csv" | "alleato_pm" | "crm";
  sourceReference: string | null;
  createdAt: string;
}

export interface CrmAiArtifact {
  id: string;
  artifactType:
    | "deal_summary"
    | "account_summary"
    | "meeting_prep"
    | "task_extraction"
    | "follow_up_draft"
    | "next_best_action"
    | "natural_language_answer"
    | "lead_research";
  companyId: string | null;
  leadId: string | null;
  dealId: string | null;
  title: string;
  content: string;
  citations: Array<Record<string, unknown>>;
  suggestions: Record<string, string>;
  explanation: string;
  reviewStatus: "draft" | "approved" | "rejected" | "applied";
  createdAt: string;
}

export interface CrmOperatingSystem {
  connection: CrmMicrosoftConnection;
  forecastSnapshots: CrmForecastSnapshot[];
  stageRequirements: CrmStageRequirement[];
  salesAssets: CrmSalesAsset[];
  relationshipIntelligence: CrmRelationshipIntelligence[];
  aiArtifacts: CrmAiArtifact[];
}
