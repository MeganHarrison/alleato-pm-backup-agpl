/**
 * Record identifiers should never be used as user-facing breadcrumb labels.
 * Keep this check centralized so new detail routes fail closed while their
 * title resolver is being added.
 */
export function isLikelyRecordIdentifier(segment: string, index: number): boolean {
  if (index === 0) return false;

  return (
    /^\d+$/.test(segment) ||
    /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(segment) ||
    /^[0-9a-f]{16,}$/i.test(segment)
  );
}

interface BreadcrumbOverride {
  label: string;
  href: string;
}

/**
 * Route-specific breadcrumb destinations that differ from their URL segment.
 * Keep these overrides centralized so shared header navigation cannot point
 * users at non-canonical collection routes.
 */
export function getRouteBreadcrumbOverride(
  segments: string[],
  index: number,
): BreadcrumbOverride | null {
  if (
    segments[0] === "training" &&
    segments[1] === "resources" &&
    index === 1
  ) {
    return { label: "Library", href: "/training/library" };
  }

  return null;
}
