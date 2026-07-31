import type {
  BrainDataState,
  CompanyBrainOverview,
} from "./company-brain-contract";

const GENERATED_AT = "2026-07-24T12:00:00.000Z";

export function buildCompanyBrainFixture(
  state: BrainDataState = "ready",
): CompanyBrainOverview {
  const base: CompanyBrainOverview = {
    mode: "fixture",
    generatedAt: GENERATED_AT,
    health: "healthy",
    state,
    permissionLimited: state === "permission_limited",
    latestIngestedAt: "2026-07-24T11:42:00.000Z",
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
        value: 4,
        displayValue: "4",
        context: "In permitted knowledge",
        status: "healthy",
        href: "/ai-dashboard/rag-pipeline",
      },
      {
        key: "active_agents",
        label: "Active agents",
        value: 3,
        displayValue: "3",
        context: "Production or beta",
        status: "healthy",
      },
      {
        key: "work_created",
        label: "Work activity",
        value: 18,
        displayValue: "18",
        context: "Tasks in selected range",
        status: "healthy",
        href: "/tasks",
      },
    ],
    nodes: [
      {
        id: "outlook",
        kind: "source",
        name: "Outlook",
        description: "Email knowledge",
        status: "healthy",
        count: 128,
        countLabel: "records",
        lastActivityAt: "2026-07-24T11:42:00.000Z",
        href: "/ai-dashboard/rag-pipeline",
        layout: { x: 10, y: 22, layer: 0 },
        permissions: { canView: true, canRetry: false, canNavigate: true },
      },
      {
        id: "fireflies",
        kind: "source",
        name: "Fireflies",
        description: "Meeting knowledge",
        status: "healthy",
        count: 42,
        countLabel: "records",
        lastActivityAt: "2026-07-24T11:35:00.000Z",
        href: "/ai-dashboard/rag-pipeline",
        layout: { x: 10, y: 48, layer: 0 },
        permissions: { canView: true, canRetry: false, canNavigate: true },
      },
      {
        id: "teams",
        kind: "source",
        name: "Teams",
        description: "Message knowledge",
        status: "healthy",
        count: 256,
        countLabel: "messages",
        lastActivityAt: "2026-07-24T11:21:00.000Z",
        href: "/ai-dashboard/rag-pipeline",
        layout: { x: 10, y: 42, layer: 0 },
        permissions: { canView: true, canRetry: false, canNavigate: true },
      },
      {
        id: "sharepoint",
        kind: "source",
        name: "SharePoint",
        description: "Document knowledge",
        status: "warning",
        count: 83,
        countLabel: "records",
        lastActivityAt: "2026-07-24T10:58:00.000Z",
        href: "/ai-dashboard/rag-pipeline",
        layout: { x: 10, y: 74, layer: 0 },
        permissions: { canView: true, canRetry: false, canNavigate: true },
      },
      {
        id: "onedrive",
        kind: "source",
        name: "OneDrive",
        description: "File knowledge",
        status: "healthy",
        count: 64,
        countLabel: "files",
        lastActivityAt: "2026-07-24T10:44:00.000Z",
        href: "/ai-dashboard/rag-pipeline",
        layout: { x: 10, y: 82, layer: 0 },
        permissions: { canView: true, canRetry: false, canNavigate: true },
      },
      {
        id: "core",
        kind: "brain",
        name: "Company Brain",
        description: "Permission-scoped company knowledge",
        status: "healthy",
        count: 253,
        countLabel: "sampled records",
        lastActivityAt: "2026-07-24T11:42:00.000Z",
        layout: { x: 40, y: 48, layer: 1 },
        permissions: { canView: true, canRetry: false, canNavigate: false },
      },
      {
        id: "executive-brief",
        kind: "agent",
        name: "Executive Brief",
        description: "Synthesizes company priorities",
        status: "healthy",
        count: 9,
        countLabel: "runs",
        lastActivityAt: "2026-07-24T11:20:00.000Z",
        layout: { x: 69, y: 26, layer: 2 },
        permissions: { canView: true, canRetry: false, canNavigate: false },
      },
      {
        id: "project-intelligence",
        kind: "agent",
        name: "Project Intelligence",
        description: "Connects project signals",
        status: "healthy",
        count: 14,
        countLabel: "runs",
        lastActivityAt: "2026-07-24T11:17:00.000Z",
        layout: { x: 69, y: 54, layer: 2 },
        permissions: { canView: true, canRetry: false, canNavigate: false },
      },
      {
        id: "tasks",
        kind: "outcome",
        name: "Tasks Generated",
        description: "Actionable work created from knowledge",
        status: "healthy",
        count: 28,
        countLabel: "tasks",
        lastActivityAt: "2026-07-24T11:30:00.000Z",
        href: "/tasks",
        layout: { x: 69, y: 44, layer: 2 },
        permissions: { canView: true, canRetry: false, canNavigate: true },
      },
      {
        id: "risks",
        kind: "outcome",
        name: "Risks Identified",
        description: "Emerging delivery risks",
        status: "warning",
        count: 5,
        countLabel: "new risks",
        lastActivityAt: "2026-07-24T11:10:00.000Z",
        layout: { x: 69, y: 58, layer: 2 },
        permissions: { canView: true, canRetry: false, canNavigate: false },
      },
      {
        id: "change-events",
        kind: "outcome",
        name: "Change Events",
        description: "Scope and cost signals",
        status: "healthy",
        count: 3,
        countLabel: "new events",
        lastActivityAt: "2026-07-24T10:51:00.000Z",
        layout: { x: 69, y: 72, layer: 2 },
        permissions: { canView: true, canRetry: false, canNavigate: false },
      },
      {
        id: "opportunities",
        kind: "outcome",
        name: "Opportunities",
        description: "Potential operating improvements",
        status: "healthy",
        count: 2,
        countLabel: "new opportunities",
        lastActivityAt: "2026-07-24T10:42:00.000Z",
        layout: { x: 69, y: 86, layer: 2 },
        permissions: { canView: true, canRetry: false, canNavigate: false },
      },
    ],
    edges: [
      ["outlook", "core", "ingests"],
      ["fireflies", "core", "ingests"],
      ["teams", "core", "ingests"],
      ["sharepoint", "core", "ingests"],
      ["onedrive", "core", "ingests"],
      ["core", "executive-brief", "informs"],
      ["core", "project-intelligence", "informs"],
      ["core", "tasks", "creates"],
      ["core", "risks", "creates"],
      ["core", "change-events", "creates"],
      ["core", "opportunities", "creates"],
    ].map(([from, to, kind], index) => ({
      id: `edge-${index}`,
      from,
      to,
      kind: kind as "ingests" | "informs" | "creates",
      status: "healthy" as const,
    })),
    activity: [
      {
        id: "activity-1",
        occurredAt: "2026-07-24T11:42:00.000Z",
        type: "knowledge",
        severity: "success",
        title: "Email knowledge processed",
        detail: "Outlook entered the permitted knowledge pipeline.",
        entityRef: { kind: "source", id: "outlook", name: "Outlook" },
        href: "/ai-dashboard/rag-pipeline",
      },
      {
        id: "activity-2",
        occurredAt: "2026-07-24T11:30:00.000Z",
        type: "task",
        severity: "info",
        title: "Follow-up created",
        detail: "A source-backed task was added to the work queue.",
        entityRef: { kind: "outcome", id: "tasks", name: "Tasks Generated" },
        href: "/tasks",
      },
      {
        id: "activity-3",
        occurredAt: "2026-07-24T11:35:00.000Z",
        type: "knowledge",
        severity: "success",
        title: "Meeting processed",
        detail: "Weekly Operations Sync entered the knowledge system.",
        entityRef: { kind: "source", id: "fireflies", name: "Fireflies" },
      },
      {
        id: "activity-4",
        occurredAt: "2026-07-24T11:16:00.000Z",
        type: "knowledge",
        severity: "info",
        title: "Document processed",
        detail: "A permitted SharePoint document was structured.",
        entityRef: { kind: "source", id: "sharepoint", name: "SharePoint" },
      },
      {
        id: "activity-5",
        occurredAt: "2026-07-24T11:10:00.000Z",
        type: "knowledge",
        severity: "warning",
        title: "New insight generated",
        detail: "A potential delivery risk was identified.",
        entityRef: { kind: "outcome", id: "risks", name: "Risks Identified" },
      },
    ],
    failures: [],
  };

  if (state === "empty") {
    return {
      ...base,
      health: "unknown",
      latestIngestedAt: null,
      nodes: base.nodes.filter((node) => node.kind === "brain"),
      edges: [],
      activity: [],
      metrics: base.metrics.map((metric) => ({
        ...metric,
        value: metric.key === "knowledge_coverage" ? null : 0,
        displayValue: metric.key === "knowledge_coverage" ? "Not measured" : "0",
        status: "unknown",
      })),
    };
  }

  if (state === "error") {
    return {
      ...base,
      health: "error",
      nodes: [],
      edges: [],
      activity: [],
      failures: [{ source: "Company Brain", message: "Overview data could not be loaded." }],
    };
  }

  if (state === "partial") {
    return {
      ...base,
      health: "warning",
      failures: [{ source: "Agent registry", message: "Agent status is temporarily unavailable." }],
      nodes: base.nodes.map((node) =>
        node.kind === "agent" ? { ...node, status: "unknown" as const, count: null } : node,
      ),
    };
  }

  if (state === "permission_limited") {
    const safeNodes = base.nodes
      .filter((node) => !["sharepoint", "change-events"].includes(node.id))
      .map((node) =>
        node.id === "core"
          ? { ...node, count: 170, countLabel: "permitted records" }
          : node,
      );
    const safeIds = new Set(safeNodes.map((node) => node.id));
    return {
      ...base,
      permissionLimited: true,
      metrics: base.metrics.map((metric) => {
        if (metric.key === "connected_sources") {
          return { ...metric, value: 2, displayValue: "2", context: "Permitted sources" };
        }
        if (metric.key === "active_agents") {
          return { ...metric, value: 2, displayValue: "2", context: "Permitted agents" };
        }
        return metric;
      }),
      nodes: safeNodes,
      edges: base.edges.filter(
        (edge) => safeIds.has(edge.from) && safeIds.has(edge.to),
      ),
      activity: base.activity.filter((item) => item.entityRef.id !== "sharepoint"),
    };
  }

  return base;
}
