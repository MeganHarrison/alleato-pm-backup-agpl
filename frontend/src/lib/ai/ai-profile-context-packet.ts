import type { AiProfileMemory } from "@/lib/ai/ai-profile-summary";

export type AiProfileContextUser = {
  id?: string | null;
  fullName?: string | null;
  email?: string | null;
  company?: string | null;
  title?: string | null;
  role?: string | null;
  profileCompleteness?: number | null;
  isAdmin?: boolean | null;
  isDeveloper?: boolean | null;
};

export type AiProfileLeadershipContextItem = {
  id: string;
  label: string;
  content: string;
  source: string;
  updatedAt: string;
};

export type AiProfileLeadershipContextPolicy =
  | {
      state: "not_configured";
      reason: string;
    }
  | {
      state: "unauthorized";
      reason: string;
    }
  | {
      state: "available";
      source: string;
      items: AiProfileLeadershipContextItem[];
    };

export type AiProfileContextPacket = {
  status: "ready" | "degraded";
  identity: {
    userId: string | null;
    displayName: string;
    email: string | null;
    company: string | null;
    title: string | null;
    role: string | null;
    profileCompleteness: number | null;
  };
  approvalPolicy: {
    authority: "admin" | "standard" | "unknown";
    defaultWriteMode: "commit_allowed" | "preview_only";
    reason: string;
  };
  memoryContext: {
    included: Pick<
      AiProfileMemory,
      | "id"
      | "type"
      | "content"
      | "confidence"
      | "importance"
      | "project_id"
      | "source"
      | "visibility"
      | "created_at"
    >[];
    omittedCount: number;
    selectionReason: string;
  };
  notificationPreferences: {
    state: "not_configured";
    defaultRouting: "matrix_defaults";
    reason: string;
  };
  leadershipContext: AiProfileLeadershipContextPolicy;
  blockedCapabilities: string[];
  warnings: string[];
};

export type AiProfileContextAuditCategory = {
  id:
    | "identity"
    | "approval"
    | "memory"
    | "notifications"
    | "leadership"
    | "blocked";
  label: string;
  state: "ready" | "degraded" | "not_configured";
  summary: string;
  detail: string;
};

export type AiProfileContextUsageSummary = {
  surfaces: string[];
  summary: string;
};

export type BuildAiProfileContextPacketParams = {
  user: AiProfileContextUser | null;
  memories?: AiProfileMemory[];
  activeProjectId?: number | null;
  maxMemories?: number;
  leadershipContext?: AiProfileLeadershipContextPolicy;
};

const DEFAULT_MAX_MEMORIES = 5;

function normalizeText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function memoryScore(memory: AiProfileMemory, activeProjectId: number | null) {
  const projectBoost =
    activeProjectId !== null && memory.project_id === activeProjectId ? 2 : 0;
  const globalBoost = memory.project_id === null ? 0.5 : 0;
  const importance = Number.isFinite(memory.importance) ? memory.importance : 0;
  const confidence = Number.isFinite(memory.confidence) ? memory.confidence : 0;
  const createdAt = new Date(memory.created_at).getTime() / 10000000000000;

  return projectBoost + globalBoost + importance + confidence + createdAt;
}

function selectRelevantMemories({
  memories,
  activeProjectId,
  maxMemories,
}: {
  memories: AiProfileMemory[];
  activeProjectId: number | null;
  maxMemories: number;
}) {
  return [...memories]
    .filter((memory) => memory.content.trim().length > 0)
    .sort(
      (a, b) =>
        memoryScore(b, activeProjectId) - memoryScore(a, activeProjectId),
    )
    .slice(0, maxMemories)
    .map(
      ({
        id,
        type,
        content,
        confidence,
        importance,
        project_id,
        source,
        visibility,
        created_at,
      }) => ({
        id,
        type,
        content,
        confidence,
        importance,
        project_id,
        source,
        visibility,
        created_at,
      }),
    );
}

