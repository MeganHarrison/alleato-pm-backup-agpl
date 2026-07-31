/**
 * Portfolio (Company page) scope and filter logic.
 *
 * Extracted from `page.tsx` so the behavior is unit-testable.
 *
 * Product contract (regression guard): the portfolio page must not apply
 * hidden default filters. Scope and filter values come from the URL or the
 * user's explicit choices in the filter panel only. A missing/unknown scope
 * means "all" and a missing filter param means "no filter".
 */

export type PortfolioScope = "all" | "client" | "estimating" | "internal";

export interface PortfolioFilterValues {
  client?: string;
  phase?: string;
  category?: string;
}

export interface PortfolioFilterableProject {
  client?: string | null;
  phase?: string | null;
  category?: string | null;
  type?: string | null;
}

/**
 * Resolve the active tab scope from the `scope` URL param.
 * Missing or unrecognized values fall back to "all" (no scope restriction).
 */
export function getPortfolioScope(scopeParam: string | null): PortfolioScope {
  if (
    scopeParam === "client" ||
    scopeParam === "estimating" ||
    scopeParam === "internal"
  ) {
    return scopeParam;
  }
  return "all";
}

/**
 * Build the initial filter state from URL params.
 * Every filter defaults to undefined (inactive) — never to a hard-coded value.
 */
export function getDefaultPortfolioFilters(searchParams: {
  get(name: string): string | null;
}): PortfolioFilterValues {
  return {
    client: searchParams.get("client") ?? undefined,
    phase: searchParams.get("phase") ?? undefined,
    category: searchParams.get("category") ?? undefined,
  };
}

/**
 * Tab-scope predicate. "all" matches every project, including projects with
 * no phase set.
 */
export function matchesPortfolioScope(
  project: PortfolioFilterableProject,
  scope: PortfolioScope,
): boolean {
  const normalizedPhase = (project.phase ?? "").toLowerCase();
  const normalizedType = (project.type ?? "").toLowerCase();
  const isCurrent = normalizedPhase === "current";
  const isInternal = normalizedType === "internal";

  switch (scope) {
    case "all":
      return true;
    case "client":
      return isCurrent && !isInternal;
    case "estimating":
      return normalizedPhase === "estimating";
    case "internal":
      return isCurrent && isInternal;
  }
}

/**
 * Explicit filter predicate (client / phase / category), case-insensitive.
 * Empty or undefined filter values match everything.
 */
export function matchesPortfolioFilters(
  project: PortfolioFilterableProject,
  filters: { client?: unknown; phase?: unknown; category?: unknown },
): boolean {
  const clientMatch =
    !filters.client ||
    (project.client ?? "").toLowerCase() ===
      String(filters.client).toLowerCase();
  const phaseMatch =
    !filters.phase ||
    (project.phase ?? "").toLowerCase() ===
      String(filters.phase).toLowerCase();
  const categoryMatch =
    !filters.category ||
    (project.category ?? "").toLowerCase() ===
      String(filters.category).toLowerCase();

  return clientMatch && phaseMatch && categoryMatch;
}
