import { buildCrmAccountTimeline } from "@/features/crm/account-timeline";
import {
  CRM_REVIEW_ACTIVITIES,
  CRM_REVIEW_DEALS,
  CRM_REVIEW_FOLLOW_UPS,
} from "@/lib/crm/local-review-data";

describe("CRM account timeline", () => {
  it("combines company activities, tasks, and deal stage changes", () => {
    const companyId = CRM_REVIEW_DEALS[0].companyId;
    const deal = CRM_REVIEW_DEALS[0];
    const timeline = buildCrmAccountTimeline({
      companyId,
      deals: CRM_REVIEW_DEALS,
      activities: CRM_REVIEW_ACTIVITIES,
      followUps: CRM_REVIEW_FOLLOW_UPS,
      stageEvents: [
        {
          id: "stage-event",
          dealId: deal.id,
          fromStageId: null,
          fromStageName: null,
          toStageId: deal.stageId,
          toStageName: "Lead",
          changedBy: "Brandon Clymer",
          changedAt: "2026-07-29T12:00:00.000Z",
          reason: "Pursuit opened",
        },
      ],
    });

    expect(timeline.some((item) => item.kind === "task")).toBe(true);
    expect(timeline.some((item) => item.kind === "stage")).toBe(true);
    expect(
      timeline.some((item) =>
        ["call", "email", "meeting", "note"].includes(item.kind),
      ),
    ).toBe(true);
    expect(timeline[0].occurredAt).toBe("2026-07-29T12:00:00.000Z");
  });

  it("does not leak activity from another account", () => {
    const companyId = CRM_REVIEW_DEALS[0].companyId;
    const timeline = buildCrmAccountTimeline({
      companyId,
      deals: CRM_REVIEW_DEALS,
      activities: CRM_REVIEW_ACTIVITIES,
      followUps: CRM_REVIEW_FOLLOW_UPS,
      stageEvents: [],
    });

    expect(
      timeline.every(
        (item) =>
          !item.detail.includes(
            CRM_REVIEW_DEALS.find((deal) => deal.companyId !== companyId)
              ?.name ?? "unrelated",
          ),
      ),
    ).toBe(true);
  });
});