export function buildAiProfileContextPacket({
  user,
  memories = [],
  activeProjectId = null,
  maxMemories = DEFAULT_MAX_MEMORIES,
  leadershipContext = {
    state: "not_configured",
    reason:
      "Leadership coaching context has no durable source or visibility policy yet.",
  },
}: BuildAiProfileContextPacketParams): AiProfileContextPacket {
  const warnings: string[] = [];
  const blockedCapabilities: string[] = [];
  const userId = normalizeText(user?.id);
  const displayName = normalizeText(user?.fullName) ?? "Unknown user";
  const email = normalizeText(user?.email);
  const authority =
    user?.isAdmin === true || user?.isDeveloper === true
      ? "admin"
      : userId
        ? "standard"
        : "unknown";

  if (!userId) {
    warnings.push("User identity is unresolved.");
    blockedCapabilities.push("write_actions", "delivery_actions");
  }

  if (authority === "unknown") {
    warnings.push("Approval authority is unknown.");
  }

  if (leadershipContext.state !== "available") {
    warnings.push(leadershipContext.reason);
  }

  const boundedMaxMemories = Math.max(0, Math.min(maxMemories, 8));
  const included = selectRelevantMemories({
    memories,
    activeProjectId,
    maxMemories: boundedMaxMemories,
  });

  return {
    status: warnings.length > 0 ? "degraded" : "ready",
    identity: {
      userId,
      displayName,
      email,
      company: normalizeText(user?.company),
      title: normalizeText(user?.title),
      role: normalizeText(user?.role),
      profileCompleteness:
        typeof user?.profileCompleteness === "number"
          ? user.profileCompleteness
          : null,
    },
    approvalPolicy: {
      authority,
      defaultWriteMode:
        authority === "admin" ? "commit_allowed" : "preview_only",
      reason:
        authority === "admin"
          ? "Admin or developer profile can proceed to commit after preview and required confirmations."
          : "Non-admin or unresolved authority defaults to preview-only until explicit commit eligibility is checked.",
    },
    memoryContext: {
      included,
      omittedCount: Math.max(0, memories.length - included.length),
      selectionReason:
        activeProjectId === null
          ? "Selected highest-confidence global memories."
          : "Selected project-matching memories first, then high-confidence global memories.",
    },
    notificationPreferences: {
      state: "not_configured",
      defaultRouting: "matrix_defaults",
      reason:
        "Notification preferences are not user-configured yet; route through the shared notification matrix defaults.",
    },
    leadershipContext,
    blockedCapabilities,
    warnings,
  };
}

export function renderAiProfileContextPacketBlock(
  packet: AiProfileContextPacket,
): string {
  const lines = [
    "## AI Profile Context",
    `Status: ${packet.status}`,
    `User: ${packet.identity.displayName}${
      packet.identity.email ? ` <${packet.identity.email}>` : ""
    }`,
    `Role: ${packet.identity.role ?? "unknown"}`,
    `Title: ${packet.identity.title ?? "unknown"}`,
    `Approval authority: ${packet.approvalPolicy.authority}`,
    `Default write mode: ${packet.approvalPolicy.defaultWriteMode}`,
    `Approval rule: ${packet.approvalPolicy.reason}`,
    `Notification routing: ${packet.notificationPreferences.defaultRouting} (${packet.notificationPreferences.reason})`,
  ];

  if (packet.blockedCapabilities.length > 0) {
    lines.push(
      `Blocked capabilities: ${packet.blockedCapabilities.join(", ")}`,
    );
  }

  if (packet.memoryContext.included.length > 0) {
    lines.push(
      `Memory selection: ${packet.memoryContext.selectionReason} Omitted ${packet.memoryContext.omittedCount}.`,
      "Selected memories:",
      ...packet.memoryContext.included.map(
        (memory) =>
          `- ${memory.type} (${memory.visibility ?? "private"}, source: ${
            memory.source
          }, confidence: ${Math.round(memory.confidence * 100)}%): ${
            memory.content
          }`,
      ),
    );
  } else {
    lines.push("Selected memories: none");
  }

  if (packet.leadershipContext.state === "available") {
    lines.push(
      `Leadership context: available from ${packet.leadershipContext.source}`,
      ...packet.leadershipContext.items.map(
        (item) => `- ${item.label} (source: ${item.source}): ${item.content}`,
      ),
    );
  } else {
    lines.push(
      `Leadership context: ${packet.leadershipContext.state} (${packet.leadershipContext.reason})`,
    );
  }

  if (packet.warnings.length > 0) {
    lines.push(
      "Profile context warnings:",
      ...packet.warnings.map((warning) => `- ${warning}`),
    );
  }

  lines.push(
    "Use this profile context only when it is relevant. Do not imply unavailable leadership context was used. For write, delivery, financial, or client-facing actions, follow the default write mode and preview-first approval rule.",
  );

  return lines.join("\n");
}

