jest.mock("@/lib/microsoft-graph/calendar-events", () => ({
  listOutlookCalendarEvents: jest.fn(),
}));

import { evaluateOutlookOperationsStatus } from "../outlook-operations";

describe("evaluateOutlookOperationsStatus", () => {
  it("marks zero active Outlook subscriptions as degraded even when sync-state rows exist", () => {
    const result = evaluateOutlookOperationsStatus({
      source: "outlook_email",
      subscriptionCount: 1,
      activeSubscriptionCount: 0,
      syncStateCount: 12,
      erroredSyncStateCount: 0,
    });

    expect(result.status).toBe("degraded");
    expect(result.warnings).toEqual([
      expect.stringContaining("No active Outlook email subscriptions"),
    ]);
  });

  it("does not treat an all-zero operations read as healthy", () => {
    const result = evaluateOutlookOperationsStatus({
      source: "outlook_email",
      subscriptionCount: 0,
      activeSubscriptionCount: 0,
      syncStateCount: 0,
      erroredSyncStateCount: 0,
    });

    expect(result.status).toBe("degraded");
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        expect.stringContaining("No active Outlook email subscriptions"),
        expect.stringContaining("No Graph subscription or sync-state rows"),
      ]),
    );
  });

  it("marks visible active subscriptions with clean sync-state as healthy", () => {
    const result = evaluateOutlookOperationsStatus({
      source: "outlook_email",
      subscriptionCount: 1,
      activeSubscriptionCount: 1,
      syncStateCount: 12,
      erroredSyncStateCount: 0,
    });

    expect(result).toEqual({
      status: "healthy",
      warnings: [],
    });
  });
});
