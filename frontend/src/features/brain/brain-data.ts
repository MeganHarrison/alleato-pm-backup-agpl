import "server-only";

import { getCurrentUser } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import {
  buildBrainOperationalScopeFilter,
  getBrainTabSort,
  normalizeSearchTerm,
  normalizeSortDirection,
  parsePositiveInteger,
  type BrainResourcePage,
  type BrainResourceRow,
  type BrainResourceTab,
  type BusinessArea,
} from "./brain-contract";

type SearchParams = Record<string, string | string[] | undefined>;
type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export class BrainDataError extends Error {
  constructor(
    public readonly operation: string,
    cause: string,
  ) {
    super(`Alleato Brain could not ${operation}: ${cause}`);
    this.name = "BrainDataError";
  }
}

function singleValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function safeIlikeTerm(search: string): string {
  return search
    .replace(/[,%().]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function pageRequest(
  tab: BrainResourceTab,
  params: SearchParams,
): {
  page: number;
  perPage: number;
  search: string;
  sortBy: string;
  databaseSort: string;
  sortDirection: "asc" | "desc";
  from: number;
  to: number;
} {
  const page = parsePositiveInteger(params.page, 1);
  const perPage = parsePositiveInteger(params.per_page, 25, 100);
  const search = safeIlikeTerm(normalizeSearchTerm(params.search));
  const sort = getBrainTabSort(tab, params.sort);
  const sortDirection = normalizeSortDirection(params.sort_dir);
  const from = (page - 1) * perPage;

  return {
    page,
    perPage,
    search,
    sortBy: sort.client,
    databaseSort: sort.database,
    sortDirection,
    from,
    to: from + perPage - 1,
  };
}

function normalizeText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function firstText(...values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    const normalized = normalizeText(value);
    if (normalized) return normalized;
  }
  return null;
}

function toResourcePage(
  request: ReturnType<typeof pageRequest>,
  rows: BrainResourceRow[],
  count: number | null,
): BrainResourcePage {
  const total = count ?? 0;
  return {
    rows,
    total,
    page: request.page,
    perPage: request.perPage,
    totalPages: Math.max(1, Math.ceil(total / request.perPage)),
    sortBy: request.sortBy,
    sortDirection: request.sortDirection,
    search: request.search,
  };
}

async function loadKnowledge(
  supabase: SupabaseClient,
  businessAreaId: number,
  params: SearchParams,
): Promise<BrainResourcePage> {
  const request = pageRequest("knowledge", params);
  let query = supabase
    .from("document_metadata")
    .select(
      "id,title,file_name,overview,description,source,source_system,status,date,created_at,url,source_web_url,fireflies_link,meeting_link,type",
      { count: "exact" },
    )
    .eq("business_area_id", businessAreaId)
    .is("deleted_at", null)
    .or("type.is.null,type.neq.meeting");

  if (request.search) {
    query = query.or(
      `title.ilike.%${request.search}%,file_name.ilike.%${request.search}%`,
    );
  }

  const { data, error, count } = await query
    .order(request.databaseSort, {
      ascending: request.sortDirection === "asc",
      nullsFirst: false,
    })
    .range(request.from, request.to);

  if (error) throw new BrainDataError("load branch knowledge", error.message);

  const rows: BrainResourceRow[] = (data ?? []).map((row) => ({
    id: row.id,
    title: firstText(row.title, row.file_name) ?? "Untitled source",
    detail: firstText(row.overview, row.description, row.file_name),
    source: firstText(row.source_system, row.source),
    status: normalizeText(row.status),
    date: firstText(row.date, row.created_at),
    owner: null,
    href: firstText(
      row.source_web_url,
      row.url,
      row.fireflies_link,
      row.meeting_link,
    ),
    signedDocumentId: row.id,
  }));

  return toResourcePage(request, rows, count);
}

async function loadMeetings(
  supabase: SupabaseClient,
  businessAreaId: number,
  legacyProjectId: number | null,
  params: SearchParams,
): Promise<BrainResourcePage> {
  const request = pageRequest("meetings", params);
  let query = supabase
    .from("meetings")
    .select(
      "id,name,overview,location,meeting_date,updated_at,meeting_link,is_draft,is_private",
      { count: "exact" },
    )
    .or(buildBrainOperationalScopeFilter(businessAreaId, legacyProjectId))
    .is("deleted_at", null);

  if (request.search) query = query.ilike("name", `%${request.search}%`);

  const { data, error, count } = await query
    .order(request.databaseSort, {
      ascending: request.sortDirection === "asc",
      nullsFirst: false,
    })
    .range(request.from, request.to);

  if (error) throw new BrainDataError("load branch meetings", error.message);

  const rows: BrainResourceRow[] = (data ?? []).map((row) => ({
    id: row.id,
    title: normalizeText(row.name) ?? "Untitled meeting",
    detail: firstText(row.overview, row.location),
    source: "Meeting",
    status: row.is_draft ? "Draft" : row.is_private ? "Private" : "Published",
    date: firstText(row.meeting_date, row.updated_at),
    owner: null,
    href: normalizeText(row.meeting_link),
    signedDocumentId: null,
  }));

  return toResourcePage(request, rows, count);
}

async function loadTasks(
  supabase: SupabaseClient,
  businessAreaId: number,
  legacyProjectId: number | null,
  params: SearchParams,
): Promise<BrainResourcePage> {
  const request = pageRequest("tasks", params);
  let query = supabase
    .from("tasks")
    .select(
      "id,title,description,source_system,status,due_date,updated_at,assignee_name",
      { count: "exact" },
    )
    .or(buildBrainOperationalScopeFilter(businessAreaId, legacyProjectId));

  if (request.search) {
    query = query.or(
      `title.ilike.%${request.search}%,description.ilike.%${request.search}%`,
    );
  }

  const { data, error, count } = await query
    .order(request.databaseSort, {
      ascending: request.sortDirection === "asc",
      nullsFirst: false,
    })
    .range(request.from, request.to);

  if (error) throw new BrainDataError("load branch tasks", error.message);

  const rows: BrainResourceRow[] = (data ?? []).map((row) => ({
    id: row.id,
    title: firstText(row.title, row.description) ?? "Untitled task",
    detail: normalizeText(row.description),
    source: normalizeText(row.source_system),
    status: normalizeText(row.status),
    date: firstText(row.due_date, row.updated_at),
    owner: normalizeText(row.assignee_name),
    href: `/tasks?task=${encodeURIComponent(row.id)}&scope=all`,
    signedDocumentId: null,
  }));

  return toResourcePage(request, rows, count);
}

async function loadFiles(
  supabase: SupabaseClient,
  businessAreaId: number,
  params: SearchParams,
): Promise<BrainResourcePage> {
  const request = pageRequest("files", params);
  let query = supabase
    .from("document_metadata")
    .select(
      "id,title,file_name,overview,category,source,source_system,status,source_last_modified_at,date,created_at,url,source_web_url,fireflies_link,meeting_link",
      { count: "exact" },
    )
    .eq("business_area_id", businessAreaId)
    .is("deleted_at", null)
    .or(
      "file_name.not.is.null,file_path.not.is.null,source_web_url.not.is.null",
    );

  if (request.search) {
    query = query.or(
      `title.ilike.%${request.search}%,file_name.ilike.%${request.search}%`,
    );
  }

  const { data, error, count } = await query
    .order(request.databaseSort, {
      ascending: request.sortDirection === "asc",
      nullsFirst: false,
    })
    .range(request.from, request.to);

  if (error) throw new BrainDataError("load branch files", error.message);

  const rows: BrainResourceRow[] = (data ?? []).map((row) => ({
    id: row.id,
    title: firstText(row.title, row.file_name) ?? "Untitled file",
    detail: firstText(row.overview, row.file_name),
    source: firstText(row.source_system, row.source, row.category),
    status: normalizeText(row.status),
    date: firstText(
      row.source_last_modified_at,
      row.date,
      row.created_at,
    ),
    owner: null,
    href: firstText(
      row.source_web_url,
      row.url,
      row.fireflies_link,
      row.meeting_link,
    ),
    signedDocumentId: row.id,
  }));

  return toResourcePage(request, rows, count);
}

export async function requireBrainUser(): Promise<void> {
  const user = await getCurrentUser();
  if (!user) {
    const { redirect } = await import("next/navigation");
    redirect("/auth/login");
  }

  const supabase = await createClient();
  const { data: isInternal, error } = await supabase.rpc(
    "current_is_active_internal_employee",
  );
  if (error) {
    throw new BrainDataError(
      "verify active internal employee access",
      error.message,
    );
  }
  if (!isInternal) {
    const { redirect } = await import("next/navigation");
    redirect("/access-denied?reason=brain-internal-only");
  }
}

export async function loadBusinessAreas(): Promise<BusinessArea[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("business_areas")
    .select(
      "id,key,name,description,is_restricted,owner_person_id,created_at,updated_at",
    )
    .order("name");

  if (error) throw new BrainDataError("load Business Areas", error.message);
  return data ?? [];
}

export async function loadBusinessAreaAccess(businessAreaId: number): Promise<{
  area: BusinessArea | null;
  canAccess: boolean;
  isAdmin: boolean;
}> {
  const supabase = await createClient();
  const [
    { data: area, error: areaError },
    { data: isAdmin, error: adminError },
  ] = await Promise.all([
    supabase
      .from("business_areas")
      .select(
        "id,key,name,description,is_restricted,owner_person_id,created_at,updated_at",
      )
      .eq("id", businessAreaId)
      .maybeSingle(),
    supabase.rpc("current_is_app_admin"),
  ]);

  if (adminError) {
    throw new BrainDataError(
      "verify Alleato Brain administrator access",
      adminError.message,
    );
  }
  if (areaError) {
    throw new BrainDataError(
      "load the requested Business Area",
      areaError.message,
    );
  }
  if (!area) return { area: null, canAccess: false, isAdmin: isAdmin === true };
  if (!area.is_restricted || isAdmin) {
    return { area, canAccess: true, isAdmin: isAdmin === true };
  }

  const { data: isMember, error: membershipError } = await supabase.rpc(
    "current_is_business_area_member",
    { p_business_area_id: businessAreaId },
  );

  if (membershipError) {
    throw new BrainDataError(
      "verify restricted Business Area access",
      membershipError.message,
    );
  }

  return {
    area,
    canAccess: isMember === true,
    isAdmin: isAdmin === true,
  };
}

export async function loadBrainResourcePage(
  businessAreaId: number,
  tab: BrainResourceTab,
  params: SearchParams,
): Promise<BrainResourcePage> {
  const supabase = await createClient();
  let legacyProjectId: number | null = null;

  if (tab === "meetings" || tab === "tasks") {
    const { data: mapping, error: mappingError } = await supabase
      .from("business_area_project_map")
      .select("project_id")
      .eq("business_area_id", businessAreaId)
      .maybeSingle();

    if (mappingError) {
      throw new BrainDataError(
        "load the parallel-run project mapping",
        mappingError.message,
      );
    }
    legacyProjectId = mapping?.project_id ?? null;
  }

  switch (tab) {
    case "knowledge":
      return loadKnowledge(supabase, businessAreaId, params);
    case "meetings":
      return loadMeetings(supabase, businessAreaId, legacyProjectId, params);
    case "tasks":
      return loadTasks(supabase, businessAreaId, legacyProjectId, params);
    case "files":
      return loadFiles(supabase, businessAreaId, params);
  }
}
