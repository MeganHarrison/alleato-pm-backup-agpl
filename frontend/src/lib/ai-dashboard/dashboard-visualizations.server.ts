import "server-only";

import { unstable_cache } from "next/cache";

import { createServiceClient } from "@/lib/supabase/service";
import type { Database, Json } from "@/types/database.types";

import {
  ACTIVITY_CATEGORY_LABELS,
  LIFECYCLE_STAGE_LABELS,
  LIFECYCLE_STAGE_ORDER,
  matchesProjectFilter,
  OPPORTUNITY_CATEGORY_LABELS,
  type ActivityBucket,
  type ActivityCategory,
  type ActivityCategoryKey,
  type ActivityRange,
  type DataIntegrityState,
  type ExecutiveDashboardVisualizations,
  type LifecycleStage,
  type LifecycleStageKey,
  type OpportunityCategory,
  type OpportunityCategoryKey,
  type ProjectFilterOption,
  type QuietProject,
  type SourceState,
  type VisualizationDetailItem,
  type VisualizationDetailKind,
  type VisualizationDetailResponse,
} from "./dashboard-visualization-contract";

type ProjectRow = Pick<
  Database["public"]["Tables"]["projects"]["Row"],
  | "id"
  | "name"
  | "stage"
  | "phase"
  | "budget"
  | "completion_percentage"
  | "health_status"
  | "created_at"
  | "project_manager"
>;
// Sourced from crm_deals since 2026-07-23 (the legacy `prospects` table was
// dropped — shared-identity CRM). Deals are mapped into this legacy row shape
// so the lifecycle funnel logic stays unchanged.
type ProspectRow = {
  id: string;
  company_name: string;
  status: string | null;
  estimated_project_value: number | null;
  probability: number | null;
  // crm_deals.created_at/updated_at are NOT NULL.
  created_at: string;
  updated_at: string;
  project_id: number | null;
  assigned_to: string | null;
  next_follow_up: string | null;
};

type DealSourceRow = {
  id: string;
  name: string;
  value: number | null;
  status: string;
  expected_close_date: string | null;
  created_at: string;
  updated_at: string;
  stage: { name: string } | null;
  company: { name: string } | null;
  owner: { first_name: string | null; last_name: string | null } | null;
};

function dealToProspectRow(row: DealSourceRow): ProspectRow {
  return {
    id: row.id,
    company_name: row.company?.name ?? row.name,
    status: row.stage?.name ?? null,
    estimated_project_value: row.value,
    probability: null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    project_id: null,
    assigned_to: row.owner
      ? [row.owner.first_name, row.owner.last_name].filter(Boolean).join(" ") || null
      : null,
    next_follow_up: row.expected_close_date,
  };
}
type TargetRow = Pick<
  Database["public"]["Tables"]["intelligence_targets"]["Row"],
  "id" | "project_id" | "name"
>;
type InsightRow = Pick<
  Database["public"]["Tables"]["insight_cards"]["Row"],
  | "id"
  | "primary_target_id"
  | "title"
  | "summary"
  | "why_it_matters"
  | "card_type"
  | "confidence"
  | "current_status"
  | "next_action"
  | "suggested_owner_label"
  | "source_count"
  | "created_at"
  | "updated_at"
  | "metadata"
>;
type ActivityViewRow = Database["public"]["Views"]["project_activity_view"]["Row"];
type DocumentRow = Pick<
  Database["public"]["Tables"]["document_metadata"]["Row"],
  | "id"
  | "project_id"
  | "document_type"
  | "source_system"
  | "created_at"
  | "status"
  | "title"
  | "source_web_url"
  | "fireflies_link"
>;
type TaskRow = Pick<
  Database["public"]["Tables"]["tasks"]["Row"],
  | "id"
  | "project_id"
  | "source_system"
  | "status"
  | "priority"
  | "created_at"
  | "updated_at"
  | "title"
  | "description"
  | "assignee_name"
  | "due_date"
>;
type ChangeEventRow = Pick<
  Database["public"]["Tables"]["change_events"]["Row"],
  "id" | "project_id" | "title" | "status" | "created_at" | "updated_at" | "expecting_revenue"
>;
type RfiRow = Pick<
  Database["public"]["Tables"]["rfis"]["Row"],
  "id" | "project_id" | "subject" | "status" | "created_at" | "updated_at" | "cost_impact" | "schedule_impact" | "ball_in_court"
>;
type SubmittalRow = Pick<
  Database["public"]["Tables"]["submittals"]["Row"],
  "id" | "project_id" | "title" | "status" | "created_at" | "updated_at" | "priority" | "final_due_date" | "ball_in_court"
>;
type DailyLogRow = Pick<
  Database["public"]["Tables"]["daily_logs"]["Row"],
  "id" | "project_id" | "log_date" | "created_at"
>;
type PunchItemRow = Pick<
  Database["public"]["Tables"]["punch_items"]["Row"],
  "id" | "project_id" | "title" | "status" | "created_at" | "updated_at" | "priority"
>;
type EvidenceRow = Pick<
  Database["public"]["Tables"]["insight_card_evidence"]["Row"],
  "id" | "insight_card_id" | "source_document_id" | "source_title" | "source_type" | "confidence"
>;

type QueryFailure = { message: string };
type SourceResult<T> = {
  rows: T[];
  count: number;
  error: QueryFailure | null;
};

type LifecycleRecord = {
  id: string;
  source: "project" | "prospect";
  projectId: number | null;
  name: string;
  stage: LifecycleStageKey | null;
  value: number | null;
  weightedValue: number | null;
  health: string | null;
  owner: string | null;
  status: string;
  createdAt: string;
  nextAction: string | null;
  dataState: DataIntegrityState;
};

type ActivityEvent = {
  id: string;
  category: ActivityCategoryKey;
  type: string;
  projectId: number | null;
  projectName: string | null;
  timestamp: string;
  title: string;
  summary: string;
  status: string;
  owner: string | null;
  href: string;
  sourceHref: string | null;
  sourceLabel: string;
  severity: VisualizationDetailItem["severity"];
  requiresAction: boolean;
  dataState: DataIntegrityState;
};

