"use client";

const AI_FULL_SURFACE_PREFIXES = [
  "/ai",
  "/ai-dashboard",
  "/ai-avatar",
] as const;

const COLLABORATION_FORCED_PREFIXES = [
  "/comments",
  "/team-chat",
  "/feedback-inbox",
] as const;

// Project-scoped routes (e.g. `/876/drawings/...`) that must force the
// collaboration runtime on. These carry a leading `/[projectId]` segment, so
// they need a pattern rather than the global prefixes above. Anchored to
// `drawings` as the *second* segment so the project drawing viewer/detail
// (which host comments) match, while the unscoped `/drawings` table page does
// not needlessly force the runtime + heavy analytics.
const COLLABORATION_FORCED_PATTERNS = [/^\/[^/]+\/drawings(\/|$)/] as const;

const GLOBAL_OVERLAY_HIDDEN_PREFIXES = [
  "/admin/daily-briefs",
] as const;

function normalizePathname(pathname: string | null | undefined): string {
  const trimmed = pathname?.trim();
  if (!trimmed) return "/";
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function shouldHideGlobalAiWidgetForRoute(
  pathname: string | null | undefined,
): boolean {
  const normalizedPathname = normalizePathname(pathname);

  return (
    normalizedPathname.startsWith("/auth") ||
    normalizedPathname === "/login" ||
    normalizedPathname === "/signup" ||
    normalizedPathname === "/ai" ||
    AI_FULL_SURFACE_PREFIXES.some((prefix) =>
      matchesPrefix(normalizedPathname, prefix),
    ) ||
    matchesPrefix(normalizedPathname, "/team-chat") ||
    GLOBAL_OVERLAY_HIDDEN_PREFIXES.some((prefix) =>
      matchesPrefix(normalizedPathname, prefix),
    ) ||
    /\/drawings\/viewer\//.test(normalizedPathname)
  );
}

export function shouldHideGlobalCollaborationLayerForRoute(
  pathname: string | null | undefined,
): boolean {
  const normalizedPathname = normalizePathname(pathname);
  return GLOBAL_OVERLAY_HIDDEN_PREFIXES.some((prefix) =>
    matchesPrefix(normalizedPathname, prefix),
  );
}

export function shouldForceCollaborationRuntime(
  pathname: string | null | undefined,
): boolean {
  const normalizedPathname = normalizePathname(pathname);
  return (
    COLLABORATION_FORCED_PREFIXES.some((prefix) =>
      matchesPrefix(normalizedPathname, prefix),
    ) ||
    COLLABORATION_FORCED_PATTERNS.some((pattern) =>
      pattern.test(normalizedPathname),
    )
  );
}

export function shouldEnableHeavyProductAnalytics(
  pathname: string | null | undefined,
): boolean {
  const normalizedPathname = normalizePathname(pathname);

  return (
    shouldForceCollaborationRuntime(normalizedPathname) ||
    normalizedPathname === "/ai" ||
    AI_FULL_SURFACE_PREFIXES.some((prefix) =>
      matchesPrefix(normalizedPathname, prefix),
    )
  );
}
