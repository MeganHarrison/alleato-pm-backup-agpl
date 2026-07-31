import type { ProjectPage } from "./plane-pages-data";

export type PageScope = "active" | "archived";
export type PageSortKey = "title" | "created_at" | "updated_at";
export type PageSortOrder = "asc" | "desc";

export function applyPageArchiveResult(
  pages: ProjectPage[],
  updatedPage: ProjectPage,
): {
  pages: ProjectPage[];
  scope: "active";
  selectedPageId: null;
} {
  return {
    pages: pages.map((page) =>
      page.id === updatedPage.id ? updatedPage : page,
    ),
    scope: "active",
    selectedPageId: null,
  };
}

export function displayPageTitle(title: string | null): string {
  return title?.trim() || "Untitled";
}

export function pageBodyPreview(body: string | null): string {
  const compact = body?.replace(/\s+/g, " ").trim();
  return compact || "Empty page";
}

export function filterProjectPages(
  pages: ProjectPage[],
  scope: PageScope,
  query: string,
): ProjectPage[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();

  return pages.filter((page) => {
    const isArchived = page.archived === true;
    if (scope === "archived" ? !isArchived : isArchived) {
      return false;
    }

    if (!normalizedQuery) {
      return true;
    }

    return `${page.title ?? ""} ${page.body ?? ""}`
      .toLocaleLowerCase()
      .includes(normalizedQuery);
  });
}

export function sortProjectPages(
  pages: ProjectPage[],
  sortKey: PageSortKey,
  sortOrder: PageSortOrder,
): ProjectPage[] {
  const direction = sortOrder === "asc" ? 1 : -1;

  return [...pages].sort((left, right) => {
    if (sortKey === "title") {
      return (
        displayPageTitle(left.title).localeCompare(
          displayPageTitle(right.title),
        ) * direction
      );
    }

    return (
      (left[sortKey] ?? "").localeCompare(right[sortKey] ?? "") * direction
    );
  });
}

export function formatPageUpdatedAt(value: string | null): string {
  if (!value) return "Not saved yet";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown update time";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
  }).format(date);
}
