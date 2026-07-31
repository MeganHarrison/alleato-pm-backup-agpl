import {
  getDefaultCommentScope,
  getDrawingCommentScope,
  getSiteFeedbackCommentScope,
  isDrawingCommentContext,
} from "./comment-scope";

describe("comment scope ownership", () => {
  it("uses one durable drawing document and target for the viewer route", () => {
    const scope = getDefaultCommentScope(
      "/67/drawings/viewer/ef8708e3-b196-437f-8745-3696105fc8d9",
    );

    expect(scope).toMatchObject({
      channel: "drawing",
      documentId:
        "/67/drawings/viewer/ef8708e3-b196-437f-8745-3696105fc8d9",
      targetElementId:
        "drawing-comment-target-ef8708e3-b196-437f-8745-3696105fc8d9",
      context: {
        commentChannel: "drawing",
        projectId: "67",
        drawingId: "ef8708e3-b196-437f-8745-3696105fc8d9",
      },
    });
  });

  it("keeps site feedback in a separate document even on a drawing page", () => {
    const pathname =
      "/67/drawings/viewer/ef8708e3-b196-437f-8745-3696105fc8d9";
    const drawing = getDrawingCommentScope({
      projectId: "67",
      drawingId: "ef8708e3-b196-437f-8745-3696105fc8d9",
    });
    const feedback = getSiteFeedbackCommentScope(pathname);

    expect(feedback.documentId).toBe(`site-feedback:${pathname}`);
    expect(feedback.documentId).not.toBe(drawing.documentId);
    expect(feedback.context.commentChannel).toBe("site-feedback");
  });

  it("identifies drawing comments so they are excluded from feedback mirroring", () => {
    expect(isDrawingCommentContext({ commentChannel: "drawing" })).toBe(true);
    expect(isDrawingCommentContext({ commentChannel: "site-feedback" })).toBe(
      false,
    );
    expect(isDrawingCommentContext(undefined)).toBe(false);
  });
});
