import type { AllCommentItem } from "@/app/api/comments/all/route";

import { buildCommentActivityItems } from "../use-comment-activity";

function comment(overrides: Partial<AllCommentItem>): AllCommentItem {
  return {
    documentId: "/team-chat",
    annotationId: "annotation-1",
    annotationNumber: 1,
    authorName: "Brandon Clymer",
    preview: "@Megan Harrison Please review this thread.",
    statusName: "Open",
    replyCount: 0,
    lastUpdated: 1_000,
    messages: [
      {
        commentId: "comment-1",
        authorName: "Brandon Clymer",
        text: "@Megan Harrison Please review this thread.",
        createdAt: 1_000,
      },
    ],
    ...overrides,
  };
}

describe("buildCommentActivityItems", () => {
  it("returns mention activity with a source-page discussion href", () => {
    const result = buildCommentActivityItems(
      [comment({ annotationId: "annotation-mention" })],
      "Megan Harrison",
    );

    expect(result).toEqual([
      expect.objectContaining({
        id: "comment:annotation-mention",
        activityType: "mention",
        href: "/team-chat?discussion=annotation-mention",
        title: "Brandon Clymer mentioned you",
      }),
    ]);
  });

  it("returns reply activity when someone else responds to my thread", () => {
    const result = buildCommentActivityItems(
      [
        comment({
          annotationId: "annotation-reply",
          authorName: "Megan Harrison",
          preview: "Original note",
          replyCount: 1,
          messages: [
            {
              commentId: "comment-1",
              authorName: "Megan Harrison",
              text: "Original note",
              createdAt: 1_000,
            },
            {
              commentId: "comment-2",
              authorName: "Brandon Clymer",
              text: "Following up on this now.",
              createdAt: 2_000,
            },
          ],
        }),
      ],
      "Megan Harrison",
    );

    expect(result).toEqual([
      expect.objectContaining({
        id: "comment:annotation-reply",
        activityType: "reply",
        title: "Brandon Clymer replied in comments",
        body: "Following up on this now.",
        followUpHref: "/team-chat?discussion=annotation-reply",
        followUpLabel: "Team chat",
      }),
    ]);
  });
});