const ACTIVE_INSIGHT_STATUSES = ["open", "blocked", "needs_review", "stale"];
const OPPORTUNITY_CARD_TYPES = [
  "initiative_signal",
  "financial_exposure",
  "schedule_risk",
  "change_management",
  "process_issue",
  "risk",
  "blocker",
];

const activityRangeMs: Record<ActivityRange, number> = {
  today: 24 * 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
};

function sourceResult<T>(result: {
  data: T[] | null;
  count?: number | null;
  error: QueryFailure | null;
}): SourceResult<T> {
  return {
    rows: result.data ?? [],
    count: result.count ?? result.data?.length ?? 0,
    error: result.error,
  };
}

function normalized(value: string | null | undefined) {
  return value?.trim().toLowerCase().replace(/[_-]+/g, " ") ?? "";
}

function projectStage(row: ProjectRow): { stage: LifecycleStageKey | null; state: DataIntegrityState } {
  const stage = normalized(row.stage);
  const phase = normalized(row.phase);
  if (phase === "estimating" || stage === "bidding" || stage === "estimating") {
    return { stage: "estimating", state: "confirmed" };
  }
  if (stage.includes("pre construction") || phase === "planning") {
    return { stage: "preconstruction", state: "confirmed" };
  }
  if (phase === "development") {
    return { stage: "preconstruction", state: "ai_inference" };
  }
  if (stage.includes("punch") || stage.includes("closeout")) {
    return { stage: "closeout", state: "confirmed" };
  }
  if (phase === "current" || stage === "current" || stage.includes("course of construction")) {
    return (row.completion_percentage ?? 0) >= 90
      ? { stage: "closeout", state: "estimated" }
      : { stage: "active", state: "confirmed" };
  }
  if (["complete", "archive", "archived"].includes(phase) || stage === "completed") {
    return { stage: "completed", state: phase === "complete" ? "confirmed" : "ai_inference" };
  }
  return { stage: null, state: "incomplete" };
}

function prospectStage(row: ProspectRow): LifecycleStageKey | null {
  const status = normalized(row.status);
  if (["lead", "new", "contacted"].includes(status)) return "lead";
  if (["qualification", "qualified", "discovery"].includes(status)) return "qualification";
  if (["estimating", "estimate", "bidding"].includes(status)) return "estimating";
  if (["proposal", "proposal submitted", "submitted"].includes(status)) return "proposal";
  if (["negotiation", "contract negotiation"].includes(status)) return "negotiation";
  if (["won", "awarded", "preconstruction"].includes(status)) return "preconstruction";
  return null;
}

function probability(value: number | null) {
  if (value === null) return null;
  return Math.max(0, Math.min(1, value > 1 ? value / 100 : value));
}

function lifecycleRecords(projects: ProjectRow[], prospects: ProspectRow[]): LifecycleRecord[] {
  const projectRecords = projects.map((row): LifecycleRecord => {
    const mapped = projectStage(row);
    return {
      id: `project-${row.id}`,
      source: "project",
      projectId: row.id,
      name: row.name?.trim() || `Project ${row.id}`,
      stage: mapped.stage,
      value: row.budget,
      weightedValue: row.budget,
      health: row.health_status,
      owner: row.project_manager ? `Project manager ${row.project_manager}` : null,
      status: row.phase || row.stage || "Lifecycle stage missing",
      createdAt: row.created_at,
      nextAction: mapped.stage ? null : "Assign a lifecycle stage",
      dataState: mapped.state,
    };
  });
  const prospectRecords = prospects.map((row): LifecycleRecord => {
    const mappedStage = prospectStage(row);
    const chance = probability(row.probability);
    return {
      id: `prospect-${row.id}`,
      source: "prospect",
      projectId: row.project_id,
      name: row.company_name,
      stage: mappedStage,
      value: row.estimated_project_value,
      weightedValue:
        row.estimated_project_value !== null && chance !== null
          ? row.estimated_project_value * chance
          : null,
      health: null,
      owner: row.assigned_to,
      status: row.status || "Lifecycle stage missing",
      createdAt: row.updated_at || row.created_at,
      nextAction: row.next_follow_up,
      dataState: mappedStage ? "estimated" : "incomplete",
    };
  });
  return [...prospectRecords, ...projectRecords];
}

function severityFromHealth(value: string | null): VisualizationDetailItem["severity"] {
  const health = normalized(value);
  if (health.includes("critical") || health.includes("red")) return "critical";
  if (health.includes("risk") || health.includes("blocked")) return "at_risk";
  if (health.includes("watch") || health.includes("yellow")) return "watch";
  return "neutral";
}

