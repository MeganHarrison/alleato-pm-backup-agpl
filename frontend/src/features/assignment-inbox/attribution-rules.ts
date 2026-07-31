export type AttributionRuleType =
  | "title_keyword"
  | "keyword"
  | "phrase"
  | "email"
  | "domain";

export type AttributionRuleStatus = "active" | "inactive";

export interface AssignmentInboxRule {
  id: string;
  projectId: number;
  projectName: string;
  ruleType: AttributionRuleType;
  pattern: string;
  confidence: number;
  priority: number;
  source: string;
  notes: string | null;
  status: AttributionRuleStatus;
  updatedAt: string | null;
}

export interface AssignmentInboxRulesResponse {
  isAdmin: boolean;
  rules: AssignmentInboxRule[];
  counts: {
    active: number;
    inactive: number;
    pendingCandidates: number | null;
  };
}
