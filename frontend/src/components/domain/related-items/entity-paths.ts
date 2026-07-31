/**
 * entity-paths.ts
 *
 * Maps entity types to their detail page URLs.
 * Returns null if no detail page exists for the entity type.
 */

import type { EntityType } from "@/lib/entity-links/table-map";

/**
 * Returns the Next.js route path for a given entity detail page.
 * Returns null for entity types without a dedicated detail page in this app.
 */
export function getEntityDetailPath(
  entityType: EntityType,
  projectId: number,
  entityId: string,
): string | null {
  const base = `/${projectId}`;

  switch (entityType) {
    case "rfi":
      return `${base}/rfis/${entityId}`;
    case "submittal":
      return `${base}/submittals/${entityId}`;
    case "change_event":
      return `${base}/change-events/${entityId}`;
    case "drawing":
      return `${base}/drawings/${entityId}`;
    case "document":
      return `${base}/documents/${entityId}`;
    case "punch_item":
      return `${base}/punch-list/${entityId}`;
    case "observation":
      return `${base}/observations/${entityId}`;
    case "daily_log":
      return `${base}/daily-log/${entityId}`;
    case "photo":
      // Photos don't have individual detail pages — link to the photos gallery
      return `${base}/photos`;
    default:
      return null;
  }
}
