/** @jest-environment jsdom */

import {
  getLocalCrmSnapshot,
  localCrmActions,
} from "@/lib/crm/local-store";

describe("disconnected local CRM store", () => {
  beforeEach(() => {
    window.localStorage.clear();
    localCrmActions.reset();
  });

  it("persists deal creation and guarded stage movement without a network", () => {
    const deal = localCrmActions.addDeal({
      name: "Local test opportunity",
      companyId: "company-paradise",
      valueEstimate: 500000,
      expectedCloseDate: "2026-10-15",
    });

    localCrmActions.moveDeal(deal.id, "stage-qualified");

    const snapshot = getLocalCrmSnapshot();
    expect(snapshot.deals.find((candidate) => candidate.id === deal.id)).toMatchObject({
      stageId: "stage-qualified",
      probability: 30,
      status: "open",
    });
    expect(window.localStorage.getItem("alleato.crm.local.v1")).toContain(
      "Local test opportunity",
    );
  });

  it("shares accepted matching activity and manual activity across the workspace", () => {
    localCrmActions.addActivity({
      companyId: "company-paradise",
      companyName: "Paradise Isles",
      dealId: "deal-paradise",
      activityType: "call",
      subject: "Local follow-up call",
      visibilityScope: "standard",
    });
    localCrmActions.decideCandidate("candidate-2", true);

    const snapshot = getLocalCrmSnapshot();
    const expectedLatest = snapshot.activities
      .filter(
        (activity) =>
          activity.companyId === "company-paradise" &&
          ["call", "email", "meeting"].includes(activity.activityType),
      )
      .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))[0]
      .occurredAt;
    expect(snapshot.activities.some((activity) => activity.id === "accepted-candidate-2"))
      .toBe(true);
    expect(snapshot.activities.some((activity) => activity.subject === "Local follow-up call"))
      .toBe(true);
    expect(
      snapshot.accounts.find((account) => account.companyId === "company-paradise"),
    ).toMatchObject({
      healthStatus: "active",
      lastMeaningfulActivityAt: expectedLatest,
    });
    expect(snapshot.matchAliases).toContainEqual(
      expect.objectContaining({
        companyId: "company-paradise",
        outcome: "accepted",
      }),
    );
  });

  it("keeps simulated conversion and attachments local", () => {
    const conversion = localCrmActions.convertDeal("deal-atlas");
    localCrmActions.addAttachment("deal-atlas", "Local estimate.xlsx");

    const snapshot = getLocalCrmSnapshot();
    expect(conversion.erpExternalId).toBe("LOCAL-ONLY-4127");
    expect(snapshot.deals.find((deal) => deal.id === "deal-atlas")).toMatchObject({
      projectId: 4127,
      projectSyncStatus: "linked",
    });
    expect(snapshot.attachments["deal-atlas"]).toContain("Local estimate.xlsx");
  });

  it("keeps won-deal lifecycle and open value consistent", () => {
    localCrmActions.moveDeal("deal-west", "stage-won");

    expect(
      getLocalCrmSnapshot().accounts.find(
        (account) => account.companyId === "company-west",
      ),
    ).toMatchObject({
      lifecycleStage: "active_client",
      openDealValue: 0,
    });
  });

  it("creates, completes, and persists local follow-ups", () => {
    const followUp = localCrmActions.addFollowUp({
      companyId: "company-paradise",
      dealId: "deal-paradise",
      title: "Review local proposal",
      dueDate: "2026-08-12",
      assignee: "Brandon Clymer",
      priority: "high",
    });
    localCrmActions.updateFollowUpStatus(followUp.id, "done");

    expect(
      getLocalCrmSnapshot().followUps.find(
        (candidate) => candidate.id === followUp.id,
      ),
    ).toMatchObject({ status: "done" });
    expect(
      getLocalCrmSnapshot().accounts.find(
        (account) => account.companyId === "company-paradise",
      )?.nextFollowUpAt,
    ).toBe("2026-08-01");
  });

  it("edits and removes CRM follow-ups through the shared task workflow", () => {
    localCrmActions.updateFollowUp("task-1", {
      title: "Call Riverview about revised pricing",
      dueDate: "2026-08-20",
      status: "in_progress",
      priority: "urgent",
    });

    expect(
      getLocalCrmSnapshot().followUps.find(
        (candidate) => candidate.id === "task-1",
      ),
    ).toMatchObject({
      title: "Call Riverview about revised pricing",
      dueDate: "2026-08-20",
      status: "in_progress",
      priority: "urgent",
    });

    localCrmActions.removeFollowUp("task-1");
    expect(
      getLocalCrmSnapshot().followUps.some(
        (candidate) => candidate.id === "task-1",
      ),
    ).toBe(false);
  });

  it("supports guarded archive, restore, and project-link severing", () => {
    expect(() =>
      localCrmActions.archiveAccount("company-west", "Local cleanup"),
    ).toThrow(
      "Close or archive open deals first.",
    );
    localCrmActions.archiveDeal("deal-west", "Local cleanup");
    localCrmActions.archiveAccount("company-west", "Local cleanup");
    localCrmActions.restoreDeal("deal-west");
    localCrmActions.restoreAccount("company-west");
    localCrmActions.convertDeal("deal-atlas");
    localCrmActions.severProjectLink("deal-atlas", "Local test reset");

    const snapshot = getLocalCrmSnapshot();
    expect(snapshot.archivedDealIds).not.toContain("deal-west");
    expect(snapshot.archivedAccountIds).not.toContain("company-west");
    expect(snapshot.deals.find((deal) => deal.id === "deal-atlas")).toMatchObject({
      projectId: null,
      projectSyncStatus: "not_started",
    });
    expect(snapshot.auditNotes).toHaveLength(3);
  });

  it("rejects invalid numeric and date values", () => {
    expect(() =>
      localCrmActions.addDeal({
        name: "Invalid deal",
        companyId: "company-west",
        valueEstimate: Number.POSITIVE_INFINITY,
        expectedCloseDate: "2026-02-31",
      }),
    ).toThrow();
    expect(() =>
      localCrmActions.updateDeal("deal-west", { probability: 101 }),
    ).toThrow("Probability must be between 0 and 100.");
    expect(() =>
      localCrmActions.updateDeal("deal-west", { probability: 12.5 }),
    ).toThrow("Probability must be between 0 and 100.");
    expect(() =>
      localCrmActions.updateDeal("deal-west", { name: " " }),
    ).toThrow("Deal name is required.");
  });
});
