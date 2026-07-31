import {
  buildCommentInboxChannel,
  buildCommentInboxMessages,
  COMMENT_INBOX_CHANNEL_ID,
} from "../comment-dm";

describe("comment-dm", () => {
  const comments = [
    {
      documentId: "/25125/submittals",
      annotationId: "comment-1",
      annotationNumber: 1,
      authorName: "Brandon Clymer",
      preview: "Please review this thread.",
      statusName: "Open",
      replyCount: 0,
      lastUpdated: Date.UTC(2026, 6, 1, 10, 0, 0),
      messages: [
        {
          commentId: "comment-1",
          authorName: "Brandon Clymer",
          text: "Please review this thread.",
          createdAt: Date.UTC(2026, 6, 1, 10, 0, 0),
        },
      ],
    },
    {
      documentId: "/25125/rfis",
      annotationId: "comment-2",
      annotationNumber: 2,
      authorName: "Megan Harrison",
      preview: "Following up on the RFI.",
      statusName: "Open",
      replyCount: 1,
      lastUpdated: Date.UTC(2026, 6, 1, 11, 0, 0),
      messages: [
        {
          commentId: "comment-2",
          authorName: "Megan Harrison",
          text: "Following up on the RFI.",
          createdAt: Date.UTC(2026, 6, 1, 10, 45, 0),
        },
        {
          commentId: "comment-3",
          authorName: "Brandon Clymer",
          text: "Thanks, I will look now.",
          createdAt: Date.UTC(2026, 6, 1, 11, 0, 0),
        },
      ],
    },
  ] as never[];

  it("builds a read-only comments inbox channel", () => {
    const channel = buildCommentInboxChannel(comments);

    expect(channel.id).toBe(COMMENT_INBOX_CHANNEL_ID);
    expect(channel.readOnly).toBe(true);
    expect(channel.source).toBe("comments");
    expect(channel.preview).toBe("Thanks, I will look now.");
    expect(channel.lastMessageAt).toBe("2026-07-01T11:00:00.000Z");
  });

  it("builds message rows from the latest activity per comment thread", () => {
    const rows = buildCommentInboxMessages(comments);

    expect(rows).toEqual([
      expect.objectContaining({
        id: "comment:comment-1",
        channel_id: COMMENT_INBOX_CHANNEL_ID,
        user_name: "Brandon Clymer",
        content: "Please review this thread. · 25125 / submittals",
      }),
      expect.objectContaining({
        id: "comment:comment-2",
        channel_id: COMMENT_INBOX_CHANNEL_ID,
        user_name: "Brandon Clymer",
        content: "Thanks, I will look now. · 25125 / rfis",
      }),
    ]);
  });
});
