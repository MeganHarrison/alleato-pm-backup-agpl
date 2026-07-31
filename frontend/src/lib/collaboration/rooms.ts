const ROOM_PREFIX = "alleato:";

export type CommentableEntityType =
  | "rfi"
  | "submittal"
  | "change-order"
  | "punch-item"
  | "observation"
  | "daily-log"
  | "meeting"
  | "drawing"
  | "specification"
  | "schedule-task"
  | "schedule"
  | "budget"
  | "budget-line"
  | "commitment"
  | "direct-cost"
  | "correspondence"
  | "action-plan"
  | "change-event"
  | "inspection"
  | "issue";

export function getRoomId(
  entityType: CommentableEntityType,
  entityId: string | number,
): string {
  return `${ROOM_PREFIX}${entityType}:${entityId}`;
}

export function parseRoomId(
  roomId: string,
): { entityType: string; entityId: string } | null {
  if (!roomId.startsWith(ROOM_PREFIX)) return null;

  const remainder = roomId.slice(ROOM_PREFIX.length);
  const lastColon = remainder.lastIndexOf(":");
  if (lastColon === -1) return null;

  return {
    entityType: remainder.slice(0, lastColon),
    entityId: remainder.slice(lastColon + 1),
  };
}

export function entityTypeLabel(entityType: string): string {
  return entityType
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
