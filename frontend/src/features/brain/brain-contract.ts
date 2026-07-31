import type { Database } from "@/types/database.types";

export const BRAIN_RESOURCE_TABS = [
  "knowledge",
  "meetings",
  "tasks",
  "files",
] as const;

export type BrainResourceTab = (typeof BRAIN_RESOURCE_TABS)[number];

export type BusinessArea =
  Database["public"]["Tables"]["business_areas"]["Row"];

export interface BrainResourceRow {
  id: string;
  title: string;
  detail: string | null;
  source: string | null;
  status: string | null;
  date: string | null;
  owner: string | null;
  href: string | null;
  signedDocumentId: string | null;
}

export interface BrainResourcePage {
  rows: BrainResourceRow[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
  sortBy: string;
  sortDirection: "asc" | "desc";
  search: string;
}

export const BRAIN_RESOURCE_LABELS: Record<BrainResourceTab, string> = {
  knowledge: "Knowledge",
  meetings: "Meetings",
  tasks: "Tasks",
  files: "Files",
};

export function normalizeBrainResourceTab(
  value: string | string[] | undefined,
): BrainResourceTab {
  const candidate = Array.isArray(value) ? value[0] : value;
  return BRAIN_RESOURCE_TABS.includes(candidate as BrainResourceTab)
    ? (candidate as BrainResourceTab)
    : "knowledge";
}

export function parsePositiveInteger(
  value: string | string[] | undefined,
  fallback: number,
  maximum = Number.MAX_SAFE_INTEGER,
): number {
  const candidate = Array.isArray(value) ? value[0] : value;
  const parsed = Number(candidate);
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, maximum);
}

export function normalizeSortDirection(
  value: string | string[] | undefined,
): "asc" | "desc" {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate === "asc" ? "asc" : "desc";
}

export function normalizeSearchTerm(
  value: string | string[] | undefined,
): string {
  const candidate = Array.isArray(value) ? value[0] : value;
  return (candidate ?? "").trim().slice(0, 120);
}

export function buildBrainOperationalScopeFilter(
  businessAreaId: number,
  legacyProjectId: number | null,
): string {
  if (!Number.isInteger(businessAreaId) || businessAreaId <= 0) {
    throw new Error(
      "Business Area scope requires a positive numeric identifier.",
    );
  }
  if (legacyProjectId === null) {
    return `business_area_id.eq.${businessAreaId}`;
  }
  if (!Number.isInteger(legacyProjectId) || legacyProjectId <= 0) {
    throw new Error(
      "Legacy project scope requires a positive numeric identifier.",
    );
  }
  return `business_area_id.eq.${businessAreaId},project_id.eq.${legacyProjectId}`;
}

export function getBrainTabSort(
  tab: BrainResourceTab,
  requested: string | string[] | undefined,
): { client: string; database: string } {
  const candidate = Array.isArray(requested) ? requested[0] : requested;
  const allowed: Record<BrainResourceTab, Record<string, string>> = {
    knowledge: {
      title: "title",
      source: "source",
      status: "status",
      date: "date",
    },
    meetings: {
      title: "name",
      status: "is_draft",
      date: "meeting_date",
    },
    tasks: {
      title: "title",
      status: "status",
      date: "due_date",
      owner: "assignee_name",
    },
    files: {
      title: "title",
      source: "category",
      status: "status",
      date: "source_last_modified_at",
    },
  };

  const fallback = tab === "knowledge" ? "date" : "date";
  const client = candidate && allowed[tab][candidate] ? candidate : fallback;
  return { client, database: allowed[tab][client] };
}

export function businessAreaAccessCopy(area: BusinessArea): string {
  if (!area.is_restricted) {
    return area.description ?? "Company knowledge and operational records.";
  }
  return "Restricted to assigned Finance members.";
}

export function getSafeBrainSourceHref(value: string | null): string | null {
  if (!value) return null;
  if (value.startsWith("/") && !value.startsWith("//")) return value;

  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:"
      ? value
      : null;
  } catch {
    return null;
  }
}

export function getBrainSortSearchParams(
  sortBy: string,
  direction: "asc" | "desc",
): Record<string, string> {
  return {
    sort: sortBy,
    sort_dir: direction,
    page: "1",
  };
}

export function getBrainPageSearchParams(page: number): Record<string, string> {
  if (!Number.isInteger(page) || page <= 0) {
    throw new Error("Brain pagination requires a positive page number.");
  }
  return { page: String(page) };
}

export function getBrainPerPageSearchParams(
  perPage: number,
): Record<string, string> {
  if (!Number.isInteger(perPage) || perPage <= 0) {
    throw new Error("Brain pagination requires a positive page size.");
  }
  return { per_page: String(perPage), page: "1" };
}
