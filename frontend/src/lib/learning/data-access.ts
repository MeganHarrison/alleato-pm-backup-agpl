import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, Json } from "@/types/database.types";

import type {
  ContentManagerOption,
  ContentGovernanceException,
  KnowledgeTaxonomyValue,
  LearnerAssignment,
  LearnerCourseDetail,
  LearningCourseDetail,
  LearningCourseItem,
  LearningLibraryItem,
  TrainingRoleOption,
  TrainingTopicOption,
} from "./types";

type LearningClient = SupabaseClient<Database>;
type LibraryRow = Database["public"]["Views"]["training_library_view"]["Row"];
type CatalogRow =
  Database["public"]["Views"]["knowledge_content_catalog_view"]["Row"];
type AssignmentRow =
  Database["public"]["Views"]["learner_assignments_view"]["Row"];

const UUID_LOOKUP_KEY =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export function isUuidLookupKey(value: string): boolean {
  return UUID_LOOKUP_KEY.test(value);
}
type EngagementRow =
  Database["public"]["Functions"]["get_knowledge_content_engagement_summary"]["Returns"][number];
type ManagerRow =
  Database["public"]["Functions"]["get_knowledge_content_managers"]["Returns"][number];

function queryFailure(operation: string, error: { message: string }) {
  return new Error(`Learning ${operation} failed: ${error.message}`);
}

function requireValue<T>(
  value: T | null | undefined,
  label: string,
  rowId?: string | null,
): T {
  if (value === null || value === undefined || value === "") {
    throw new Error(
      `Learning data is missing ${label}${rowId ? ` for ${rowId}` : ""}.`,
    );
  }
  return value;
}

function asRecord(value: Json | null): Record<string, Json | undefined> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, Json | undefined>)
    : {};
}

function parseTaxonomy(
  value: Json | null,
  label: string,
  rowId: string,
): KnowledgeTaxonomyValue[] {
  if (value === null) return [];
  if (!Array.isArray(value)) {
    throw new Error(
      `Learning catalog ${rowId} returned invalid ${label} taxonomy.`,
    );
  }
  return value.map((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error(
        `Learning catalog ${rowId} returned invalid ${label}[${index}].`,
      );
    }
    const record = entry as Record<string, Json | undefined>;
    const id = record.id;
    const name = record.name;
    if (
      (typeof id !== "string" && typeof id !== "number") ||
      typeof name !== "string"
    ) {
      throw new Error(
        `Learning catalog ${rowId} returned incomplete ${label}[${index}].`,
      );
    }
    return {
      id,
      name,
      ...(typeof record.slug === "string" ? { slug: record.slug } : {}),
      ...(typeof record.key === "string" ? { key: record.key } : {}),
    };
  });
}

export function getLearningContentHref(
  item: Pick<
    LearningLibraryItem,
    "id" | "slug" | "kind" | "sourceType" | "sourceId" | "sourceUrl"
  >,
): { href: string; external: boolean } {
  if (item.sourceType === "learning_course") {
    return {
      href: `/training/courses/${item.slug.replace(/^course-/u, "")}`,
      external: false,
    };
  }
  if (item.sourceType === "native_content") {
    return { href: `/training/content/${item.id}`, external: false };
  }
  if (item.sourceType === "training_resource") {
    return {
      href: `/training/resources/${item.sourceId}`,
      external: false,
    };
  }
  if (item.sourceType === "training_doc") {
    const docSlug = item.slug.replace(/^guide-/u, "");
    if (/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(docSlug)) {
      return { href: `/training/guides/${docSlug}`, external: false };
    }
    return { href: "/training/library", external: false };
  }
  if (item.sourceType === "docs" && item.kind === "video") {
    return { href: `/training/content/${item.slug}`, external: false };
  }
  if (item.sourceUrl?.startsWith("/")) {
    return { href: item.sourceUrl, external: false };
  }
  if (item.sourceUrl?.startsWith("http")) {
    return { href: item.sourceUrl, external: true };
  }
  return {
    href: "/knowledge/manage",
    external: false,
  };
}

