import "server-only";

import {
  loadBrainResourcePage,
  loadBusinessAreaAccess,
  loadBusinessAreas,
} from "@/features/brain/brain-data";
import type { BrainResourceRow } from "@/features/brain/brain-contract";

import type {
  BrainHealth,
  BrainRange,
  CompanyBrainActivity,
  CompanyBrainEdge,
  CompanyBrainNode,
  CompanyBrainOverview,
} from "./company-brain-contract";

const RANGE_MS: Record<BrainRange, number> = {
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
};

function safeDate(value: string | null): number {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function statusHealth(statuses: Array<string | null>): BrainHealth {
  const values = statuses.map((status) => status?.trim().toLowerCase() ?? "");
  if (values.some((status) => status.includes("fail") || status.includes("error"))) {
    return "error";
  }
  if (values.some((status) => status.includes("pending") || status.includes("process"))) {
    return "syncing";
  }
  return values.some(Boolean) ? "healthy" : "unknown";
}

function sourceName(value: string | null): string {
  const normalized = value?.trim();
  if (!normalized) return "Other permitted sources";
  const lower = normalized.toLowerCase();
  if (lower.includes("fireflies")) return "Fireflies";
  if (lower.includes("outlook") || lower.includes("email")) return "Outlook";
  if (lower.includes("teams")) return "Teams";
  if (lower.includes("microsoft_graph") || lower.includes("microsoft graph")) {
    return "SharePoint";
  }
  if (lower.includes("sharepoint") || lower.includes("one drive") || lower.includes("onedrive")) {
    return "SharePoint";
  }
  return "Other permitted sources";
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "source";
}

function stableSourceId(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `source-${slug(value)}-${(hash >>> 0).toString(36)}`;
}

function inRange(row: BrainResourceRow, range: BrainRange, now: number): boolean {
  const time = safeDate(row.date);
  return time > 0 && time >= now - RANGE_MS[range];
}

function sourceNodes(rows: BrainResourceRow[]): CompanyBrainNode[] {
  const canonicalSources = ["Fireflies", "Outlook", "Teams", "SharePoint", "OneDrive"];
  const grouped = new Map<string, BrainResourceRow[]>();
  for (const row of rows) {
    const name = sourceName(row.source);
    grouped.set(name, [...(grouped.get(name) ?? []), row]);
  }

  return canonicalSources.map((name, index, all) => {
    const sourceRows = grouped.get(name) ?? [];
    return {
      id: slug(name),
      kind: "source" as const,
      name,
      description: sourceRows.length
        ? "Permitted knowledge source"
        : "No permitted records observed",
      status: sourceRows.length
        ? statusHealth(sourceRows.map((row) => row.status))
        : "unknown" as const,
      count: sourceRows.length || null,
      countLabel: sourceRows.length ? "sampled records" : undefined,
      lastActivityAt:
        [...sourceRows].sort((a, b) => safeDate(b.date) - safeDate(a.date))[0]?.date ??
        null,
      href: "/ai-dashboard/rag-pipeline",
      layout: {
        x: 9,
        y: 16 + (index * 68) / Math.max(1, all.length - 1),
        layer: 0,
      },
      permissions: { canView: true, canRetry: false, canNavigate: true },
    };
  });
}

function buildActivity(
  knowledgeRows: BrainResourceRow[],
  taskRows: BrainResourceRow[],
  range: BrainRange,
  now: number,
): CompanyBrainActivity[] {
  const knowledge = knowledgeRows
    .filter((row) => inRange(row, range, now))
    .map((row): CompanyBrainActivity => {
      const name = sourceName(row.source);
      return {
        id: `knowledge-${row.id}`,
        occurredAt: row.date ?? new Date(0).toISOString(),
        type: "knowledge",
        severity: statusHealth([row.status]) === "error" ? "error" : "success",
        title: row.title,
        detail: `${name} entered the permitted knowledge pipeline.`,
        entityRef: { kind: "source", id: stableSourceId(name), name },
        href: row.href ?? "/ai-dashboard/rag-pipeline",
      };
    });
  const tasks = taskRows
    .filter((row) => inRange(row, range, now))
    .map((row): CompanyBrainActivity => ({
      id: `task-${row.id}`,
      occurredAt: row.date ?? new Date(0).toISOString(),
      type: "task",
      severity: row.status?.toLowerCase().includes("blocked") ? "warning" : "info",
      title: row.title,
      detail: "A permitted task changed in the selected range.",
      entityRef: {
        kind: "outcome",
        id: "tasks",
        name: "Tasks Generated",
      },
      href: row.href ?? "/tasks",
    }));

  return [...knowledge, ...tasks]
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
    .slice(0, 40);
}

export async function loadCompanyBrainOverview(
  range: BrainRange,
): Promise<CompanyBrainOverview> {
  const generatedAt = new Date();
  const failures: CompanyBrainOverview["failures"] = [];

  let areas: Awaited<ReturnType<typeof loadBusinessAreas>>;
  try {
    areas = await loadBusinessAreas();
  } catch {
    return {
      mode: "live",
      generatedAt: generatedAt.toISOString(),
      health: "error",
      state: "error",
      permissionLimited: true,
      latestIngestedAt: null,
      metrics: [],
      nodes: [],
      edges: [],
      activity: [],
      failures: [
        {
          source: "Business areas",
          message: "Business-area scope could not be loaded.",
        },
      ],
    };
  }

  const access = await Promise.all(
    areas.slice(0, 20).map(async (area) => {
      try {
        return await loadBusinessAreaAccess(area.id);
      } catch {
        failures.push({
          source: "Business-area access",
          message: "Access could not be verified.",
        });
        return { area: null, canAccess: false, isAdmin: false };
      }
    }),
  );
  const accessible = access.filter(
    (result): result is typeof result & { area: NonNullable<typeof result.area> } =>
      result.canAccess && result.area !== null,
  );
  const isAdmin = access.some((result) => result.isAdmin);
  const permissionLimited =
    !isAdmin || accessible.length < areas.length || failures.length > 0;

  const pages = await Promise.all(
    accessible.map(async ({ area }) => {
      const result: {
        knowledge: Awaited<ReturnType<typeof loadBrainResourcePage>> | null;
        tasks: Awaited<ReturnType<typeof loadBrainResourcePage>> | null;
      } = { knowledge: null, tasks: null };

      await Promise.all(
        (["knowledge", "tasks"] as const).map(async (tab) => {
          try {
            result[tab] = await loadBrainResourcePage(area.id, tab, {
              per_page: "50",
              sort_dir: "desc",
            });
          } catch {
            failures.push({
              source: tab === "knowledge" ? "Knowledge" : "Tasks",
              message:
                tab === "knowledge"
                  ? "Knowledge data could not be loaded."
                  : "Task activity could not be loaded.",
            });
          }
        }),
      );
      return result;
    }),
  );

  const knowledgeRows = pages.flatMap((page) => page.knowledge?.rows ?? []);
  const taskRows = pages.flatMap((page) => page.tasks?.rows ?? []);
  const observedSources = sourceNodes(knowledgeRows);
  const observedSourceCount = observedSources.filter(
    (source) => source.count !== null && source.count > 0,
  ).length;
  const now = generatedAt.getTime();
  const recentTasks = taskRows.filter((row) => inRange(row, range, now));
  const latestIngestedAt =
    [...knowledgeRows].sort((a, b) => safeDate(b.date) - safeDate(a.date))[0]?.date ??
    null;

  const brainNode: CompanyBrainNode = {
    id: "brain-core",
    kind: "brain",
    name: "Company Brain",
    description: "Permission-scoped company knowledge",
    status: failures.some((failure) => failure.source === "Knowledge")
      ? "warning"
      : knowledgeRows.length
        ? "healthy"
        : "unknown",
    count: pages.reduce((sum, page) => sum + (page.knowledge?.total ?? 0), 0),
    countLabel: "permitted records",
    lastActivityAt: latestIngestedAt,
    layout: { x: 39, y: 50, layer: 1 },
    permissions: { canView: true, canRetry: false, canNavigate: false },
  };
  const agentNode: CompanyBrainNode = {
    id: "agent-catalog",
    kind: "agent",
    name: isAdmin ? "Loading agent registry" : "Agent catalog restricted",
    description: isAdmin
      ? "Live agent status is loading."
      : "Admin access is required to inspect agent status.",
    status: "unknown",
    count: null,
    lastActivityAt: null,
    layout: { x: 69, y: 50, layer: 2 },
    permissions: { canView: false, canRetry: false, canNavigate: false },
  };
  const outcomeNode: CompanyBrainNode = {
    id: "tasks",
    kind: "outcome",
    name: "Tasks Generated",
    description: "Permitted work updated from company knowledge",
    status: failures.some((failure) => failure.source === "Tasks")
      ? "warning"
      : taskRows.length
        ? "healthy"
        : "unknown",
    count: recentTasks.length,
    countLabel: "sampled tasks",
    lastActivityAt:
      [...taskRows].sort((a, b) => safeDate(b.date) - safeDate(a.date))[0]?.date ??
      null,
    href: "/tasks",
    layout: { x: 92, y: 50, layer: 3 },
    permissions: { canView: true, canRetry: false, canNavigate: true },
  };
  const canonicalOutputs: CompanyBrainNode[] = [
    {
      id: "executive-brief",
      kind: "agent",
      name: "Executive Brief",
      description: "No authoritative activity feed",
      status: "unknown",
      count: null,
      lastActivityAt: null,
      layout: { x: 69, y: 18, layer: 2 },
      permissions: { canView: true, canRetry: false, canNavigate: false },
    },
    {
      id: "project-intelligence",
      kind: "agent",
      name: "Project Intelligence",
      description: "No authoritative activity feed",
      status: "unknown",
      count: null,
      lastActivityAt: null,
      layout: { x: 69, y: 32, layer: 2 },
      permissions: { canView: true, canRetry: false, canNavigate: false },
    },
    outcomeNode,
    {
      id: "risks",
      kind: "outcome",
      name: "Risks Identified",
      description: "No authoritative measure",
      status: "unknown",
      count: null,
      lastActivityAt: null,
      layout: { x: 69, y: 60, layer: 2 },
      permissions: { canView: true, canRetry: false, canNavigate: false },
    },
    {
      id: "change-events",
      kind: "outcome",
      name: "Change Events",
      description: "No authoritative measure",
      status: "unknown",
      count: null,
      lastActivityAt: null,
      layout: { x: 69, y: 74, layer: 2 },
      permissions: { canView: true, canRetry: false, canNavigate: false },
    },
    {
      id: "opportunities",
      kind: "outcome",
      name: "Opportunities",
      description: "No authoritative measure",
      status: "unknown",
      count: null,
      lastActivityAt: null,
      layout: { x: 69, y: 88, layer: 2 },
      permissions: { canView: true, canRetry: false, canNavigate: false },
    },
  ];
  const nodes = [
    ...observedSources,
    brainNode,
    agentNode,
    ...canonicalOutputs,
  ];
  const edges: CompanyBrainEdge[] = [
    ...observedSources.map((source, index) => ({
      id: `source-${index}`,
      from: source.id,
      to: brainNode.id,
      kind: "ingests" as const,
      status: source.status,
    })),
    ...canonicalOutputs.map((output, index) => ({
      id: `brain-output-${index}`,
      from: brainNode.id,
      to: output.id,
      kind:
        output.kind === "agent"
          ? "informs" as const
          : "creates" as const,
      status: output.status,
    })),
  ];

  const activity = buildActivity(knowledgeRows, taskRows, range, now);
  const empty = observedSourceCount === 0 && taskRows.length === 0;
  const state =
    failures.length > 0
      ? nodes.length > 2
        ? "partial"
        : "error"
      : empty
        ? "empty"
        : permissionLimited
          ? "permission_limited"
          : "ready";

  return {
    mode: "live",
    generatedAt: generatedAt.toISOString(),
    health:
      state === "error"
        ? "error"
        : state === "partial"
          ? "warning"
          : empty
            ? "unknown"
            : "healthy",
    state,
    permissionLimited,
    latestIngestedAt,
    metrics: [
      {
        key: "knowledge_coverage",
        label: "Knowledge coverage",
        value: null,
        displayValue: "Not measured",
        context: "No authoritative coverage model",
        status: "unknown",
      },
      {
        key: "connected_sources",
        label: "Observed sources",
        value: observedSourceCount,
        displayValue: String(observedSourceCount),
        context: "In permitted knowledge sample",
        status: observedSourceCount ? "healthy" : "unknown",
        href: "/ai-dashboard/rag-pipeline",
      },
      {
        key: "active_agents",
        label: "Active agents",
        value: null,
        displayValue: "Not measured",
        context: "No authoritative agent health feed",
        status: "unknown",
      },
      {
        key: "work_created",
        label: "Work activity",
        value: recentTasks.length,
        displayValue: String(recentTasks.length),
        context: "Permitted sample in range",
        status: failures.some((failure) => failure.source === "Tasks")
          ? "warning"
          : "healthy",
        href: "/tasks",
      },
    ],
    nodes,
    edges,
    activity,
    failures,
  };
}
