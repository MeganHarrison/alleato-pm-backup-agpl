export type TradeScheduleActivity = {
  sourceTaskId: string;
  name: string;
  assigneePersonId: string | null;
};

/**
 * Trade views fail closed: an activity is visible only when its assignee is in
 * the project-scoped person list authorized by the API.
 */
export function selectTradePublishedActivities<T extends TradeScheduleActivity>(
  activities: T[],
  authorizedPersonIds: readonly string[],
): T[] {
  const authorized = new Set(authorizedPersonIds);
  if (authorized.size === 0) return [];
  return activities.filter(
    (activity) =>
      activity.assigneePersonId !== null
      && authorized.has(activity.assigneePersonId),
  );
}