function buildLifecycle(
  projects: SourceResult<ProjectRow>,
  prospects: SourceResult<ProspectRow>,
): ExecutiveDashboardVisualizations["lifecycle"] {
  if (projects.error) {
    return {
      source: {
        status: "error",
        label: "Project lifecycle",
        detail: `Projects could not be loaded. ${projects.error.message}`,
        recoveryHref: "/projects",
      },
      stages: [],
      totalRecords: 0,
      incompleteRecordCount: 0,
      valueCoverageCount: 0,
      comparisonAvailable: false,
      insight: "Lifecycle analysis is unavailable until the project source recovers.",
    };
  }
  const records = lifecycleRecords(projects.rows, prospects.rows);
  const mapped = records.filter((record) => record.stage !== null);
  const valueCoverageCount = records.filter((record) => record.value !== null).length;
  const stages = LIFECYCLE_STAGE_ORDER.map((key): LifecycleStage => {
    const rows = mapped.filter((record) => record.stage === key);
    const totalValue = rows.reduce((sum, row) => sum + (row.value ?? 0), 0);
    const weightedValue = rows.reduce((sum, row) => sum + (row.weightedValue ?? 0), 0);
    const severities = rows.map((row) => severityFromHealth(row.health));
    const health = severities.includes("critical")
      ? "critical"
      : severities.includes("at_risk")
        ? "at_risk"
        : rows.some((row) => row.value === null || row.dataState !== "confirmed")
          ? "watch"
          : rows.length
            ? "healthy"
            : "unavailable";
    const highest = [...rows]
      .filter((row) => row.value !== null)
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))[0];
    const urgent = [...rows].sort(
      (a, b) =>
        ["neutral", "watch", "at_risk", "critical"].indexOf(severityFromHealth(b.health)) -
        ["neutral", "watch", "at_risk", "critical"].indexOf(severityFromHealth(a.health)),
    )[0];
    return {
      key,
      label: LIFECYCLE_STAGE_LABELS[key],
      projectCount: rows.length,
      totalValue,
      weightedValue,
      percentageOfLifecycle: mapped.length ? (rows.length / mapped.length) * 100 : 0,
      valueCoverageCount: rows.filter((row) => row.value !== null).length,
      missingValueCount: rows.filter((row) => row.value === null).length,
      averageDaysInStage: null,
      medianDaysInStage: null,
      overdueCount: null,
      conversionRate: null,
      priorPeriodChange: null,
      health,
      healthReason:
        health === "unavailable"
          ? "No current records"
          : health === "watch"
            ? "Values or lifecycle mapping need review"
            : health === "healthy"
              ? "No current health exception"
              : "One or more projects carry a current health exception",
      dataState: rows.some((row) => row.dataState === "ai_inference")
        ? "ai_inference"
        : rows.some((row) => row.dataState === "estimated")
          ? "estimated"
          : rows.some((row) => row.dataState === "incomplete")
            ? "incomplete"
            : "confirmed",
      highestValueProject: highest?.name ?? null,
      mostUrgentProject: urgent?.name ?? null,
    };
  });
  const bottleneck = [...stages]
    .filter((stage) => !["completed", "lead"].includes(stage.key) && stage.projectCount > 0)
    .sort((a, b) => b.projectCount - a.projectCount)[0];
  const incompleteReasons = [
    prospects.error ? "Prospect data is unavailable" : prospects.rows.length === 0 ? "No prospect lifecycle records are present" : null,
    records.length > valueCoverageCount ? `${records.length - valueCoverageCount} records have no value` : null,
    "Stage-transition history is not recorded",
  ].filter(Boolean);
  return {
    source: {
      status: incompleteReasons.length ? "incomplete" : records.length ? "ready" : "empty",
      label: "Project lifecycle",
      detail: incompleteReasons.join(". ") || "Current lifecycle records are available.",
      recoveryHref: "/projects",
    },
    stages,
    totalRecords: records.length,
    incompleteRecordCount: records.filter((record) => record.stage === null).length,
    valueCoverageCount,
    comparisonAvailable: false,
    insight: bottleneck
      ? `${bottleneck.label} contains ${bottleneck.projectCount} current records. Transition age is unavailable, so open the stage before treating it as a confirmed bottleneck.`
      : "No populated operating stage is available for bottleneck analysis.",
  };
}

function projectHref(projectId: number | null) {
  return projectId ? `/${projectId}/home` : "/projects";
}

function documentEvent(row: DocumentRow, projectNames: Map<number, string>): ActivityEvent | null {
  if (!row.created_at) return null;
  const source = normalized(row.source_system);
  const type = normalized(row.document_type);
  const isCommunication = ["outlook", "outlook email", "teams dm", "teams", "fireflies"].some(
    (value) => source.includes(value),
  );
  const sourceLabel = source.includes("teams")
    ? "Teams"
    : source.includes("outlook")
      ? "Email"
      : source.includes("fireflies") || type.includes("meeting")
        ? "Meeting"
        : type.includes("drawing")
          ? "Drawing"
          : type.includes("submittal")
            ? "Submittal"
            : "Document";
  const href = row.project_id
    ? sourceLabel === "Meeting"
      ? `/${row.project_id}/meetings/${row.id}`
      : sourceLabel === "Email"
        ? `/${row.project_id}/emails`
        : `/${row.project_id}/documents`
    : "/knowledge/app";
  return {
    id: `document-${row.id}`,
    category: isCommunication ? "communication" : "project_delivery",
    type: sourceLabel,
    projectId: row.project_id,
    projectName: row.project_id ? projectNames.get(row.project_id) ?? null : null,
    timestamp: row.created_at,
    title: row.title?.trim() || sourceLabel,
    summary: `${sourceLabel} source record entered the knowledge pipeline.`,
    status: row.status || "Recorded",
    owner: null,
    href,
    sourceHref: row.fireflies_link || row.source_web_url,
    sourceLabel,
    severity: row.status?.includes("fail") ? "at_risk" : "neutral",
    requiresAction: row.status?.includes("fail") ?? false,
    dataState: row.status?.includes("fail") ? "incomplete" : "confirmed",
  };
}

function insightSeverity(row: InsightRow): VisualizationDetailItem["severity"] {
  if (row.current_status === "blocked") return "critical";
  if (["financial_exposure", "schedule_risk", "blocker"].includes(row.card_type)) return "at_risk";
  if (["needs_review", "stale"].includes(row.current_status)) return "watch";
  return "neutral";
}

