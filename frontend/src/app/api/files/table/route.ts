import { NextResponse } from "next/server";

import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { serviceDb } from "@/lib/supabase/service-db";
import { apiErrorResponse } from "@/lib/api-error";
import {
  ACTIVE_FILE_GROUPS,
  type FileGroup,
} from "@/features/files/files-table-definition";

const FILE_FIELDS =
  "id, title, file_name, file_path, source_path, source_web_url, url, source_system, source, category, type, document_type, project_id, project, date, created_at, status, tags, division, source_last_modified_at, source_size, overview, participants, access_level";

const MAX_PER_PAGE = 150;
const DEFAULT_PER_PAGE = 50;

const FILE_GROUP_EXTENSIONS: Record<FileGroup, string[]> = {
  pdf: ["pdf"],
  word: ["doc", "docx"],
  spreadsheet: ["xls", "xlsx", "csv"],
  presentation: ["ppt", "pptx"],
  image: ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "tiff"],
  text: ["txt", "md", "rtf"],
  other: [],
};

function parsePositiveInt(value: string | null, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function escapeIlikeTerm(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll(",", "\\,");
}

function getEffectiveGroups(searchParams: URLSearchParams): FileGroup[] {
  const activeGroup = searchParams.get("group");
  const fileTypeFilter = searchParams.get("file_type");
  const filterGroups = (fileTypeFilter ?? "")
    .split(",")
    .filter((value): value is FileGroup =>
      ACTIVE_FILE_GROUPS.includes(value as FileGroup),
    );

  if (activeGroup && ACTIVE_FILE_GROUPS.includes(activeGroup as FileGroup)) {
    if (filterGroups.length === 0) return [activeGroup as FileGroup];
    return filterGroups.includes(activeGroup as FileGroup)
      ? [activeGroup as FileGroup]
      : [];
  }

  return filterGroups;
}

function applyGroupFilter<
  T extends {
    or: (filters: string) => T;
    not: (column: string, operator: string, value: string) => T;
  },
>(query: T, groups: FileGroup[]): T {
  if (groups.length === 0) return query;

  const includeOther = groups.includes("other");
  const positiveGroups = groups.filter((group) => group !== "other");
  const extPatterns = positiveGroups.flatMap((group) =>
    FILE_GROUP_EXTENSIONS[group].flatMap((ext) => [
      `file_name.ilike.%.${ext}`,
      `title.ilike.%.${ext}`,
    ]),
  );

  if (includeOther) {
    const excludedExts = Object.entries(FILE_GROUP_EXTENSIONS)
      .filter(([group]) => group !== "other")
      .flatMap(([, extensions]) => extensions)
      .filter((value, index, values) => values.indexOf(value) === index);

    let filteredQuery = query;
    for (const ext of excludedExts) {
      filteredQuery = filteredQuery.not("file_name", "ilike", `%.${ext}`);
      filteredQuery = filteredQuery.not("title", "ilike", `%.${ext}`);
    }
    return filteredQuery;
  }

  return extPatterns.length > 0 ? query.or(extPatterns.join(",")) : query;
}

function applySourceFilter<T extends { or: (filters: string) => T }>(
  query: T,
  source: string | null,
): T {
  if (!source) return query;

  if (source === "SharePoint") {
    return query.or("source_system.ilike.%sharepoint%,source.ilike.%sharepoint%");
  }
  if (source === "OneDrive") {
    return query.or(
      "source_system.ilike.%onedrive%,source_system.eq.microsoft_graph,source.ilike.%onedrive%,source.eq.microsoft_graph",
    );
  }
  if (source === "Uploaded") {
    return query.or("source_system.ilike.%upload%,source.ilike.%upload%");
  }
  if (source === "Google Drive") {
    return query.or("source_system.ilike.%google%,source.ilike.%google%");
  }

  return query;
}

function applyServerSort<
  T extends {
    order: (
      column: string,
      options?: { ascending?: boolean; nullsFirst?: boolean },
    ) => T;
  },
>(query: T, sortBy: string | null, sortDirection: "asc" | "desc"): T {
  const ascending = sortDirection === "asc";

  switch (sortBy) {
    case "name":
      return query.order("file_name", { ascending, nullsFirst: false });
    case "project":
      return query.order("project", { ascending, nullsFirst: false });
    case "document_type":
      return query.order("document_type", { ascending, nullsFirst: false });
    case "category":
      return query.order("category", { ascending, nullsFirst: false });
    case "date":
      return query.order("date", { ascending, nullsFirst: false });
    case "status":
      return query.order("status", { ascending, nullsFirst: false });
    case "access_level":
      return query.order("access_level", { ascending, nullsFirst: false });
    case "size":
      return query.order("source_size", { ascending, nullsFirst: false });
    case "division":
      return query.order("division", { ascending, nullsFirst: false });
    case "modified":
    default:
      return query.order("source_last_modified_at", {
        ascending,
        nullsFirst: false,
      });
  }
}

export const GET = withApiGuardrails("files/table#GET", async ({ request }) => {
  const user = await getApiRouteUser();

  if (!user) {
    throw new GuardrailError({
      code: "AUTH_EXPIRED",
      where: "files/table#GET",
      message: "Authentication required.",
    });
  }

  const supabase = createServiceClient();
  const { searchParams } = new URL(request.url);
  const page = parsePositiveInt(searchParams.get("page"), 1);
  const perPage = Math.min(
    parsePositiveInt(searchParams.get("per_page"), DEFAULT_PER_PAGE),
    MAX_PER_PAGE,
  );
  const offset = (page - 1) * perPage;
  const search = searchParams.get("search")?.trim() ?? "";
  const projectId = searchParams.get("project_id");
  const source = searchParams.get("source");
  const assigned = searchParams.get("assigned");
  const modifiedAfter = searchParams.get("modified_after");
  const modifiedBefore = searchParams.get("modified_before");
  const indexed = searchParams.get("indexed");
  const sortBy = searchParams.get("sort") ?? "modified";
  const sortDirection = searchParams.get("sort_dir") === "asc" ? "asc" : "desc";
  const effectiveGroups = getEffectiveGroups(searchParams);

  const filesQuery = serviceDb.from("document_metadata")
    .select(FILE_FIELDS, { count: "exact" })
    .or("category.not.in.(email,teams_message),category.is.null");

  if (projectId) {
    if (projectId === "__unassigned__") {
      filesQuery.is("project_id", null);
    } else {
      const parsedProjectId = Number.parseInt(projectId, 10);
      if (Number.isFinite(parsedProjectId)) {
        filesQuery.eq("project_id", parsedProjectId);
      }
    }
  }

  if (assigned === "assigned") {
    filesQuery.not("project_id", "is", null);
  } else if (assigned === "unassigned") {
    filesQuery.is("project_id", null);
  }

  if (indexed) {
    const statuses = indexed
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    if (statuses.length > 0) {
      filesQuery.in("status", statuses);
    }
  }

  if (modifiedAfter) {
    filesQuery.gte("source_last_modified_at", modifiedAfter);
  }
  if (modifiedBefore) {
    filesQuery.lte("source_last_modified_at", `${modifiedBefore}T23:59:59.999Z`);
  }

  applySourceFilter(filesQuery, source);
  applyGroupFilter(filesQuery, effectiveGroups);

  if (search) {
    const escaped = escapeIlikeTerm(search);
    filesQuery.or(
      [
        `file_name.ilike.%${escaped}%`,
        `title.ilike.%${escaped}%`,
        `project.ilike.%${escaped}%`,
        `division.ilike.%${escaped}%`,
        `source_path.ilike.%${escaped}%`,
        `source_system.ilike.%${escaped}%`,
        `source.ilike.%${escaped}%`,
      ].join(","),
    );
  }

  applyServerSort(filesQuery, sortBy, sortDirection).range(
    offset,
    offset + perPage - 1,
  );

  const shouldShortCircuitEmpty =
    effectiveGroups.length === 0 &&
    Boolean(searchParams.get("file_type")) &&
    Boolean(searchParams.get("group"));

  const { data, error, count } = shouldShortCircuitEmpty
    ? { data: [], error: null, count: 0 }
    : await filesQuery;

  if (error) {
    return apiErrorResponse(error);
  }

  return NextResponse.json({
    items: data ?? [],
    total: count ?? 0,
    page,
    per_page: perPage,
    total_pages: Math.max(1, Math.ceil((count ?? 0) / perPage)),
  });
});
