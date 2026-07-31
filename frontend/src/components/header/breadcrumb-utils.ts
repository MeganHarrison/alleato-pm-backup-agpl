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