function buildActivityEvents(args: {
  documents: DocumentRow[];
  tasks: TaskRow[];
  changeEvents: ChangeEventRow[];
  rfis: RfiRow[];
  submittals: SubmittalRow[];
  dailyLogs: DailyLogRow[];
  punchItems: PunchItemRow[];
  insights: InsightRow[];
  targetProjects: Map<string, number | null>;
  projectNames: Map<number, string>;
}): ActivityEvent[] {
  const events: ActivityEvent[] = [];
  for (const row of args.documents) {
    const event = documentEvent(row, args.projectNames);
    if (event) events.push(event);
  }
  for (const row of args.tasks) {
    events.push({
      id: `task-${row.id}`,
      category: "intelligence",
      type: "Action item",
      projectId: row.project_id,
      projectName: row.project_id ? args.projectNames.get(row.project_id) ?? null : null,
      timestamp: row.updated_at,
      title: row.title?.trim() || row.description,
      summary: row.description,
      status: row.status,
      owner: row.assignee_name,
      href: row.project_id ? `/${row.project_id}/tasks` : "/tasks",
      sourceHref: null,
      sourceLabel: row.source_system,
      severity: normalized(row.priority).includes("high") ? "at_risk" : "watch",
      requiresAction: row.status === "open",
      dataState: row.source_system === "manual" ? "confirmed" : "ai_inference",
    });
  }
  for (const row of args.changeEvents) {
    events.push({
      id: `change-event-${row.id}`,
      category: "financial",
      type: "Change event",
      projectId: row.project_id,
      projectName: args.projectNames.get(row.project_id) ?? null,
      timestamp: row.updated_at,
      title: row.title,
      summary: row.expecting_revenue ? "Revenue is expected from this change event." : "Change event activity recorded.",
      status: row.status,
      owner: null,
      href: `/${row.project_id}/change-events/${row.id}`,
      sourceHref: null,
      sourceLabel: "Change events",
      severity: ["open", "pending"].includes(normalized(row.status)) ? "watch" : "neutral",
      requiresAction: !["closed", "approved", "void"].includes(normalized(row.status)),
      dataState: "confirmed",
    });
  }
  for (const row of args.rfis) {
    const impacted = Boolean(row.cost_impact || row.schedule_impact);
    events.push({
      id: `rfi-${row.id}`,
      category: "project_delivery",
      type: "RFI",
      projectId: row.project_id,
      projectName: args.projectNames.get(row.project_id) ?? null,
      timestamp: row.updated_at,
      title: row.subject,
      summary: impacted ? "This RFI carries a recorded cost or schedule impact." : "RFI activity recorded.",
      status: row.status,
      owner: row.ball_in_court,
      href: `/${row.project_id}/rfis/${row.id}`,
      sourceHref: null,
      sourceLabel: "RFIs",
      severity: impacted ? "at_risk" : "neutral",
      requiresAction: !["closed", "answered"].includes(normalized(row.status)),
      dataState: "confirmed",
    });
  }
  for (const row of args.submittals) {
    const overdue = Boolean(row.final_due_date && new Date(row.final_due_date).getTime() < Date.now());
    events.push({
      id: `submittal-${row.id}`,
      category: "project_delivery",
      type: "Submittal",
      projectId: row.project_id,
      projectName: args.projectNames.get(row.project_id) ?? null,
      timestamp: row.updated_at || row.created_at || new Date(0).toISOString(),
      title: row.title,
      summary: overdue ? "The recorded final due date has passed." : "Submittal activity recorded.",
      status: row.status || "Recorded",
      owner: row.ball_in_court,
      href: `/${row.project_id}/submittals/${row.id}`,
      sourceHref: null,
      sourceLabel: "Submittals",
      severity: overdue ? "at_risk" : normalized(row.priority).includes("high") ? "watch" : "neutral",
      requiresAction: !["approved", "closed"].includes(normalized(row.status)),
      dataState: "confirmed",
    });
  }
  for (const row of args.dailyLogs) {
    const dailyLogTimestamp =
      row.created_at ||
      (row.log_date ? `${row.log_date}T12:00:00Z` : new Date(0).toISOString());
    events.push({
      id: `daily-log-${row.id}`,
      category: "project_delivery",
      type: "Daily log",
      projectId: row.project_id,
      projectName: row.project_id ? args.projectNames.get(row.project_id) ?? null : null,
      timestamp: dailyLogTimestamp,
      title: row.log_date ? `Daily log for ${row.log_date}` : "Daily log",
      summary: "Field activity was recorded.",
      status: "Recorded",
      owner: null,
      href: row.project_id ? `/${row.project_id}/daily-log` : "/projects",
      sourceHref: null,
      sourceLabel: "Daily logs",
      severity: "neutral",
      requiresAction: false,
      dataState: "confirmed",
    });
  }
  for (const row of args.punchItems) {
    events.push({
      id: `punch-${row.id}`,
      category: "project_delivery",
      type: "Punch item",
      projectId: row.project_id,
      projectName: args.projectNames.get(row.project_id) ?? null,
      timestamp: row.updated_at || row.created_at,
      title: row.title,
      summary: "Punch-list activity recorded.",
      status: row.status,
      owner: null,
      href: `/${row.project_id}/punch-list/${row.id}`,
      sourceHref: null,
      sourceLabel: "Punch list",
      severity: normalized(row.priority).includes("high") ? "watch" : "neutral",
      requiresAction: !["closed", "complete", "completed"].includes(normalized(row.status)),
      dataState: "confirmed",
    });
  }
  for (const row of args.insights) {
    const projectId = args.targetProjects.get(row.primary_target_id) ?? null;
    events.push({
      id: `insight-${row.id}`,
      category: "intelligence",
      type: row.card_type.replaceAll("_", " "),
      projectId,
      projectName: projectId ? args.projectNames.get(projectId) ?? null : null,
      timestamp: row.updated_at,
      title: row.title,
      summary: row.why_it_matters || row.summary,
      status: row.current_status,
      owner: row.suggested_owner_label,
      href: projectId ? `/${projectId}/intelligence` : "/daily-brief",
      sourceHref: null,
      sourceLabel: "Curated intelligence",
      severity: insightSeverity(row),
      requiresAction: Boolean(row.next_action) || ["blocked", "needs_review"].includes(row.current_status),
      dataState: "ai_inference",
    });
  }
  return events.filter((event) => Number.isFinite(new Date(event.timestamp).getTime()));
}

function rangeStart(range: ActivityRange, now: Date) {
  if (range === "today") {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    return start;
  }
  return new Date(now.getTime() - activityRangeMs[range]);
}

function bucketDuration(range: ActivityRange) {
  return range === "today" || range === "24h" ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
}

function buildBuckets(events: ActivityEvent[], range: ActivityRange, now: Date): ActivityBucket[] {
  const start = rangeStart(range, now);
  const duration = bucketDuration(range);
  const count = Math.max(1, Math.ceil((now.getTime() - start.getTime()) / duration));
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Indiana/Indianapolis",
    ...(duration < 24 * 60 * 60 * 1000
      ? { hour: "numeric" as const }
      : { month: "short" as const, day: "numeric" as const }),
  });
  const buckets = Array.from({ length: count }, (_, index): ActivityBucket => {
    const bucketStart = new Date(start.getTime() + index * duration);
    return {
      key: bucketStart.toISOString(),
      label: formatter.format(bucketStart),
      startAt: bucketStart.toISOString(),
      communication: 0,
      financial: 0,
      project_delivery: 0,
      intelligence: 0,
    };
  });
  for (const event of events) {
    const index = Math.floor((new Date(event.timestamp).getTime() - start.getTime()) / duration);
    if (index >= 0 && index < buckets.length) buckets[index][event.category] += 1;
  }
  return buckets;
}

