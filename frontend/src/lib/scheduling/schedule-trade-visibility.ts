export type TradeScheduleActivity = {
  sourceTaskId: string;
  name: string;
  assigneePersonId: string | null;
};

/** Trade views fail closed: an activity is visible only to its named assignee. */
export function selectTradePublishedActivities<T extends TradeScheduleActivity>(
  activities: T[],
  personId: string | null,
): T[] {
  if (!personId) return [];
  return activities.filter((activity) => activity.assigneePersonId === personId);
}