function mapLibraryRow(
  row: LibraryRow,
  engagement?: EngagementRow,
): LearningLibraryItem {
  const id = requireValue(row.id, "content ID");
  const slug = requireValue(row.slug, "slug", id);
  const sourceType = requireValue(row.source_type, "source type", id);
  const sourceId = requireValue(row.source_id, "source ID", id);
  const metadata = asRecord(row.metadata);
  const href = getLearningContentHref({
    id,
    slug,
    sourceType,
    sourceId,
    kind: requireValue(row.content_kind, "content kind", id),
    sourceUrl: row.source_url,
  });

  return {
    id,
    slug,
    title: requireValue(row.title, "title", id),
    summary: row.summary,
    kind: requireValue(row.content_kind, "content kind", id),
    displayArea: requireValue(row.display_area, "display area", id),
    lifecycle: requireValue(row.lifecycle_status, "lifecycle", id),
    visibility: requireValue(row.visibility, "visibility", id),
    sourceType,
    sourceId,
    sourceUrl: row.source_url,
    href: href.href,
    external: href.external,
    ownerUserId: row.owner_user_id,
    ownerName: row.owner_name,
    reviewerUserId: row.reviewer_user_id,
    reviewerName: row.reviewer_name,
    lastReviewedAt: row.last_reviewed_at,
    nextReviewAt: row.next_review_at,
    updatedAt: requireValue(row.updated_at, "updated timestamp", id),
    publishedAt: row.published_at,
    engagementTrackingSupported: engagement?.tracking_supported ?? false,
    uniqueViewers: engagement?.unique_viewers ?? 0,
    completedCount: engagement?.completed_count ?? 0,
    completionRate: engagement?.completion_rate ?? 0,
    watchSeconds: engagement?.watch_seconds ?? 0,
    lastEngagedAt: engagement?.last_engaged_at ?? null,
    topics: parseTaxonomy(row.topics, "topics", id),
    roles: parseTaxonomy(row.roles, "roles", id),
    skills: parseTaxonomy(row.skills, "skills", id),
    businessAreas: parseTaxonomy(row.business_areas, "business areas", id),
    courseId: row.course_id,
    courseOutcome: row.course_outcome,
    courseDifficulty: row.course_difficulty,
    estimatedMinutes:
      row.course_estimated_minutes ??
      (typeof metadata.duration_minutes === "number"
        ? metadata.duration_minutes
        : null),
    isInternalCourse: row.is_internal_course === true,
    provider: typeof metadata.provider === "string" ? metadata.provider : null,
  };
}

function mapCatalogRow(
  row: CatalogRow,
  engagement?: EngagementRow,
): LearningLibraryItem {
  return mapLibraryRow(
    {
      ...row,
      course_completion_rule: null,
      course_difficulty: null,
      course_estimated_minutes: null,
      course_id: null,
      course_outcome: null,
      is_internal_course: row.source_type === "learning_course",
    },
    engagement,
  );
}

function mapManager(row: ManagerRow): ContentManagerOption {
  return {
    id: row.user_id,
    name: row.display_name,
    email: row.email,
  };
}

function mapAssignment(row: AssignmentRow): LearnerAssignment {
  const enrollmentId = requireValue(row.enrollment_id, "enrollment ID");
  return {
    enrollmentId,
    assignmentId: row.assignment_id,
    courseId: requireValue(row.course_id, "course ID", enrollmentId),
    courseSlug: requireValue(row.course_slug, "course slug", enrollmentId),
    title: requireValue(row.course_title, "course title", enrollmentId),
    summary: row.course_summary,
    outcome: requireValue(row.outcome, "course outcome", enrollmentId),
    estimatedMinutes: row.estimated_minutes,
    status: requireValue(row.status, "enrollment status", enrollmentId),
    requirement: requireValue(row.requirement, "requirement", enrollmentId),
    dueAt: row.due_at,
    progressPercent: row.progress_percent ?? 0,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    reason: row.assignment_reason,
    assignedAt: requireValue(
      row.assigned_at,
      "assigned timestamp",
      enrollmentId,
    ),
  };
}

