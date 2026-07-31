export type UserProfile = {
  id: string;
  email: string;
  full_name: string | null;
};

export type FeedbackItem = {
  id: string;
  category: string | null;
  created_at: string;
  updated_at: string;
  created_by: string;
  project_id: number | null;
  page_url: string;
  page_path: string;
  page_title: string | null;
  target_id: string | null;
  target_selector: string;
  target_text: string | null;
  target_tag: string | null;
  dom_path: string | null;
  target_rect: { x: number; y: number; width: number; height: number } | null;
  title: string;
  comment: string;
  request_type: string;
  severity: string | null;
  status: string;
  screenshot_url: string | null;
  screenshot_path: string | null;
  github_issue_number: number | null;
  github_issue_url: string | null;
  github_issue_state: string | null;
  tool_id?: number | null;
  metadata: Record<string, unknown>;
  submitter: UserProfile;
};

export type FeedbackResourceKind = "file" | "link";

export type FeedbackResource = {
  id: string;
  kind: FeedbackResourceKind;
  label: string;
  url: string;
  path: string | null;
  fileName: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  createdAt: string;
  createdBy: string | null;
};

export type FeedbackComment = {
  id: string;
  feedback_item_id: string;
  author_id: string;
  body: string;
  mentions: string[] | null;
  screenshot_url: string | null;
  created_at: string;
  updated_at: string;
  author: UserProfile;
};

export type GitHubComment = {
  id: number;
  body: string;
  created_at: string;
  updated_at: string;
  user: {
    login: string;
    avatar_url: string;
    type: string; // "User" | "Bot"
  };
  author_association: string;
};

export type StatusFilter =
  | "active"
  | "open"
  | "in_progress"
  | "in_review"
  | "verified"
  | "dispatched"
  | "deferred"
  | "all";

export type DisplayStatus =
  | "open"
  | "in_progress"
  | "pr_created"
  | "in_review"
  | "verified"
  | "deferred"
  | "archived";

export type AgentTarget = "codex" | "claude_code";

export type DispatchHistoryEntry = {
  target: AgentTarget;
  at: string;
  by: string;
  status: string;
  annotationId: string | null;
  trigger?: "github" | "metadata_queue";
  githubIssueUrl?: string | null;
};

export type FeedbackInboxTab = "all" | "issues" | "feature_requests";

export type ToolOption = {
  id: number;
  name: string;
  slug: string;
  category: string;
};

export type ToolContextData = {
  tool_name: string;
  procore_url: string | null;
  prp_path: string | null;
  research_folder: string;
  manifest_path: string;
  crawl_command: string;
};

export type FeedbackListSection = {
  status: DisplayStatus;
  label: string;
  items: FeedbackItem[];
};
