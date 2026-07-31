export const IDEA_STATUSES = [
  "captured",
  "reviewing",
  "routed",
  "in_progress",
  "done",
  "deferred",
  "blocked",
] as const;

export const IDEA_PRIORITIES = ["low", "medium", "high", "critical"] as const;

export const IDEA_ROUTE_TYPES = [
  "unrouted",
  "linear",
  "codex",
  "sub_agent",
  "ai_process",
  "project",
  "manual",
] as const;

export const IDEA_SOURCES = [
  "manual",
  "slash_command",
  "ai_assistant",
  "teams",
  "email",
  "screenshot",
  "seed",
] as const;

export type IdeaStatus = (typeof IDEA_STATUSES)[number];
export type IdeaPriority = (typeof IDEA_PRIORITIES)[number];
export type IdeaRouteType = (typeof IDEA_ROUTE_TYPES)[number];
export type IdeaSource = (typeof IDEA_SOURCES)[number];

export type IdeaItem = {
  id: string;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  project_id: number | null;
  title: string;
  body: string;
  status: IdeaStatus;
  priority: IdeaPriority;
  route_type: IdeaRouteType;
  route_target: string | null;
  ai_summary: string | null;
  ai_next_action: string | null;
  linked_linear_issue_id: string | null;
  linked_linear_issue_url: string | null;
  source: IdeaSource;
  source_context: string | null;
  source_url: string | null;
  metadata: Record<string, unknown>;
};

export type CreateIdeaInput = {
  title?: string;
  body: string;
  projectId?: number | null;
  status?: IdeaStatus;
  priority?: IdeaPriority;
  routeType?: IdeaRouteType;
  routeTarget?: string | null;
  aiSummary?: string | null;
  aiNextAction?: string | null;
  linkedLinearIssueId?: string | null;
  linkedLinearIssueUrl?: string | null;
  source?: IdeaSource;
  sourceContext?: string | null;
  sourceUrl?: string | null;
  metadata?: Record<string, unknown>;
};

export type UpdateIdeaInput = Partial<Omit<CreateIdeaInput, "body">> & {
  body?: string;
};