function buildActivityCategories(events: ActivityEvent[], start: Date, now: Date): ActivityCategory[] {
  const midpoint = start.getTime() + (now.getTime() - start.getTime()) / 2;
  return (Object.keys(ACTIVITY_CATEGORY_LABELS) as ActivityCategoryKey[]).map((key) => {
    const rows = events.filter((event) => event.category === key);
    const previous = rows.filter((event) => new Date(event.timestamp).getTime() < midpoint).length;
    const current = rows.length - previous;
    const changePercent = previous ? ((current - previous) / previous) * 100 : current ? null : 0;
    const projectCounts = new Map<string, number>();
    rows.forEach((event) => {
      if (event.projectName) projectCounts.set(event.projectName, (projectCounts.get(event.projectName) ?? 0) + 1);
    });
    const mostActiveProject = [...projectCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    const anomaly =
      current >= 5 && previous === 0
        ? `${ACTIVITY_CATEGORY_LABELS[key]} activity appeared in the current half of this range.`
        : changePercent !== null && Math.abs(changePercent) >= 100 && current >= 5
          ? `${ACTIVITY_CATEGORY_LABELS[key]} activity changed ${Math.round(changePercent)}% versus the prior half of this range.`
          : null;
    return {
      key,
      label: ACTIVITY_CATEGORY_LABELS[key],
      total: rows.length,
      requiresActionCount: rows.filter((event) => event.requiresAction).length,
      highRiskCount: rows.filter((event) => ["at_risk", "critical"].includes(event.severity)).length,
      changePercent,
      mostActiveProject,
      anomaly,
    };
  });
}

function buildQuietProjects(
  activityRows: ActivityViewRow[],
  projects: ProjectRow[],
  now: Date,
): QuietProject[] {
  const activeIds = new Set(
    projects
      .filter((project) => ["active", "closeout"].includes(projectStage(project).stage ?? ""))
      .map((project) => project.id),
  );
  return activityRows
    .filter((row) => row.project_id !== null && activeIds.has(row.project_id))
    .map((row) => {
      const latest = [row.last_meeting_at, row.last_task_update]
        .filter((value): value is string => Boolean(value))
        .sort()
        .at(-1) ?? null;
      const hoursQuiet = latest ? Math.floor((now.getTime() - new Date(latest).getTime()) / 3_600_000) : null;
      return {
        projectId: row.project_id as number,
        projectName: row.name?.trim() || `Project ${row.project_id}`,
        lastActivityAt: latest,
        hoursQuiet,
        href: `/${row.project_id}/home`,
      };
    })
    .filter((row) => row.hoursQuiet === null || row.hoursQuiet >= 72)
    .sort((a, b) => (b.hoursQuiet ?? Number.MAX_SAFE_INTEGER) - (a.hoursQuiet ?? Number.MAX_SAFE_INTEGER))
    .slice(0, 5);
}

function opportunityCategory(row: InsightRow): OpportunityCategoryKey {
  const text = normalized(`${row.title} ${row.summary} ${row.why_it_matters ?? ""} ${row.next_action ?? ""}`);
  if (/(quality|rework|punch|defect|installation|inspection)/.test(text)) return "quality_improvement";
  if (/(revenue|growth|sales|prospect|unpriced|owner request|upsell)/.test(text)) return "revenue_growth";
  if (/(saving|procurement|buyout|quote|vendor|cost reduction|labor hours)/.test(text)) return "cost_savings";
  if (row.card_type === "schedule_risk" || /(schedule|critical path|delay|milestone)/.test(text)) {
    return "schedule_acceleration";
  }
  if (["financial_exposure", "risk", "blocker", "change_management"].includes(row.card_type)) {
    return "risk_reduction";
  }
  return "operational_efficiency";
}

function confidenceValue(value: string) {
  return value === "high" ? 0.9 : value === "medium" ? 0.65 : 0.35;
}

function opportunityUrgency(row: InsightRow) {
  if (row.current_status === "blocked") return 1;
  if (["financial_exposure", "schedule_risk", "blocker"].includes(row.card_type)) return 0.85;
  if (["needs_review", "stale"].includes(row.current_status)) return 0.75;
  return 0.55;
}

function opportunityPriority(row: InsightRow) {
  return confidenceValue(row.confidence) * opportunityUrgency(row) * (row.next_action ? 1 : 0.65);
}

function buildOpportunities(
  insights: SourceResult<InsightRow>,
): ExecutiveDashboardVisualizations["opportunities"] {
  if (insights.error) {
    return {
      source: {
        status: "error",
        label: "AI opportunities",
        detail: `Curated intelligence could not be loaded. ${insights.error.message}`,
        recoveryHref: "/pipeline",
      },
      categories: [],
      activeOpportunityCount: 0,
      averageConfidence: 0,
      executiveActionCount: 0,
      totalOpportunityValue: null,
      comparisonAvailable: false,
      insight: "Opportunity analysis is unavailable until curated intelligence recovers.",
    };
  }
  const rows = insights.rows.filter((row) => OPPORTUNITY_CARD_TYPES.includes(row.card_type));
  const categories = (Object.keys(OPPORTUNITY_CATEGORY_LABELS) as OpportunityCategoryKey[]).map(
    (key): OpportunityCategory => {
      const matches = rows.filter((row) => opportunityCategory(row) === key);
      const ranked = [...matches].sort((a, b) => opportunityPriority(b) - opportunityPriority(a));
      return {
        key,
        label: OPPORTUNITY_CATEGORY_LABELS[key],
        count: matches.length,
        averageConfidence: matches.length
          ? matches.reduce((sum, row) => sum + confidenceValue(row.confidence), 0) / matches.length
          : 0,
        urgency: matches.length
          ? matches.reduce((sum, row) => sum + opportunityUrgency(row), 0) / matches.length
          : 0,
        executiveActionCount: matches.filter(
          (row) => Boolean(row.next_action) || ["blocked", "needs_review"].includes(row.current_status),
        ).length,
        totalImpact: null,
        priorPeriodChange: null,
        highestPriorityTitle: ranked[0]?.title ?? null,
        dataState: "ai_inference",
      };
    },
  );
  const ranked = [...rows].sort((a, b) => opportunityPriority(b) - opportunityPriority(a));
  return {
    source: {
      status: rows.length ? "incomplete" : "empty",
      label: "AI opportunities",
      detail: rows.length
        ? "Categories are AI inferences from curated insight cards. Validated opportunity impact values are not stored, so dollar totals and impact-weighted ranking are unavailable."
        : "No active curated insight cards can support an opportunity view.",
      recoveryHref: "/pipeline",
    },
    categories,
    activeOpportunityCount: rows.length,
    averageConfidence: rows.length
      ? rows.reduce((sum, row) => sum + confidenceValue(row.confidence), 0) / rows.length
      : 0,
    executiveActionCount: rows.filter(
      (row) => Boolean(row.next_action) || ["blocked", "needs_review"].includes(row.current_status),
    ).length,
    totalOpportunityValue: null,
    comparisonAvailable: false,
    insight: ranked[0]
      ? `${ranked[0].title} ranks first because it combines ${ranked[0].confidence} confidence with current urgency${ranked[0].next_action ? " and a recorded next action" : ""}. Impact value remains unverified.`
      : "No active evidence-backed opportunity candidates are available.",
  };
}

async function loadRaw(range: ActivityRange, projectId: number | null) {
  const db = createServiceClient();
  const now = new Date();
  const start = rangeStart(range, now).toISOString();

  let documentQuery = db
    .from("document_metadata")
    .select("id,project_id,document_type,source_system,created_at,status,title,source_web_url,fireflies_link", { count: "exact" })
    .gte("created_at", start)
    .order("created_at", { ascending: false })
    .limit(1000);
  let taskQuery = db
    .from("tasks")
    .select("id,project_id,source_system,status,priority,created_at,updated_at,title,description,assignee_name,due_date", { count: "exact" })
    .gte("updated_at", start)
    .order("updated_at", { ascending: false })
    .limit(1000);
  let changeEventQuery = db
    .from("change_events")
    .select("id,project_id,title,status,created_at,updated_at,expecting_revenue", { count: "exact" })
    .gte("updated_at", start)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(1000);
  let rfiQuery = db
    .from("rfis")
    .select("id,project_id,subject,status,created_at,updated_at,cost_impact,schedule_impact,ball_in_court", { count: "exact" })
    .gte("updated_at", start)
    .order("updated_at", { ascending: false })
    .limit(1000);
  let submittalQuery = db
    .from("submittals")
    .select("id,project_id,title,status,created_at,updated_at,priority,final_due_date,ball_in_court", { count: "exact" })
    .gte("updated_at", start)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(1000);
  let dailyLogQuery = db
    .from("daily_logs")
    .select("id,project_id,log_date,created_at", { count: "exact" })
    .gte("created_at", start)
    .order("created_at", { ascending: false })
    .limit(1000);
  let punchQuery = db
    .from("punch_items")
    .select("id,project_id,title,status,created_at,updated_at,priority", { count: "exact" })
    .gte("updated_at", start)
    .order("updated_at", { ascending: false })
    .limit(1000);
  if (projectId !== null) {
    documentQuery = documentQuery.eq("project_id", projectId);
    taskQuery = taskQuery.eq("project_id", projectId);
    changeEventQuery = changeEventQuery.eq("project_id", projectId);
    rfiQuery = rfiQuery.eq("project_id", projectId);
    submittalQuery = submittalQuery.eq("project_id", projectId);
    dailyLogQuery = dailyLogQuery.eq("project_id", projectId);
    punchQuery = punchQuery.eq("project_id", projectId);
  }

  const [
    projectsResult,
    prospectsResult,
    targetsResult,
    insightsResult,
    activityViewResult,
    documentsResult,
    tasksResult,
    changeEventsResult,
    rfisResult,
    submittalsResult,
    dailyLogsResult,
    punchItemsResult,
  ] = await Promise.all([
    db.from("projects").select("id,name,stage,phase,budget,completion_percentage,health_status,created_at,project_manager").eq("archived", false).limit(1000),
    db.from("crm_deals").select("id,name,value,status,expected_close_date,created_at,updated_at,stage:crm_pipeline_stages!crm_deals_stage_id_fkey(name),company:companies!crm_deals_company_id_fkey(name),owner:people!crm_deals_owner_id_fkey(first_name,last_name)").eq("status", "open").limit(1000),
    db.from("intelligence_targets").select("id,project_id,name").eq("target_type", "client_project").eq("status", "active").limit(1000),
    db.from("insight_cards").select("id,primary_target_id,title,summary,why_it_matters,card_type,confidence,current_status,next_action,suggested_owner_label,source_count,created_at,updated_at,metadata", { count: "exact" }).neq("attribution_status", "rejected").in("current_status", ACTIVE_INSIGHT_STATUSES).order("updated_at", { ascending: false }).limit(1000),
    db.from("project_activity_view").select("project_id,name,last_meeting_at,last_task_update,meeting_count,open_tasks").limit(1000),
    documentQuery,
    taskQuery,
    changeEventQuery,
    rfiQuery,
    submittalQuery,
    dailyLogQuery,
    punchQuery,
  ]);

  return {
    now,
    start: rangeStart(range, now),
    projects: sourceResult(projectsResult as { data: ProjectRow[] | null; error: QueryFailure | null }),
    prospects: sourceResult({
      data:
        (prospectsResult.data as DealSourceRow[] | null)?.map(dealToProspectRow) ?? null,
      error: prospectsResult.error as QueryFailure | null,
    }),
    targets: sourceResult(targetsResult as { data: TargetRow[] | null; error: QueryFailure | null }),
    insights: sourceResult(insightsResult as { data: InsightRow[] | null; count: number | null; error: QueryFailure | null }),
    activityView: sourceResult(activityViewResult as { data: ActivityViewRow[] | null; error: QueryFailure | null }),
    documents: sourceResult(documentsResult as { data: DocumentRow[] | null; count: number | null; error: QueryFailure | null }),
    tasks: sourceResult(tasksResult as { data: TaskRow[] | null; count: number | null; error: QueryFailure | null }),
    changeEvents: sourceResult(changeEventsResult as { data: ChangeEventRow[] | null; count: number | null; error: QueryFailure | null }),
    rfis: sourceResult(rfisResult as { data: RfiRow[] | null; count: number | null; error: QueryFailure | null }),
    submittals: sourceResult(submittalsResult as { data: SubmittalRow[] | null; count: number | null; error: QueryFailure | null }),
    dailyLogs: sourceResult(dailyLogsResult as { data: DailyLogRow[] | null; count: number | null; error: QueryFailure | null }),
    punchItems: sourceResult(punchItemsResult as { data: PunchItemRow[] | null; count: number | null; error: QueryFailure | null }),
  };
}

async function buildSummary(range: ActivityRange, projectId: number | null): Promise<ExecutiveDashboardVisualizations> {
  const raw = await loadRaw(range, projectId);
  const projectNames = new Map(raw.projects.rows.map((project) => [project.id, project.name?.trim() || `Project ${project.id}`]));
  const targetProjects = new Map(raw.targets.rows.map((target) => [target.id, target.project_id]));
  const filteredInsights = projectId === null
    ? raw.insights.rows
    : raw.insights.rows.filter((row) => targetProjects.get(row.primary_target_id) === projectId);
  const lifecycleProjects = projectId === null
    ? raw.projects
    : { ...raw.projects, rows: raw.projects.rows.filter((project) => matchesProjectFilter(project.id, projectId)) };
  const lifecycleProspects = projectId === null
    ? raw.prospects
    : { ...raw.prospects, rows: raw.prospects.rows.filter((prospect) => matchesProjectFilter(prospect.project_id, projectId)) };
  const events = buildActivityEvents({
    documents: raw.documents.rows,
    tasks: raw.tasks.rows,
    changeEvents: raw.changeEvents.rows,
    rfis: raw.rfis.rows,
    submittals: raw.submittals.rows,
    dailyLogs: raw.dailyLogs.rows,
    punchItems: raw.punchItems.rows,
    insights: filteredInsights,
    targetProjects,
    projectNames,
  });
  const activitySources = [
    raw.documents,
    raw.tasks,
    raw.changeEvents,
    raw.rfis,
    raw.submittals,
    raw.dailyLogs,
    raw.punchItems,
  ].map((source) => ({
    count: source.count,
    error: source.error,
    rowCount: source.rows.length,
  }));
  const sourceErrors = [...activitySources, {
    count: raw.insights.count,
    error: raw.insights.error,
    rowCount: raw.insights.rows.length,
  }].flatMap((source) => source.error?.message ?? []);
  const sourceRecordCount =
    activitySources.reduce((sum, source) => sum + source.count, 0) +
    (projectId === null ? raw.insights.count : filteredInsights.length);
  const sampled =
    activitySources.some((source) => source.count > source.rowCount) ||
    raw.insights.count > raw.insights.rows.length;
  const categories = buildActivityCategories(events, raw.start, raw.now);
  const scopedActivityProjects = raw.projects.rows.filter((project) =>
    matchesProjectFilter(project.id, projectId),
  );
  const scopedActivityView = raw.activityView.rows.filter((project) =>
    matchesProjectFilter(project.project_id ?? null, projectId),
  );
  const quietProjects = buildQuietProjects(
    scopedActivityView,
    scopedActivityProjects,
    raw.now,
  );
  const topAnomaly = categories.find((category) => category.anomaly)?.anomaly;
  const selectedProjectName = projectId === null ? null : projectNames.get(projectId);
  const activityInsight = topAnomaly
    ? topAnomaly
    : projectId !== null && events.length === 0
      ? `No source activity was recorded for ${selectedProjectName || `project ${projectId}`} in the selected range.`
      : quietProjects[0]
        ? `${quietProjects[0].projectName} has no meeting or task activity recorded in the past ${quietProjects[0].hoursQuiet ?? 72} hours.`
        : "No material activity anomaly is visible in the selected range.";
  const projects: ProjectFilterOption[] = raw.projects.rows
    .map((project) => ({ id: project.id, name: project.name?.trim() || `Project ${project.id}` }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return {
    generatedAt: raw.now.toISOString(),
    filters: { range, projectId, projects },
    lifecycle: buildLifecycle(lifecycleProjects, lifecycleProspects),
    activity: {
      source: {
        status: sourceErrors.length ? (events.length ? "incomplete" : "error") : events.length ? "ready" : "empty",
        label: "Activity river",
        detail: sourceErrors.length
          ? `Some activity sources failed: ${sourceErrors.join("; ")}`
          : sampled
            ? `The river aggregates ${events.length.toLocaleString()} returned records from ${sourceRecordCount.toLocaleString()} matching source records. Detail is sampled at source limits.`
            : "The river aggregates current source records before rendering.",
        recoveryHref: "/pipeline",
      },
      range,
      buckets: buildBuckets(events, range, raw.now),
      categories,
      totalEvents: events.length,
      activeProjectCount: new Set(events.flatMap((event) => (event.projectId ? [event.projectId] : []))).size,
      requiringActionCount: events.filter((event) => event.requiresAction).length,
      highRiskCount: events.filter((event) => ["at_risk", "critical"].includes(event.severity)).length,
      quietProjects,
      sampled,
      sourceRecordCount,
      insight: activityInsight,
    },
    opportunities: buildOpportunities({ ...raw.insights, rows: filteredInsights }),
  };
}

const loadCachedSummary = unstable_cache(
  async (range: ActivityRange, projectId: number | null) => buildSummary(range, projectId),
  ["ai-dashboard-visualizations-v3"],
  { revalidate: 60 },
);

export async function loadDashboardVisualizations(range: ActivityRange, projectId: number | null) {
  return loadCachedSummary(range, projectId);
}

function detailSource(status: SourceState["status"], detail: string, recoveryHref: string): SourceState {
  return { status, label: "Visualization detail", detail, recoveryHref };
}

function lifecycleDetailItem(record: LifecycleRecord): VisualizationDetailItem {
  return {
    id: record.id,
    title: record.name,
    projectId: record.projectId,
    projectName: record.name,
    href: record.source === "prospect" ? "/directory/prospects" : projectHref(record.projectId),
    sourceHref: null,
    sourceLabel: record.source === "prospect" ? "Prospects" : "Projects",
    timestamp: record.createdAt,
    value: record.value,
    weightedValue: record.weightedValue,
    confidence: null,
    severity: severityFromHealth(record.health),
    status: record.status,
    owner: record.owner,
    summary:
      record.value === null
        ? "Project value is missing from the canonical record."
        : "Lifecycle position is derived from the canonical stage or phase field.",
    nextAction: record.nextAction,
    dataState: record.dataState,
    supportingSources: [],
  };
}

function activityDetailItem(event: ActivityEvent): VisualizationDetailItem {
  return {
    id: event.id,
    title: event.title,
    projectId: event.projectId,
    projectName: event.projectName,
    href: event.href,
    sourceHref: event.sourceHref,
    sourceLabel: event.sourceLabel,
    timestamp: event.timestamp,
    value: null,
    weightedValue: null,
    confidence: null,
    severity: event.severity,
    status: event.status,
    owner: event.owner,
    summary: event.summary,
    nextAction: event.requiresAction ? "Open the source record" : null,
    dataState: event.dataState,
    supportingSources: [],
  };
}

function metadataRecord(value: Json): Record<string, Json> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, Json> : {};
}

export async function loadVisualizationDetail(args: {
  kind: VisualizationDetailKind;
  key: string;
  range: ActivityRange;
  projectId: number | null;
}): Promise<VisualizationDetailResponse> {
  const raw = await loadRaw(args.range, args.projectId);
  const projectNames = new Map(raw.projects.rows.map((project) => [project.id, project.name?.trim() || `Project ${project.id}`]));
  const targetRows = new Map(raw.targets.rows.map((target) => [target.id, target]));
  const targetProjects = new Map(raw.targets.rows.map((target) => [target.id, target.project_id]));

  if (args.kind === "lifecycle") {
    const stage = args.key as LifecycleStageKey;
    const items = lifecycleRecords(raw.projects.rows, raw.prospects.rows)
      .filter(
        (record) =>
          record.stage === stage &&
          matchesProjectFilter(record.projectId, args.projectId),
      )
      .sort((a, b) => (b.value ?? -1) - (a.value ?? -1))
      .map(lifecycleDetailItem);
    return {
      generatedAt: raw.now.toISOString(),
      kind: args.kind,
      key: args.key,
      label: LIFECYCLE_STAGE_LABELS[stage] || "Lifecycle stage",
      source: detailSource(items.length ? "ready" : "empty", items.length ? "Canonical lifecycle records." : "No current records are assigned to this stage.", "/projects"),
      items,
    };
  }

  if (args.kind === "activity") {
    const events = buildActivityEvents({
      documents: raw.documents.rows,
      tasks: raw.tasks.rows,
      changeEvents: raw.changeEvents.rows,
      rfis: raw.rfis.rows,
      submittals: raw.submittals.rows,
      dailyLogs: raw.dailyLogs.rows,
      punchItems: raw.punchItems.rows,
      insights: raw.insights.rows.filter((row) => args.projectId === null || targetProjects.get(row.primary_target_id) === args.projectId),
      targetProjects,
      projectNames,
    });
    const category = args.key as ActivityCategoryKey;
    const items = events
      .filter((event) => event.category === category)
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .slice(0, 100)
      .map(activityDetailItem);
    return {
      generatedAt: raw.now.toISOString(),
      kind: args.kind,
      key: args.key,
      label: ACTIVITY_CATEGORY_LABELS[category] || "Activity",
      source: detailSource(items.length ? "ready" : "empty", items.length ? "Latest source-linked activity records." : "No activity records match this stream and range.", "/pipeline"),
      items,
    };
  }

  const category = args.key as OpportunityCategoryKey;
  const opportunityRows = raw.insights.rows
    .filter((row) => OPPORTUNITY_CARD_TYPES.includes(row.card_type))
    .filter((row) => args.projectId === null || targetProjects.get(row.primary_target_id) === args.projectId)
    .filter((row) => opportunityCategory(row) === category)
    .sort((a, b) => opportunityPriority(b) - opportunityPriority(a))
    .slice(0, 50);
  const cardIds = opportunityRows.map((row) => row.id);
  const evidenceResult = cardIds.length
    ? await createServiceClient()
        .from("insight_card_evidence")
        .select("id,insight_card_id,source_document_id,source_title,source_type,confidence")
        .in("insight_card_id", cardIds)
        .limit(500)
    : { data: [] as EvidenceRow[], error: null };
  const evidence = sourceResult(evidenceResult as { data: EvidenceRow[] | null; error: QueryFailure | null });
  const items = opportunityRows.map((row): VisualizationDetailItem => {
    const target = targetRows.get(row.primary_target_id);
    const projectId = target?.project_id ?? null;
    const sources = evidence.rows.filter((item) => item.insight_card_id === row.id).slice(0, 8);
    const metadata = metadataRecord(row.metadata);
    return {
      id: row.id,
      title: row.title,
      projectId,
      projectName: target?.name ?? null,
      href: projectId ? `/${projectId}/intelligence` : "/daily-brief",
      sourceHref: null,
      sourceLabel: "Curated intelligence",
      timestamp: row.updated_at,
      value: null,
      weightedValue: null,
      confidence: confidenceValue(row.confidence),
      severity: insightSeverity(row),
      status: row.current_status,
      owner: row.suggested_owner_label,
      summary: row.why_it_matters || row.summary,
      nextAction: row.next_action,
      dataState: "ai_inference",
      supportingSources: sources.map((source) => ({
        id: source.id,
        label: source.source_title || source.source_type,
        href: source.source_document_id && projectId
          ? source.source_type.includes("meeting")
            ? `/${projectId}/meetings/${source.source_document_id}`
            : `/${projectId}/intelligence`
          : null,
        confidence: source.confidence,
      })),
    };
  });
  return {
    generatedAt: raw.now.toISOString(),
    kind: args.kind,
    key: args.key,
    label: OPPORTUNITY_CATEGORY_LABELS[category] || "AI opportunity",
    source: detailSource(
      evidence.error ? "incomplete" : items.length ? "incomplete" : "empty",
      evidence.error
        ? `Opportunity records loaded, but evidence failed: ${evidence.error.message}`
        : items.length
          ? "Categories and priorities are AI inferences. Validated impact values are unavailable."
          : "No active curated intelligence matches this category.",
      "/pipeline",
    ),
    items,
  };
}

export const __testables = {
  projectStage,
  prospectStage,
  lifecycleRecords,
  opportunityCategory,
  confidenceValue,
  opportunityPriority,
  buildBuckets,
};
