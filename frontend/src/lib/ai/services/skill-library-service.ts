import { z } from "zod";

import { toSessionUuid } from "@/lib/ai/session-id";
import { serviceDb } from "@/lib/supabase/service-db";
import type { Database, Json } from "@/types/database.types";

type Tables = Database["public"]["Tables"];

export type AiSkillRow = Tables["ai_skills"]["Row"];
export type AiSkillInsert = Tables["ai_skills"]["Insert"];
export type AiSkillUpdate = Tables["ai_skills"]["Update"];
export type AiSkillUsageEventRow = Tables["ai_skill_usage_events"]["Row"];
export type AiSkillUsageEventInsert =
  Tables["ai_skill_usage_events"]["Insert"];

export type AiSkillScopeType = "personal" | "project" | "team" | "company";
export type AiSkillStatus =
  | "draft"
  | "candidate"
  | "in_review"
  | "active"
  | "rejected"
  | "archived";
export type AiSkillRiskLevel = "low" | "medium" | "high";
export type AiSkillUsageOutcome =
  | "used"
  | "helpful"
  | "unhelpful"
  | "blocked"
  | "error";

export interface AiSkillExample {
  input?: string | null;
  output?: string | null;
  notes?: string | null;
}

export interface AiSkill {
  id: string;
  title: string;
  slug: string;
  summary: string;
  body: string;
  instructions: string;
  category: string;
  scopeType: AiSkillScopeType;
  projectId: number | null;
  ownerUserId: string | null;
  reviewerUserId: string | null;
  status: AiSkillStatus;
  version: number;
  supersedesSkillId: string | null;
  examples: AiSkillExample[];
  sourceEventIds: string[];
  riskLevel: AiSkillRiskLevel;
  usageCount: number;
  lastUsedAt: string | null;
  reviewedAt: string | null;
  reviewNotes: string | null;
  metadata: Json;
  createdAt: string;
  updatedAt: string;
}

export interface ListActiveVisibleSkillsParams {
  viewerUserId: string;
  viewerProjectIds?: number[];
  category?: string;
  scopeTypes?: AiSkillScopeType[];
  limit?: number;
}

export interface CreateSkillParams {
  title: string;
  slug?: string | null;
  summary: string;
  body: string;
  instructions?: string | null;
  category: string;
  scopeType: AiSkillScopeType;
  projectId?: number | null;
  ownerUserId?: string | null;
  reviewerUserId?: string | null;
  status?: AiSkillStatus;
  version?: number;
  supersedesSkillId?: string | null;
  examples?: AiSkillExample[];
  sourceEventIds?: string[];
  riskLevel?: AiSkillRiskLevel;
  metadata?: Json;
}

export interface UpdateSkillParams {
  skillId: string;
  title?: string;
  slug?: string;
  summary?: string;
  body?: string;
  instructions?: string;
  category?: string;
  scopeType?: AiSkillScopeType;
  projectId?: number | null;
  ownerUserId?: string | null;
  reviewerUserId?: string | null;
  status?: AiSkillStatus;
  version?: number;
  supersedesSkillId?: string | null;
  examples?: AiSkillExample[];
  sourceEventIds?: string[];
  riskLevel?: AiSkillRiskLevel;
  metadata?: Json;
}

export interface ReviewSkillParams {
  skillId: string;
  reviewerUserId: string;
  status: Extract<AiSkillStatus, "active" | "rejected" | "archived" | "in_review">;
  reviewNotes?: string | null;
  reviewedAt?: string | null;
}

export interface RecordSkillUsageParams {
  skillId: string;
  userId?: string | null;
  projectId?: number | null;
  sessionId?: string | null;
  surface: string;
  outcome?: AiSkillUsageOutcome;
  metadata?: Json;
}

export interface SkillLibraryListResponse {
  skills: Array<{
    id: string;
    title: string;
    summary: string;
    category: string;
    scope: AiSkillScopeType;
    projectId: number | null;
    projectName: string | null;
    ownerName: string | null;
    reviewerName: string | null;
    version: string;
    examples: AiSkillExample[];
    usageCount: number;
    lastUsedAt: string | null;
    status: AiSkillStatus;
    isActive: boolean;
    isVisible: boolean;
  }>;
  filters: {
    categories: string[];
    scopes: AiSkillScopeType[];
    projects: Array<{ id: number; name: string }>;
    statuses: AiSkillStatus[];
  };
}

