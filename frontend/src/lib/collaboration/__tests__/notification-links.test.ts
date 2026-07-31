import {
  getCollaborationNotificationHref,
  getCommentDiscussionHref,
  getCommentFollowUpAction,
  getCommentTeamChatHref,
} from "../notification-links";

describe("collaboration notification links", () => {
  it("routes submittal notifications to the submittals detail page", () => {
    expect(
      getCollaborationNotificationHref({
        projectId: 25125,
        entityType: "submittal",
        entityId: "sub-1",
      }),
    ).toBe("/25125/submittals/sub-1");
  });

  it("preserves known plural entity routes", () => {
    expect(
      getCollaborationNotificationHref({
        projectId: 25125,
        entityType: "rfis",
        entityId: "rfi-1",
      }),
    ).toBe("/25125/rfis/rfi-1");
  });

  it("routes schedule activity notifications to the canonical activity source", () => {
    expect(
      getCollaborationNotificationHref({
        projectId: 25125,
        entityType: "schedule_task",
        entityId: "activity-1",
      }),
    ).toBe("/25125/schedule?task_id=activity-1");
  });

  it("falls back to the raw entity type for unknown routes", () => {
    expect(
      getCollaborationNotificationHref({
        projectId: 25125,
        entityType: "custom-tool",
        entityId: "item-1",
      }),
    ).toBe("/25125/custom-tool/item-1");
  });

  it("falls back to team chat without project or entity context", () => {
    expect(
      getCollaborationNotificationHref({
        projectId: null,
        entityType: "submittal",
        entityId: "sub-1",
      }),
    ).toBe("/team-chat");
  });

  it("routes comment activity into the source page discussion sheet", () => {
    expect(getCommentDiscussionHref("/team-chat", "annotation-1")).toBe(
      "/team-chat?discussion=annotation-1",
    );
  });

  it("falls back to the comments workspace when no source route exists", () => {
    expect(getCommentDiscussionHref("", "annotation-1")).toBe(
      "/comments?thread=annotation-1",
    );
  });

  it("routes comment follow-up into team chat with the discussion id preserved", () => {
    expect(getCommentTeamChatHref("annotation-1")).toBe(
      "/team-chat?discussion=annotation-1",
    );
  });

  it("falls back to the comments workspace when there is no discussion id", () => {
    expect(getCommentTeamChatHref(null)).toBe("/comments");
  });

  it("returns the visible follow-up action for comment replies", () => {
    expect(getCommentFollowUpAction("annotation-1")).toEqual({
      href: "/team-chat?discussion=annotation-1",
      label: "Team chat",
    });
  });

  it("falls back to the comments workspace follow-up when the discussion id is missing", () => {
    expect(getCommentFollowUpAction(null)).toEqual({
      href: "/comments",
      label: "Comments workspace",
    });
  });
});