export function buildAiProfileContextUsageSummary(
  packet: AiProfileContextPacket,
): AiProfileContextUsageSummary {
  const surfaces = [
    "assistant prompts",
    "preview-first write actions",
    "AI approval routing",
    "memory selection",
  ];

  if (packet.leadershipContext.state === "available") {
    surfaces.push("leadership coaching context");
  }

  return {
    surfaces,
    summary: surfaces.join(", "),
  };
}

function formatWriteMode(
  value: AiProfileContextPacket["approvalPolicy"]["defaultWriteMode"],
) {
  return value === "commit_allowed"
    ? "Commit allowed after preview"
    : "Preview only";
}

function formatLeadershipState(
  leadershipContext: AiProfileContextPacket["leadershipContext"],
) {
  if (leadershipContext.state === "available") {
    return `${leadershipContext.items.length} item${
      leadershipContext.items.length === 1 ? "" : "s"
    } from ${leadershipContext.source}`;
  }

  return leadershipContext.reason;
}

export function buildAiProfileContextAuditCategories(
  packet: AiProfileContextPacket,
): AiProfileContextAuditCategory[] {
  return [
    {
      id: "identity",
      label: "Identity",
      state: packet.identity.userId ? "ready" : "degraded",
      summary: packet.identity.displayName,
      detail:
        [packet.identity.title, packet.identity.company, packet.identity.role]
          .filter(Boolean)
          .join(" | ") || "No role, title, or company context recorded.",
    },
    {
      id: "approval",
      label: "Approval and writes",
      state:
        packet.approvalPolicy.authority === "unknown" ? "degraded" : "ready",
      summary: formatWriteMode(packet.approvalPolicy.defaultWriteMode),
      detail: packet.approvalPolicy.reason,
    },
    {
      id: "memory",
      label: "Selected memories",
      state: packet.memoryContext.included.length > 0 ? "ready" : "degraded",
      summary: `${packet.memoryContext.included.length} included, ${packet.memoryContext.omittedCount} omitted`,
      detail: packet.memoryContext.selectionReason,
    },
    {
      id: "notifications",
      label: "Notification routing",
      state: "not_configured",
      summary: "Matrix defaults",
      detail: packet.notificationPreferences.reason,
    },
    {
      id: "leadership",
      label: "Leadership context",
      state:
        packet.leadershipContext.state === "available"
          ? "ready"
          : "not_configured",
      summary:
        packet.leadershipContext.state === "available"
          ? "Available"
          : "Not configured",
      detail: formatLeadershipState(packet.leadershipContext),
    },
    {
      id: "blocked",
      label: "Warnings and blocks",
      state:
        packet.blockedCapabilities.length > 0 || packet.warnings.length > 0
          ? "degraded"
          : "ready",
      summary:
        packet.blockedCapabilities.length > 0
          ? `Blocked: ${packet.blockedCapabilities.join(", ")}`
          : packet.warnings.length > 0
            ? `${packet.warnings.length} warning${
                packet.warnings.length === 1 ? "" : "s"
              }`
            : "None",
      detail:
        packet.warnings.length > 0
          ? packet.warnings.join(" ")
          : "No profile context warnings or blocked capabilities.",
    },
  ];
}
