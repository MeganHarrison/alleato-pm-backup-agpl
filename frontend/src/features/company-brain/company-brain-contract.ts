export type BrainHealth =
  | "healthy"
  | "syncing"
  | "warning"
  | "error"
  | "paused"
  | "unknown";

export type BrainEntityKind =
  | "source"
  | "brain"
  | "domain"
  | "agent"
  | "outcome";

export type BrainRange = "24h" | "7d" | "30d";

export type BrainDataState =
  | "ready"
  | "empty"
  | "partial"
  | "error"
  | "permission_limited";

export interface CompanyBrainMetric {
  key:
    | "knowledge_coverage"
    | "connected_sources"
    | "active_agents"
    | "work_created";
  label: string;
  value: number | null;
  displayValue: string;
  context: string;
  status: BrainHealth;
  href?: string;
}

export interface CompanyBrainNode {
  id: string;
  kind: BrainEntityKind;
  name: string;
  description: string;
  status: BrainHealth;
  count: number | null;
  countLabel?: string;
  lastActivityAt: string | null;
  href?: string;
  layout: { x: number; y: number; layer: number };
  permissions: {
    canView: boolean;
    canRetry: boolean;
    canNavigate: boolean;
  };
}

export interface CompanyBrainEdge {
  id: string;
  from: string;
  to: string;
  kind: "ingests" | "enriches" | "informs" | "creates";
  status: BrainHealth;
}

export interface CompanyBrainActivity {
  id: string;
  occurredAt: string;
  type: "knowledge" | "task";
  severity: "info" | "success" | "warning" | "error";
  title: string;
  detail: string;
  entityRef: { kind: BrainEntityKind; id: string; name: string };
  href?: string;
}

export interface CompanyBrainOverview {
  mode: "live" | "fixture";
  generatedAt: string;
  health: BrainHealth;
  state: BrainDataState;
  permissionLimited: boolean;
  latestIngestedAt: string | null;
  metrics: CompanyBrainMetric[];
  nodes: CompanyBrainNode[];
  edges: CompanyBrainEdge[];
  activity: CompanyBrainActivity[];
  failures: Array<{ source: string; message: string }>;
}

export interface CompanyBrainAgentApiItem {
  id: string;
  name: string;
  purpose: string | null;
  slug: string;
  status: string;
  updated_at: string;
  runStats?: {
    lastRun: string | null;
    successRate: number;
    totalRuns: number;
  };
}

export function parseBrainRange(value: string | string[] | undefined): BrainRange {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate === "7d" || candidate === "30d" ? candidate : "24h";
}

export function isBrainFocus(value: string | null): boolean {
  return /^(source|brain|domain|agent|outcome):[a-zA-Z0-9_-]+$/.test(value ?? "");
}
