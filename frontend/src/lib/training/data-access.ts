import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";

import type {
  TrainingDiscoveryMetrics,
  TrainingResource,
  TrainingResourceFilters,
  TrainingFreshnessOutcome,
  TrainingFreshnessReviewInput,
  TrainingFreshnessReviewItem,
  TrainingResourceReviewInput,
  TrainingResourceStatus,
  TrainingRole,
  TrainingTopic,
} from "./types";

type TrainingClient = SupabaseClient<Database>;
type ReviewerGuard = (where: string) => Promise<string>;
type RoleRow = Database["public"]["Tables"]["training_role"]["Row"];
type TopicRow = Database["public"]["Tables"]["training_topic"]["Row"];

const RESOURCE_COLUMNS =
  "id,topic_id,title,description,url,embed_url,thumbnail_url,provider,resource_type,level,track,status,duration_minutes,created_at,metadata" as const;
const FRESHNESS_OUTCOMES = new Set<TrainingFreshnessOutcome>([
  "healthy",
  "unavailable",
  "redirected",
  "title_changed",
  "free_unproven",
  "paid",
  "blocked",
]);

function compactFilters(filters: TrainingResourceFilters) {
  return Object.fromEntries(
    Object.entries(filters).filter(
      ([, value]) => value !== undefined && value !== "",
    ),
  );
}

function queryFailure(
  operation: string,
  error: { message: string },
  filters?: TrainingResourceFilters,
) {
  const context = filters
    ? ` for filters ${JSON.stringify(compactFilters(filters))}`
    : "";
  return new Error(
    `Training data ${operation} failed${context}: ${error.message}`,
  );
}

function mapRole(row: RoleRow): TrainingRole {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    aliases: row.aliases,
    sortOrder: row.sort_order,
  };
}

function mapTopic(row: TopicRow): TrainingTopic {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    sortOrder: row.sort_order,
  };
}