export interface ListVisibleAiSkillsParams {
  userId: string;
  category?: string;
  scope?: string;
  projectId?: number;
}

export interface ListAdminAiSkillsParams {
  category?: string;
  scope?: string;
  projectId?: number;
  status?: string;
}

export interface UpdateAiSkillAdminStateParams {
  skillId: string;
  status?: string;
  isActive?: boolean;
  isVisible?: boolean;
  reviewerNotes?: string;
}

export class SkillLibraryServiceError extends Error {
  constructor(
    public readonly table: string,
    public readonly action: string,
    message: string,
  ) {
    super(`${table} ${action} failed: ${message}`);
    this.name = "SkillLibraryServiceError";
  }
}

const uuidSchema = z.string().uuid();
const titleSchema = z.string().trim().min(1).max(200);
const slugSchema = z
  .string()
  .trim()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .max(160);
const summarySchema = z.string().trim().min(1).max(1000);
const bodySchema = z.string().trim().min(1).max(20000);
const categorySchema = z.string().trim().min(1).max(120);

function assertUuid(
  value: string,
  field: string,
  table: string,
): string {
  const parsed = uuidSchema.safeParse(value);
  if (!parsed.success) {
    throw new SkillLibraryServiceError(table, "validate", `${field} must be a UUID`);
  }
  return parsed.data;
}

function optionalUuid(
  value: string | null | undefined,
  field: string,
  table: string,
): string | null {
  if (value === null || value === undefined || value.trim() === "") {
    return null;
  }
  return assertUuid(value, field, table);
}

function normalizeSlug(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 160);

  if (!slug) {
    throw new SkillLibraryServiceError(
      "ai_skills",
      "validate",
      "slug could not be derived from title",
    );
  }

  return slug;
}

function normalizeJsonObject(value: Json | undefined): Json {
  return value ?? {};
}

function normalizeExamples(value: AiSkillExample[] | undefined): Json {
  return (value ?? []).map((example) => ({
    input: example.input?.trim() || null,
    output: example.output?.trim() || null,
    notes: example.notes?.trim() || null,
  })) as Json;
}

function parseExamples(value: Json): AiSkillExample[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item): item is Record<string, Json | undefined> => {
      return item !== null && typeof item === "object" && !Array.isArray(item);
    })
    .map((item) => ({
      input: typeof item.input === "string" ? item.input : null,
      output: typeof item.output === "string" ? item.output : null,
      notes: typeof item.notes === "string" ? item.notes : null,
    }));
}

function validateScope(params: {
  scopeType: AiSkillScopeType;
  projectId?: number | null;
  ownerUserId?: string | null;
}) {
  if (params.scopeType === "project" && !params.projectId) {
    throw new SkillLibraryServiceError(
      "ai_skills",
      "validate",
      "project skills require projectId",
    );
  }

  if (params.scopeType !== "project" && params.projectId) {
    throw new SkillLibraryServiceError(
      "ai_skills",
      "validate",
      "projectId is only allowed for project skills",
    );
  }

  if (params.scopeType === "personal" && !params.ownerUserId) {
    throw new SkillLibraryServiceError(
      "ai_skills",
      "validate",
      "personal skills require ownerUserId",
    );
  }
}

function validateLimit(limit: number | undefined) {
  const normalized = limit ?? 50;
  if (!Number.isInteger(normalized) || normalized < 1 || normalized > 200) {
    throw new SkillLibraryServiceError(
      "ai_skills",
      "validate",
      "limit must be an integer between 1 and 200",
    );
  }
  return normalized;
}