function sortAssignments(
  left: LearnerAssignment,
  right: LearnerAssignment,
): number {
  const statusOrder = {
    in_progress: 0,
    overdue: 1,
    assigned: 2,
    completed: 3,
    waived: 4,
    cancelled: 5,
  } as const;
  return (
    statusOrder[left.status] - statusOrder[right.status] ||
    (left.dueAt ?? "9999").localeCompare(right.dueAt ?? "9999") ||
    left.title.localeCompare(right.title)
  );
}

export function getManagedLearningContentHref(
  item: LearningLibraryItem,
): string {
  if (item.sourceType === "learning_course") {
    return `/content/courses/${item.sourceId}`;
  }
  if (item.sourceType === "training_doc") {
    return `/training-docs/${item.sourceId}`;
  }
  if (item.sourceType === "document") {
    return `/knowledge/manage?document=${encodeURIComponent(item.sourceId)}`;
  }
  if (item.sourceType === "training_resource") {
    return item.lifecycle === "in_review"
      ? "/training/review"
      : `/training/resources/${item.sourceId}`;
  }
  return `/training/content/${item.id}`;
}

export function createLearningDataAccess(client: LearningClient) {
  async function getLibrary(): Promise<LearningLibraryItem[]> {
    const { data, error } = await client
      .from("training_library_view")
      .select("*")
      .order("updated_at", { ascending: false });
    if (error) throw queryFailure("library query", error);
    return (data ?? []).map((row) => mapLibraryRow(row));
  }

  async function getCatalog(): Promise<LearningLibraryItem[]> {
    const [catalogResult, engagementResult] = await Promise.all([
      client
        .from("knowledge_content_catalog_view")
        .select("*")
        .order("updated_at", { ascending: false }),
      client.rpc("get_knowledge_content_engagement_summary"),
    ]);
    if (catalogResult.error) {
      throw queryFailure("catalog query", catalogResult.error);
    }
    if (engagementResult.error) {
      throw queryFailure("engagement summary query", engagementResult.error);
    }
    const engagementByContentId = new Map(
      (engagementResult.data ?? []).map((row) => [row.content_item_id, row]),
    );
    return (catalogResult.data ?? []).map((row) =>
      mapCatalogRow(row, engagementByContentId.get(row.id ?? "")),
    );
  }

  async function getManagers(): Promise<ContentManagerOption[]> {
    const { data, error } = await client.rpc("get_knowledge_content_managers");
    if (error) throw queryFailure("content managers query", error);
    return (data ?? []).map(mapManager);
  }

  async function getLearnerAssignments(
    learnerId?: string,
  ): Promise<LearnerAssignment[]> {
    let query = client.from("learner_assignments_view").select("*");
    if (learnerId) query = query.eq("learner_id", learnerId);
    const { data, error } = await query;
    if (error) throw queryFailure("learner assignments query", error);
    return (data ?? []).map(mapAssignment).sort(sortAssignments);
  }

  async function getCourse(
    courseSlugOrId: string,
    options: {
      by: "slug" | "id";
      enrollmentId?: string;
      includeDrafts?: boolean;
    },
  ): Promise<LearningCourseDetail | LearnerCourseDetail | null> {
    let courseQuery = client.from("learning_course").select("*");
    courseQuery =
      options.by === "slug"
        ? courseQuery.eq("slug", courseSlugOrId)
        : courseQuery.eq("id", courseSlugOrId);
    const { data: course, error: courseError } =
      await courseQuery.maybeSingle();
    if (courseError) throw queryFailure("course query", courseError);
    if (!course) return null;
    if (!options.includeDrafts && course.lifecycle_status !== "published") {
      return null;
    }

    const { data: sections, error: sectionError } = await client
      .from("learning_course_section")
      .select("*")
      .eq("course_id", course.id)
      .order("sort_order", { ascending: true });
    if (sectionError) throw queryFailure("course sections query", sectionError);

    const sectionIds = (sections ?? []).map((section) => section.id);
    const { data: items, error: itemError } =
      sectionIds.length > 0
        ? await client
            .from("learning_course_item")
            .select("*")
            .in("section_id", sectionIds)
            .order("sort_order", { ascending: true })
        : { data: [], error: null };
    if (itemError) throw queryFailure("course items query", itemError);

    const contentIds = [
      ...new Set((items ?? []).map((item) => item.content_item_id)),
    ];
    const { data: contentRows, error: contentError } =
      contentIds.length > 0
        ? await client
            .from("knowledge_content_catalog_view")
            .select("*")
            .in("id", contentIds)
        : { data: [], error: null };
    if (contentError) throw queryFailure("course content query", contentError);

    const nativeSourceIds = (contentRows ?? [])
      .filter((content) => content.source_type === "native_content")
      .map((content) =>
        requireValue(content.source_id, "native source ID", content.id),
      );
    const { data: nativeRows, error: nativeError } =
      nativeSourceIds.length > 0
        ? await client
            .from("knowledge_native_content")
            .select("id,body_markdown")
            .in("id", nativeSourceIds)
        : { data: [], error: null };
    if (nativeError)
      throw queryFailure("native course content query", nativeError);

    const progressRows =
      options.enrollmentId && (items ?? []).length > 0
        ? await client
            .from("learning_item_progress")
            .select("course_item_id,status,completed_at")
            .eq("enrollment_id", options.enrollmentId)
        : { data: [], error: null };
    if (progressRows.error) {
      throw queryFailure("course progress query", progressRows.error);
    }

    const contentById = new Map(
      (contentRows ?? []).map((content) => [content.id, content]),
    );
    const nativeById = new Map(
      (nativeRows ?? []).map((native) => [native.id, native.body_markdown]),
    );
    const progressByItem = new Map(
      (progressRows.data ?? []).map((progress) => [
        progress.course_item_id,
        progress,
      ]),
    );

    const mappedSections = (sections ?? []).map((section) => ({
      id: section.id,
      title: section.title,
      description: section.description,
      sortOrder: section.sort_order,
      items: (items ?? [])
        .filter((item) => item.section_id === section.id)
        .map((item): LearningCourseItem => {
          const content = contentById.get(item.content_item_id);
          if (!content) {
            throw new Error(
              `Course "${course.title}" item ${item.id} references inaccessible catalog content ${item.content_item_id}.`,
            );
          }
          const catalogItem = mapCatalogRow(content);
          const progress = progressByItem.get(item.id);
          return {
            id: item.id,
            sectionId: section.id,
            contentItemId: item.content_item_id,
            title: item.title_override?.trim() || catalogItem.title,
            summary: catalogItem.summary,
            instructions: item.instructions,
            required: item.required,
            estimatedMinutes: item.estimated_minutes,
            sortOrder: item.sort_order,
            kind: catalogItem.kind,
            sourceType: catalogItem.sourceType,
            sourceId: catalogItem.sourceId,
            sourceUrl: catalogItem.sourceUrl,
            href: catalogItem.href,
            nativeBody:
              catalogItem.sourceType === "native_content"
                ? (nativeById.get(catalogItem.sourceId) ?? null)
                : null,
            progressStatus: progress?.status ?? "not_started",
            completedAt: progress?.completed_at ?? null,
          };
        }),
    }));

    const { data: blockers, error: blockerError } = await client.rpc(
      "learning_course_publication_blockers",
      { p_course_id: course.id },
    );
    if (blockerError && options.includeDrafts) {
      throw queryFailure("course publication blockers query", blockerError);
    }

    const detail: LearningCourseDetail = {
      id: course.id,
      contentItemId: course.content_item_id,
      slug: course.slug,
      title: course.title,
      summary: course.summary,
      outcome: course.outcome,
      difficulty: course.difficulty,
      estimatedMinutes: course.estimated_minutes,
      prerequisites: course.prerequisites,
      lifecycle: course.lifecycle_status,
      visibility: course.visibility,
      ownerUserId: course.owner_user_id,
      reviewerUserId: course.reviewer_user_id,
      completionRule: course.completion_rule,
      publicationBlockers: blockers ?? [],
      sections: mappedSections,
    };

    if (!options.enrollmentId) return detail;
    const { data: assignment, error: assignmentError } = await client
      .from("learner_assignments_view")
      .select("*")
      .eq("enrollment_id", options.enrollmentId)
      .maybeSingle();
    if (assignmentError) {
      throw queryFailure("course enrollment query", assignmentError);
    }
    if (!assignment) return null;
    return { ...detail, enrollment: mapAssignment(assignment) };
  }

  async function getNativeContent(contentItemId: string) {
    const { data: contentById, error: idLookupError } = isUuidLookupKey(
      contentItemId,
    )
      ? await client
          .from("knowledge_content_catalog_view")
          .select("*")
          .eq("id", contentItemId)
          .maybeSingle()
      : { data: null, error: null };
    if (idLookupError) {
      throw queryFailure("content detail query", idLookupError);
    }
    const { data: contentBySlug, error: slugLookupError } = contentById
      ? { data: null, error: null }
      : await client
          .from("knowledge_content_catalog_view")
          .select("*")
          .eq("slug", contentItemId)
          .maybeSingle();
    if (slugLookupError) {
      throw queryFailure("content slug lookup", slugLookupError);
    }
    const content = contentById ?? contentBySlug;
    if (!content) return null;
    const item = mapCatalogRow(content);
    if (item.sourceType !== "native_content") {
      return { item, body: null, metadata: asRecord(content.metadata) };
    }
    const { data: native, error: nativeError } = await client
      .from("knowledge_native_content")
      .select("body_markdown")
      .eq("id", item.sourceId)
      .maybeSingle();
    if (nativeError)
      throw queryFailure("native content detail query", nativeError);
    if (!native) {
      throw new Error(
        `Content "${item.title}" references missing native source ${item.sourceId}.`,
      );
    }
    return {
      item,
      body: native.body_markdown,
      metadata: asRecord(content.metadata),
    };
  }

  async function getGovernanceExceptions(): Promise<
    ContentGovernanceException[]
  > {
    const { data, error } = await client
      .from("content_governance_exceptions_view")
      .select("*")
      .order("next_review_at", { ascending: true, nullsFirst: false });
    if (error) throw queryFailure("governance exceptions query", error);

    const catalog = await getCatalog();
    const hrefById = new Map(
      catalog.map((item) => [item.id, getManagedLearningContentHref(item)]),
    );

    return (data ?? []).map((row) => {
      const contentItemId = requireValue(row.content_item_id, "content ID");
      return {
        contentItemId,
        title: requireValue(row.title, "title", contentItemId),
        kind: requireValue(row.content_kind, "content kind", contentItemId),
        lifecycle: requireValue(
          row.lifecycle_status,
          "lifecycle",
          contentItemId,
        ),
        ownerUserId: row.owner_user_id,
        reviewerUserId: row.reviewer_user_id,
        nextReviewAt: row.next_review_at,
        exceptions: row.exceptions ?? [],
        href:
          hrefById.get(contentItemId) ?? `/content?selected=${contentItemId}`,
      };
    });
  }

  async function getRoles(): Promise<TrainingRoleOption[]> {
    const { data, error } = await client
      .from("training_role")
      .select("id,slug,name")
      .eq("active", true)
      .order("sort_order");
    if (error) throw queryFailure("roles query", error);
    return data ?? [];
  }

  async function getTopics(): Promise<TrainingTopicOption[]> {
    const { data, error } = await client
      .from("training_topic")
      .select("id,slug,name")
      .eq("active", true)
      .order("sort_order");
    if (error) throw queryFailure("topics query", error);
    return data ?? [];
  }

  return {
    getCatalog,
    getCourse,
    getGovernanceExceptions,
    getLearnerAssignments,
    getLibrary,
    getManagers,
    getNativeContent,
    getRoles,
    getTopics,
  };
}
