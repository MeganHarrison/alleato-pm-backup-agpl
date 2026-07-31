import type {
  CrmActivity,
  CrmDeal,
  CrmDealStageEvent,
  CrmFollowUp,
} from "@/lib/crm/types";

export interface CrmAccountTimelineItem {
  id: string;
  occurredAt: string;
  kind: "call" | "email" | "meeting" | "note" | "task" | "stage";
  title: string;
  detail: string;
}

export function buildCrmAccountTimeline({
  companyId,
  deals,
  activities,
  followUps,
  stageEvents,
}: {
  companyId: string;
  deals: CrmDeal[];
  activities: CrmActivity[];
  followUps: CrmFollowUp[];
  stageEvents: CrmDealStageEvent[];
}): CrmAccountTimelineItem[] {
  const companyDeals = deals.filter((deal) => deal.companyId === companyId);
  const companyDealIds = new Set(companyDeals.map((deal) => deal.id));
  const dealNames = new Map(companyDeals.map((deal) => [deal.id, deal.name]));

  return [
    ...activities
      .filter((activity) => activity.companyId === companyId)
      .map((activity) => ({
        id: `activity-${activity.id}`,
        occurredAt: activity.occurredAt,
        kind: activity.activityType,
        title: activity.subject,
        detail: [
          activity.dealId ? dealNames.get(activity.dealId) : null,
          activity.createdBy,
          activity.recordOrigin === "auto"
            ? "matched communication"
            : "manual activity",
        ]
          .filter(Boolean)
          .join(" · "),
      })),
    ...followUps
      .filter((task) => task.companyId === companyId)
      .map((task) => ({
        id: `task-${task.id}`,
        occurredAt: `${task.dueDate}T12:00:00.000Z`,
        kind: "task" as const,
        title: task.title,
        detail: [
          task.dealId ? dealNames.get(task.dealId) : null,
          task.status.replaceAll("_", " "),
          task.assignee,
        ]
          .filter(Boolean)
          .join(" · "),
      })),
    ...stageEvents
      .filter((event) => companyDealIds.has(event.dealId))
      .map((event) => ({
        id: `stage-${event.id}`,
        occurredAt: event.changedAt,
        kind: "stage" as const,
        title: event.fromStageName
          ? `${event.fromStageName} → ${event.toStageName}`
          : `Entered ${event.toStageName}`,
        detail: [
          dealNames.get(event.dealId),
          event.changedBy,
          event.reason,
        ]
          .filter(Boolean)
          .join(" · "),
      })),
  ].sort(
    (left, right) =>
      new Date(right.occurredAt).getTime() -
      new Date(left.occurredAt).getTime(),
  );
}
