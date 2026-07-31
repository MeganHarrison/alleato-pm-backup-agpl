export type InsightRow = {
  id: string;
  title: string;
  description: string;
  type: string;
  status: string;
  severity: string;
  confidence: string;
  owner: string;
  project_name: string;
  projectId: number | null;
  next_action: string;
  why_it_matters: string;
  resolved: boolean;
  created_at: string;
};

export const SEVERITY_VARIANT_MAP: Record<string, string> = {
  critical: "destructive",
  high: "destructive",
  medium: "default",
  low: "outline",
};

export const STATUS_VARIANT_MAP: Record<string, string> = {
  open: "destructive",
  blocked: "destructive",
  needs_review: "default",
  stale: "outline",
  resolved: "outline",
};
