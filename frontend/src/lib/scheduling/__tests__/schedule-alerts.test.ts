import { buildPublishedScheduleAlert } from "../schedule-alerts";

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
});