function mapSkillRow(row: AiSkillRow): AiSkill {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    summary: row.summary,
    body: row.body,
    instructions: row.instructions,
    category: row.category,
    scopeType: row.scope_type as AiSkillScopeType,
    projectId: row.project_id,
    ownerUserId: row.owner_user_id,
    reviewerUserId: row.reviewer_user_id,
    status: row.status as AiSkillStatus,
    version: row.version,
    supersedesSkillId: row.supersedes_skill_id,
    examples: parseExamples(row.examples),
    sourceEventIds: row.source_event_ids,
    riskLevel: row.risk_level as AiSkillRiskLevel,
    usageCount: row.usage_count,
    lastUsedAt: row.last_used_at,
    reviewedAt: row.reviewed_at,
    reviewNotes: row.review_notes,
    metadata: row.metadata,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toScopeType(value: string | undefined): AiSkillScopeType | undefined {
  if (
    value === "personal" ||
    value === "project" ||
    value === "team" ||
    value === "company"
  ) {
    return value;
  }
  return undefined;
}

function toStatus(value: string | undefined): AiSkillStatus | undefined {
  if (
    value === "draft" ||
    value === "candidate" ||
    value === "in_review" ||
    value === "active" ||
    value === "rejected" ||
    value === "archived"
  ) {
    return value;
  }
  return undefined;
}

function toLibraryResponse(skills: AiSkill[]): SkillLibraryListResponse {
  const categories = Array.from(new Set(skills.map((skill) => skill.category))).sort();
  const scopes = Array.from(new Set(skills.map((skill) => skill.scopeType))).sort();
  const statuses = Array.from(new Set(skills.map((skill) => skill.status))).sort();
  const projects = Array.from(
    new Map(
      skills
        .filter((skill) => skill.projectId !== null)
        .map((skill) => [
          skill.projectId as number,
          {
            id: skill.projectId as number,
            name: `Project ${skill.projectId}`,
          },
        ]),
    ).values(),
  ).sort((left, right) => left.name.localeCompare(right.name));

  return {
    skills: skills.map((skill) => ({
      id: skill.id,
      title: skill.title,
      summary: skill.summary,
      category: skill.category,
      scope: skill.scopeType,
      projectId: skill.projectId,
      projectName: skill.projectId ? `Project ${skill.projectId}` : null,
      ownerName: skill.ownerUserId ? `User ${skill.ownerUserId.slice(0, 8)}` : null,
      reviewerName: skill.reviewerUserId
        ? `User ${skill.reviewerUserId.slice(0, 8)}`
        : null,
      version: `v${skill.version}`,
      examples: skill.examples,
      usageCount: skill.usageCount,
      lastUsedAt: skill.lastUsedAt,
      status: skill.status,
      isActive: skill.status === "active",
      isVisible: skill.status !== "archived",
    })),
    filters: {
      categories,
      scopes,
      projects,
      statuses:
        statuses.length > 0
          ? statuses
          : ["draft", "candidate", "in_review", "active", "rejected", "archived"],
    },
  };
}

function buildVisibleScopeFilter(params: ListActiveVisibleSkillsParams): string {
  const viewerUserId = assertUuid(params.viewerUserId, "viewerUserId", "ai_skills");
  const clauses = [
    "scope_type.in.(team,company)",
    `and(scope_type.eq.personal,owner_user_id.eq.${viewerUserId})`,
  ];

  const projectIds = [...new Set(params.viewerProjectIds ?? [])].filter((id) =>
    Number.isInteger(id) && id > 0,
  );
  if (projectIds.length > 0) {
    clauses.push(
      `and(scope_type.eq.project,project_id.in.(${projectIds.join(",")}))`,
    );
  }

  return clauses.join(",");
}

function createSkillPayload(params: CreateSkillParams): AiSkillInsert {
  const ownerUserId = optionalUuid(
    params.ownerUserId,
    "ownerUserId",
    "ai_skills",
  );
  validateScope({
    scopeType: params.scopeType,
    projectId: params.projectId ?? null,
    ownerUserId,
  });

  const title = titleSchema.parse(params.title);
  const slug = slugSchema.parse(params.slug?.trim() || normalizeSlug(title));
  const body = bodySchema.parse(params.body);
  const instructions = bodySchema.parse(params.instructions?.trim() || body);

  return {
    title,
    slug,
    summary: summarySchema.parse(params.summary),
    body,
    instructions,
    category: categorySchema.parse(params.category),
    scope_type: params.scopeType,
    project_id: params.projectId ?? null,
    owner_user_id: ownerUserId,
    reviewer_user_id: optionalUuid(
      params.reviewerUserId,
      "reviewerUserId",
      "ai_skills",
    ),
    status: params.status ?? "candidate",
    version: params.version ?? 1,
    supersedes_skill_id: optionalUuid(
      params.supersedesSkillId,
      "supersedesSkillId",
      "ai_skills",
    ),
    examples: normalizeExamples(params.examples),
    source_event_ids: (params.sourceEventIds ?? []).map((id) =>
      assertUuid(id, "sourceEventIds", "ai_skills"),
    ),
    risk_level: params.riskLevel ?? "low",
    metadata: normalizeJsonObject(params.metadata),
  };
}

function updateSkillPayload(params: UpdateSkillParams): AiSkillUpdate {
  const payload: AiSkillUpdate = {};

  if (params.title !== undefined) {
    payload.title = titleSchema.parse(params.title);
  }
  if (params.slug !== undefined) {
    payload.slug = slugSchema.parse(params.slug);
  }
  if (params.summary !== undefined) {
    payload.summary = summarySchema.parse(params.summary);
  }
  if (params.body !== undefined) {
    payload.body = bodySchema.parse(params.body);
  }
  if (params.instructions !== undefined) {
    payload.instructions = bodySchema.parse(params.instructions);
  }
  if (params.category !== undefined) {
    payload.category = categorySchema.parse(params.category);
  }
  if (params.scopeType !== undefined) {
    payload.scope_type = params.scopeType;
  }
  if (params.projectId !== undefined) {
    payload.project_id = params.projectId;
  }
  if (params.ownerUserId !== undefined) {
    payload.owner_user_id = optionalUuid(
      params.ownerUserId,
      "ownerUserId",
      "ai_skills",
    );
  }
  if (params.reviewerUserId !== undefined) {
    payload.reviewer_user_id = optionalUuid(
      params.reviewerUserId,
      "reviewerUserId",
      "ai_skills",
    );
  }
  if (params.status !== undefined) {
    payload.status = params.status;
  }
  if (params.version !== undefined) {
    payload.version = params.version;
  }
  if (params.supersedesSkillId !== undefined) {
    payload.supersedes_skill_id = optionalUuid(
      params.supersedesSkillId,
      "supersedesSkillId",
      "ai_skills",
    );
  }
  if (params.examples !== undefined) {
    payload.examples = normalizeExamples(params.examples);
  }
  if (params.sourceEventIds !== undefined) {
    payload.source_event_ids = params.sourceEventIds.map((id) =>
      assertUuid(id, "sourceEventIds", "ai_skills"),
    );
  }
  if (params.riskLevel !== undefined) {
    payload.risk_level = params.riskLevel;
  }
  if (params.metadata !== undefined) {
    payload.metadata = params.metadata;
  }

  return payload;
}

export async function listActiveVisibleSkills(
  params: ListActiveVisibleSkillsParams,
): Promise<AiSkill[]> {
    let query = serviceDb.from("ai_skills")
    .select("*")
    .eq("status", "active")
    .or(buildVisibleScopeFilter(params))
    .order("usage_count", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(validateLimit(params.limit));

  if (params.category) {
    query = query.eq("category", categorySchema.parse(params.category));
  }
  if (params.scopeTypes && params.scopeTypes.length > 0) {
    query = query.in("scope_type", params.scopeTypes);
  }

  const { data, error } = await query;

  if (error) {
    throw new SkillLibraryServiceError("ai_skills", "list", error.message);
  }

  return (data ?? []).map(mapSkillRow);
}

export async function listVisibleAiSkills(
  params: ListVisibleAiSkillsParams,
): Promise<SkillLibraryListResponse> {
  const scopeType = toScopeType(params.scope);
  const skills = await listActiveVisibleSkills({
    viewerUserId: params.userId,
    viewerProjectIds: params.projectId ? [params.projectId] : [],
    category: params.category,
    scopeTypes: scopeType ? [scopeType] : undefined,
    limit: 100,
  });

  return toLibraryResponse(skills);
}

export async function listAdminAiSkills(
  params: ListAdminAiSkillsParams = {},
): Promise<SkillLibraryListResponse> {
    let query = serviceDb.from("ai_skills")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(200);

  if (params.category) {
    query = query.eq("category", categorySchema.parse(params.category));
  }
  const scopeType = toScopeType(params.scope);
  if (scopeType) {
    query = query.eq("scope_type", scopeType);
  }
  if (params.projectId) {
    query = query.eq("project_id", params.projectId);
  }
  const status = toStatus(params.status);
  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;

  if (error) {
    throw new SkillLibraryServiceError("ai_skills", "admin_list", error.message);
  }

  return toLibraryResponse((data ?? []).map(mapSkillRow));
}

export async function createSkill(params: CreateSkillParams): Promise<AiSkill> {
  const payload = createSkillPayload(params);

  const { data, error } = await serviceDb.from("ai_skills")
    .insert(payload)
    .select("*")
    .single();

  if (error || !data) {
    throw new SkillLibraryServiceError(
      "ai_skills",
      "insert",
      error?.message ?? "insert returned no row",
    );
  }

  return mapSkillRow(data);
}

export async function updateSkill(params: UpdateSkillParams): Promise<AiSkill> {
  const skillId = assertUuid(params.skillId, "skillId", "ai_skills");
  const payload = updateSkillPayload(params);

  if (Object.keys(payload).length === 0) {
    throw new SkillLibraryServiceError(
      "ai_skills",
      "update",
      "update payload is empty",
    );
  }

    const { data, error } = await serviceDb.from("ai_skills")
    .update(payload)
    .eq("id", skillId)
    .select("*")
    .single();

  if (error || !data) {
    throw new SkillLibraryServiceError(
      "ai_skills",
      "update",
      error?.message ?? "update returned no row",
    );
  }

  return mapSkillRow(data);
}

export async function updateAiSkillAdminState(
  params: UpdateAiSkillAdminStateParams,
): Promise<{ skill: AiSkill }> {
  const status =
    toStatus(params.status) ??
    (params.isActive === false
      ? "archived"
      : params.isActive === true
        ? "active"
        : undefined);

  const skill = await updateSkill({
    skillId: params.skillId,
    ...(status ? { status } : {}),
    ...(params.reviewerNotes !== undefined
      ? { metadata: { reviewerNotes: params.reviewerNotes } }
      : {}),
  });

  return { skill };
}

export async function reviewSkill(params: ReviewSkillParams): Promise<AiSkill> {
  const skillId = assertUuid(params.skillId, "skillId", "ai_skills");
  const reviewerUserId = assertUuid(
    params.reviewerUserId,
    "reviewerUserId",
    "ai_skills",
  );

    const { data, error } = await serviceDb.from("ai_skills")
    .update({
      reviewer_user_id: reviewerUserId,
      status: params.status,
      reviewed_at: params.reviewedAt ?? new Date().toISOString(),
      review_notes: params.reviewNotes ?? null,
    })
    .eq("id", skillId)
    .select("*")
    .single();

  if (error || !data) {
    throw new SkillLibraryServiceError(
      "ai_skills",
      "review",
      error?.message ?? "review update returned no row",
    );
  }

  return mapSkillRow(data);
}

export async function recordSkillUsage(
  params: RecordSkillUsageParams,
): Promise<AiSkillUsageEventRow> {
  const payload: AiSkillUsageEventInsert = {
    skill_id: assertUuid(params.skillId, "skillId", "ai_skill_usage_events"),
    user_id: optionalUuid(params.userId, "userId", "ai_skill_usage_events"),
    project_id: params.projectId ?? null,
    session_id: params.sessionId ? toSessionUuid(params.sessionId) : null,
    surface: z.string().trim().min(1).max(120).parse(params.surface),
    outcome: params.outcome ?? "used",
    metadata: normalizeJsonObject(params.metadata),
  };

    const { data, error } = await serviceDb.from("ai_skill_usage_events")
    .insert(payload)
    .select("*")
    .single();

  if (error || !data) {
    throw new SkillLibraryServiceError(
      "ai_skill_usage_events",
      "insert",
      error?.message ?? "insert returned no row",
    );
  }

  return data;
}
