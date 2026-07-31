import {
  buildPublishedScheduleAlert,
  buildPublishedScheduleAlerts,
} from "../schedule-alerts";

describe("buildPublishedScheduleAlert", () => {
  it("refuses to emit an alert for an unpublished revision", () => {
    expect(buildPublishedScheduleAlert({ revisionId: "revision-1", revisionStatus: "draft", sourceTaskId: "task-1", recipientUserId: "user-1", kind: "date_changed" })).toBeNull();
  });

  it("creates one deterministic event key traceable to the published revision and source activity", () => {
    expect(buildPublishedScheduleAlert({ revisionId: "revision-2", revisionStatus: "published", sourceTaskId: "task-1", recipientUserId: "user-1", kind: "dependency_changed" })).toEqual({
      eventKey: "schedule-alert:revision-2:task-1:user-1:dependency_changed",
      metadata: { revisionId: "revision-2", sourceTaskId: "task-1", kind: "dependency_changed" },
    });
  });

  it("fans out once to each unique eligible company user in deterministic order", () => {
    expect(buildPublishedScheduleAlerts({
      revisionId: "revision-2",
      revisionStatus: "published",
      sourceTaskId: "task-1",
      recipientUserIds: ["user-2", "user-1", "user-2", "  ", "user-1"],
      kind: "date_changed",
    })).toEqual([
      expect.objectContaining({
        recipientUserId: "user-1",
        eventKey: "schedule-alert:revision-2:task-1:user-1:date_changed",
      }),
      expect.objectContaining({
        recipientUserId: "user-2",
        eventKey: "schedule-alert:revision-2:task-1:user-2:date_changed",
      }),
    ]);
  });

  it("does not fan out alerts from an unpublished revision", () => {
    expect(buildPublishedScheduleAlerts({
      revisionId: "revision-2",
      revisionStatus: "review",
      sourceTaskId: "task-1",
      recipientUserIds: ["user-1", "user-2"],
      kind: "dependency_changed",
    })).toEqual([]);
  });
});
