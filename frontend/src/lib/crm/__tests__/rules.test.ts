import {
  calculateCrmDashboardMetrics,
  canCreateDomainAlias,
  evaluateCrmDealAttention,
  requestDealConversion,
  transitionDeal,
  upsertCommunicationCandidate,
} from "@/lib/crm/rules";
import {
  CRM_REVIEW_ACCOUNTS,
  CRM_REVIEW_ACTIVITIES,
  CRM_REVIEW_CANDIDATES,
  CRM_REVIEW_DEALS,
  CRM_REVIEW_FOLLOW_UPS,
  CRM_REVIEW_NOW,
  CRM_REVIEW_SETTINGS,
  CRM_REVIEW_STAGES,
} from "@/lib/crm/local-review-data";

describe("CRM v4 domain rules", () => {
  it("reconciles dashboard metrics from the underlying records", () => {
    expect(
      calculateCrmDashboardMetrics({
        accounts: CRM_REVIEW_ACCOUNTS,
        deals: CRM_REVIEW_DEALS,
        activities: CRM_REVIEW_ACTIVITIES,
        followUps: CRM_REVIEW_FOLLOW_UPS,
        now: CRM_REVIEW_NOW,
      }),
    ).toEqual({
      openPipeline: 5_395_000,
      weightedPipeline: 3_076_000,
      winRate: 50,
      overdueFollowUps: 1,
      staleRelationships: 2,
      activityThisWeek: 1,
    });
  });

  it("rejects stale transitions and won-deal reopen when a project is linked", () => {
    const deal = CRM_REVIEW_DEALS[0];
    const won = CRM_REVIEW_STAGES.find((stage) => stage.stageType === "won");
    expect(won).toBeDefined();
    expect(() =>
      transitionDeal({
        deal,
        targetStage: won!,
        expectedRowVersion: deal.rowVersion - 1,
      }),
    ).toThrow("changed");

    const linkedWonDeal = {
      ...CRM_REVIEW_DEALS.find((candidate) => candidate.status === "won")!,
      projectId: 4042,
    };
    const open = CRM_REVIEW_STAGES.find((stage) => stage.stageType === "open");
    expect(() =>
      transitionDeal({
        deal: linkedWonDeal,
        targetStage: open!,
        expectedRowVersion: linkedWonDeal.rowVersion,
        reason: "Scope changed",
      }),
    ).toThrow("Sever the project link");
  });

  it("deduplicates identical communications and supersedes changed pending content", () => {
    const original = CRM_REVIEW_CANDIDATES[0];
    expect(upsertCommunicationCandidate([original], original)).toHaveLength(1);

    const corrected = {
      ...original,
      id: "candidate-corrected",
      contentHash: "sha256-new",
    };
    const result = upsertCommunicationCandidate([original], corrected);
    expect(result).toHaveLength(2);
    expect(result[0].status).toBe("superseded");
    expect(result[1].status).toBe("pending");
  });

  it("blocks consumer-mailbox domains from approved company aliases", () => {
    expect(canCreateDomainAlias("gmail.com", CRM_REVIEW_SETTINGS)).toBe(false);
    expect(canCreateDomainAlias("alleatogroup.com", CRM_REVIEW_SETTINGS)).toBe(
      true,
    );
  });

  it("returns the same conversion attempt for the same idempotency key", () => {
    const won = CRM_REVIEW_DEALS.find((deal) => deal.status === "won")!;
    const first = requestDealConversion({
      deal: won,
      idempotencyKey: "deal-atlas:convert",
      existingAttempts: [],
    });
    const repeated = requestDealConversion({
      deal: won,
      idempotencyKey: "deal-atlas:convert",
      existingAttempts: [first],
    });
    expect(repeated).toBe(first);
  });

  it("flags an open deal when its close date is overdue and no future action exists", () => {
    const deal = {
      ...CRM_REVIEW_DEALS[0],
      expectedCloseDate: "2026-07-27",
      updatedAt: "2026-07-27T12:00:00.000Z",
    };

    expect(
      evaluateCrmDealAttention({
        deal,
        followUps: CRM_REVIEW_FOLLOW_UPS.filter(
          (followUp) => followUp.dealId !== deal.id,
        ),
        staleDealDays: 30,
        reportingTimezone: "America/Indianapolis",
        now: CRM_REVIEW_NOW,
      }),
    ).toEqual([
      {
        code: "expected_close_overdue",
        label: "Close date overdue",
        reason: "Expected close date was 2026-07-27.",
        severity: "attention",
      },
      {
        code: "no_next_action",
        label: "No next action",
        reason: "No open CRM task is scheduled for today or later.",
        severity: "attention",
      },
    ]);
  });

  it("flags a stale open deal but ignores closed deals", () => {
    const staleDeal = {
      ...CRM_REVIEW_DEALS[0],
      updatedAt: "2026-06-28T00:00:00.000Z",
    };
    const futureFollowUp = {
      ...CRM_REVIEW_FOLLOW_UPS[0],
      dealId: staleDeal.id,
      dueDate: "2026-07-29",
      status: "open" as const,
    };

    expect(
      evaluateCrmDealAttention({
        deal: staleDeal,
        followUps: [futureFollowUp],
        staleDealDays: 30,
        reportingTimezone: "America/Indianapolis",
        now: CRM_REVIEW_NOW,
      }),
    ).toEqual([
      {
        code: "stale_deal",
        label: "Deal is stale",
        reason: "No deal update has been recorded in 30 days.",
        severity: "watch",
      },
    ]);

    expect(
      evaluateCrmDealAttention({
        deal: { ...staleDeal, status: "won" },
        followUps: [],
        staleDealDays: 30,
        reportingTimezone: "America/Indianapolis",
        now: CRM_REVIEW_NOW,
      }),
    ).toEqual([]);
  });

  it("uses the configured reporting timezone at the UTC date boundary", () => {
    const deal = {
      ...CRM_REVIEW_DEALS[0],
      expectedCloseDate: "2026-07-29",
      updatedAt: "2026-07-29T12:00:00.000Z",
    };
    const dueToday = {
      ...CRM_REVIEW_FOLLOW_UPS[0],
      dealId: deal.id,
      dueDate: "2026-07-29",
      status: "open" as const,
    };

    expect(
      evaluateCrmDealAttention({
        deal,
        followUps: [dueToday],
        staleDealDays: 30,
        reportingTimezone: "America/Indianapolis",
        now: new Date("2026-07-30T01:30:00.000Z"),
      }),
    ).toEqual([]);
  });

  it("falls back to the company timezone when a saved timezone is invalid", () => {
    expect(
      evaluateCrmDealAttention({
        deal: {
          ...CRM_REVIEW_DEALS[0],
          expectedCloseDate: "2026-07-29",
          updatedAt: "2026-07-29T12:00:00.000Z",
        },
        followUps: [
          {
            ...CRM_REVIEW_FOLLOW_UPS[0],
            dealId: CRM_REVIEW_DEALS[0].id,
            dueDate: "2026-07-29",
            status: "open",
          },
        ],
        staleDealDays: 30,
        reportingTimezone: "America/Indianaplis",
        now: new Date("2026-07-30T01:30:00.000Z"),
      }),
    ).toEqual([]);
  });
});