function recordValue(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function mapDiscoveryEvidence(metadata: unknown): TrainingResource["discovery"] {
  const finder = recordValue(recordValue(metadata)?.finder);
  const learning = recordValue(finder?.learning);
  const explanation = Array.isArray(learning?.explanation)
    ? learning.explanation.filter(
        (item): item is string => typeof item === "string",
      )
    : [];
  if (
    typeof learning?.policyVersion !== "string" ||
    typeof learning.strategy !== "string" ||
    typeof learning.score !== "number"
  ) {
    return null;
  }
  return {
    policyVersion: learning.policyVersion,
    strategy: learning.strategy,
    score: learning.score,
    explanation,
  };
}

function mapDiscoveryMetrics(value: unknown): TrainingDiscoveryMetrics {
  const metrics = recordValue(value);
  const activePolicy = recordValue(metrics?.activePolicy);
  const strategyPerformance = Array.isArray(metrics?.strategyPerformance)
    ? metrics.strategyPerformance
        .map(recordValue)
        .filter((item): item is Record<string, unknown> => item !== null)
    : [];
  if (
    !metrics ||
    !activePolicy ||
    typeof activePolicy.version !== "string" ||
    typeof activePolicy.explorationRate !== "number"
  ) {
    throw new Error(
      "Training discovery metrics returned an invalid active-policy contract.",
    );
  }
  const numeric = (key: string) => {
    const result = metrics[key];
    if (typeof result !== "number") {
      throw new Error(
        `Training discovery metrics returned an invalid ${key} value.`,
      );
    }
    return result;
  };
  return {
    activePolicy: {
      version: activePolicy.version,
      explorationRate: activePolicy.explorationRate,
      activatedAt:
        typeof activePolicy.activatedAt === "string"
          ? activePolicy.activatedAt
          : null,
      evaluation: recordValue(activePolicy.evaluation) ?? {},
    },
    runs: numeric("runs"),
    candidates: numeric("candidates"),
    reviewed: numeric("reviewed"),
    published: numeric("published"),
    archived: numeric("archived"),
    duplicates: numeric("duplicates"),
    approvalRate: numeric("approvalRate"),
    strategyPerformance: strategyPerformance.map((item) => ({
      strategy: String(item.strategy ?? ""),
      reviewed: Number(item.reviewed ?? 0),
      published: Number(item.published ?? 0),
      approval_rate: Number(item.approval_rate ?? 0),
    })),
  };
}

export function createTrainingDataAccess(
  client: TrainingClient,
  requireReviewer: ReviewerGuard,
  now: () => Date = () => new Date(),
) {
  void now;
  async function getRoles(): Promise<TrainingRole[]> {
    const { data, error } = await client
      .from("training_role")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (error) throw queryFailure("getRoles", error);
    return (data ?? []).map(mapRole);
  }

  async function getTopics(): Promise<TrainingTopic[]> {
    const { data, error } = await client
      .from("training_topic")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (error) throw queryFailure("getTopics", error);
    return (data ?? []).map(mapTopic);
  }

  async function getResources(
    filters: TrainingResourceFilters = {},
  ): Promise<TrainingResource[]> {
    const status = filters.status ?? "published";
    if (status !== "published") {
      await requireReviewer("training.getResources");
    }

    let resourceIdsForRole: string[] | null = null;
    if (filters.role) {
      const { data: role, error: roleError } = await client
        .from("training_role")
        .select("id")
        .eq("slug", filters.role)
        .maybeSingle();

      if (roleError) {
        throw queryFailure("getResources.role", roleError, filters);
      }
      if (!role) return [];

      const { data: roleLinks, error: roleLinksError } = await client
        .from("training_resource_role")
        .select("resource_id")
        .eq("role_id", role.id);

      if (roleLinksError) {
        throw queryFailure("getResources.roleLinks", roleLinksError, filters);
      }

      resourceIdsForRole = (roleLinks ?? []).map((link) => link.resource_id);
      if (resourceIdsForRole.length === 0) return [];
    }

    let resourceQuery = client
      .from("training_resource")
      .select(RESOURCE_COLUMNS)
      .eq("status", status);

    if (resourceIdsForRole) {
      resourceQuery = resourceQuery.in("id", resourceIdsForRole);
    }
    if (filters.track) {
      resourceQuery = resourceQuery.eq("track", filters.track);
    }
    if (filters.type) {
      resourceQuery = resourceQuery.eq("resource_type", filters.type);
    }
    if (filters.level) {
      resourceQuery = resourceQuery.eq("level", filters.level);
    }
    if (filters.query?.trim()) {
      resourceQuery = resourceQuery.textSearch(
        "search_vector",
        filters.query.trim(),
        { config: "english", type: "websearch" },
      );
    }

    const { data: resourceRows, error: resourceError } =
      await resourceQuery.order("created_at", { ascending: false });

    if (resourceError) {
      throw queryFailure("getResources.resources", resourceError, filters);
    }

    const resources = resourceRows ?? [];
    if (resources.length === 0) return [];

    const resourceIds = resources.map((resource) => resource.id);
    const topicIds = [
      ...new Set(resources.map((resource) => resource.topic_id)),
    ];

    const [
      { data: topicRows, error: topicError },
      { data: resourceRoleRows, error: resourceRoleError },
    ] = await Promise.all([
      client.from("training_topic").select("*").in("id", topicIds),
      client
        .from("training_resource_role")
        .select("resource_id,role_id")
        .in("resource_id", resourceIds),
    ]);

    if (topicError) {
      throw queryFailure("getResources.topics", topicError, filters);
    }
    if (resourceRoleError) {
      throw queryFailure(
        "getResources.resourceRoles",
        resourceRoleError,
        filters,
      );
    }

    const roleIds = [
      ...new Set((resourceRoleRows ?? []).map((link) => link.role_id)),
    ];
    let roleRows: RoleRow[] = [];
    if (roleIds.length > 0) {
      const { data, error } = await client
        .from("training_role")
        .select("*")
        .in("id", roleIds);

      if (error) {
        throw queryFailure("getResources.roles", error, filters);
      }
      roleRows = data ?? [];
    }

    const topicsById = new Map(
      (topicRows ?? []).map((topic) => [topic.id, topic]),
    );
    const rolesById = new Map(roleRows.map((role) => [role.id, mapRole(role)]));
    const missingRoleIds = roleIds.filter((roleId) => !rolesById.has(roleId));
    if (missingRoleIds.length > 0) {
      throw new Error(
        `Training data getResources mapping failed: roles ${missingRoleIds.join(", ")} are inaccessible for linked resources.`,
      );
    }

    const roleIdsByResourceId = new Map<string, string[]>();
    for (const link of resourceRoleRows ?? []) {
      const current = roleIdsByResourceId.get(link.resource_id) ?? [];
      current.push(link.role_id);
      roleIdsByResourceId.set(link.resource_id, current);
    }

    return resources.map((resource) => {
      const topic = topicsById.get(resource.topic_id);
      if (!topic) {
        throw new Error(
          `Training data getResources mapping failed: topic ${resource.topic_id} is missing for resource ${resource.id}.`,
        );
      }

      return {
        id: resource.id,
        topicId: resource.topic_id,
        topicSlug: topic.slug,
        topicName: topic.name,
        title: resource.title,
        description: resource.description,
        url: resource.url,
        embedUrl: resource.embed_url,
        thumbnailUrl: resource.thumbnail_url,
        provider: resource.provider,
        type: resource.resource_type,
        level: resource.level,
        track: resource.track,
        status: resource.status,
        durationMinutes: resource.duration_minutes,
        createdAt: resource.created_at,
        discovery: mapDiscoveryEvidence(resource.metadata),
        roles: (roleIdsByResourceId.get(resource.id) ?? [])
          .map((roleId) => rolesById.get(roleId))
          .filter((role): role is TrainingRole => Boolean(role))
          .sort(
            (left, right) =>
              left.sortOrder - right.sortOrder ||
              left.name.localeCompare(right.name),
          ),
      };
    });
  }

  async function reviewResource(
    input: TrainingResourceReviewInput,
  ): Promise<TrainingResourceStatus> {
    await requireReviewer("training.reviewResource");

    const status: TrainingResourceStatus =
      input.decision === "publish" ? "published" : "archived";
    const { data, error } = await client.rpc(
      "review_training_resource_candidate_locked",
      {
        p_resource_id: input.resourceId,
        p_decision: input.decision,
        p_reason_codes: input.reasonCodes,
        p_ratings: input.ratings,
        p_notes: input.notes?.trim() || undefined,
      },
    );

    if (error) {
      throw queryFailure("reviewResource", error, { status: "review" });
    }
    if (data !== status) {
      throw new Error(
        `Training resource ${input.resourceId} returned an unexpected decision receipt.`,
      );
    }

    return status;
  }

  async function getDiscoveryMetrics(): Promise<TrainingDiscoveryMetrics> {
    await requireReviewer("training.getDiscoveryMetrics");
    const { data, error } = await client.rpc(
      "get_training_discovery_admin_metrics",
    );
    if (error) {
      throw queryFailure("getDiscoveryMetrics", error);
    }
    return mapDiscoveryMetrics(data);
  }

  async function getPendingFreshnessReviews(): Promise<
    TrainingFreshnessReviewItem[]
  > {
    await requireReviewer("training.getPendingFreshnessReviews");

    const { data: checks, error } = await client
      .from("training_resource_freshness_checks")
      .select(
        "id,resource_id,outcome,recommended_action,occurrence_count,last_seen_at,http_status,final_url,observed_title",
      )
      .eq("review_status", "pending")
      .order("last_seen_at", { ascending: false });

    if (error) {
      throw queryFailure("getPendingFreshnessReviews", error);
    }
    if (!checks || checks.length === 0) return [];

    const resourcesById = new Map(
      (await getResources({ status: "published" })).map((resource) => [
        resource.id,
        resource,
      ]),
    );

    return checks.map((check) => {
      const resource = resourcesById.get(check.resource_id);
      if (!resource) {
        throw new Error(
          `Training freshness review ${check.id} references a resource that is not published or accessible. Refresh the queue after resolving the source lifecycle state.`,
        );
      }
      if (!FRESHNESS_OUTCOMES.has(check.outcome as TrainingFreshnessOutcome)) {
        throw new Error(
          `Training freshness review ${check.id} has unsupported outcome "${check.outcome}".`,
        );
      }
      if (
        check.recommended_action !== "keep" &&
        check.recommended_action !== "archive"
      ) {
        throw new Error(
          `Training freshness review ${check.id} has unsupported action "${check.recommended_action}".`,
        );
      }

      return {
        checkId: check.id,
        resource,
        outcome: check.outcome as TrainingFreshnessOutcome,
        recommendedAction: check.recommended_action,
        occurrenceCount: check.occurrence_count,
        lastSeenAt: check.last_seen_at,
        httpStatus: check.http_status,
        finalUrl: check.final_url,
        observedTitle: check.observed_title,
      };
    });
  }

  async function reviewFreshnessCheck(
    input: TrainingFreshnessReviewInput,
  ): Promise<TrainingFreshnessReviewInput["decision"]> {
    await requireReviewer("training.reviewFreshnessCheck");

    const { data, error } = await client.rpc(
      "review_training_resource_freshness_check",
      {
        p_check_id: input.checkId,
        p_decision: input.decision,
        p_notes: input.notes,
      },
    );

    if (error) {
      throw queryFailure("reviewFreshnessCheck", error);
    }
    if (data !== input.decision) {
      throw new Error(
        `Training freshness review ${input.checkId} returned an unexpected decision receipt.`,
      );
    }
    return input.decision;
  }

  return {
    getDiscoveryMetrics,
    getPendingFreshnessReviews,
    getResources,
    getRoles,
    getTopics,
    reviewFreshnessCheck,
    reviewResource,
  };
}
