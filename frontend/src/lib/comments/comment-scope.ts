export type CommentChannel = "drawing" | "site-feedback";

export interface CommentScope {
  channel: CommentChannel;
  routePath: string;
  documentId: string;
  documentName: string;
  targetElementId?: string;
  context: Record<string, unknown> & { commentChannel: CommentChannel };
}

const DRAWING_ROUTE_PATTERN = /^\/([^/]+)\/drawings\/viewer\/([^/?#]+)/;

export function getDrawingCommentTargetId(drawingId: string): string {
  return `drawing-comment-target-${drawingId}`;
}

export function getDrawingCommentScope({
  projectId,
  drawingId,
  routePath = `/${projectId}/drawings/viewer/${drawingId}`,
  page,
  documentName,
}: {
  projectId: string;
  drawingId: string;
  routePath?: string;
  page?: number;
  documentName?: string;
}): CommentScope {
  // Velt's canvas annotations are persisted against the route document. Keep
  // the sidebar on that exact document as well so a pin and its thread cannot
  // split across route and entity identifiers.
  const documentId = routePath;

  return {
    channel: "drawing",
    routePath,
    documentId,
    documentName: documentName || documentId,
    targetElementId: getDrawingCommentTargetId(drawingId),
    context: {
      commentChannel: "drawing",
      surface: "drawing-viewer",
      entityType: "drawing",
      entityId: drawingId,
      drawingId,
      projectId,
      ...(page ? { page } : {}),
    },
  };
}

export function getSiteFeedbackCommentScope(pathname: string): CommentScope {
  return {
    channel: "site-feedback",
    routePath: pathname,
    // Feedback from the site header is intentionally not part of the page's
    // domain discussion. Namespacing it prevents drawing threads from leaking
    // into the feedback workflow even though both originate on the same URL.
    documentId: `site-feedback:${pathname}`,
    documentName: pathname,
    context: {
      commentChannel: "site-feedback",
      surface: "site-header-feedback",
    },
  };
}

export function getDefaultCommentScope(pathname: string): CommentScope {
  const match = pathname.match(DRAWING_ROUTE_PATTERN);
  if (!match) return getSiteFeedbackCommentScope(pathname);

  return getDrawingCommentScope({
    projectId: decodeURIComponent(match[1]),
    drawingId: decodeURIComponent(match[2]),
    routePath: pathname,
  });
}

export function isDrawingCommentContext(context: unknown): boolean {
  return (
    typeof context === "object" &&
    context !== null &&
    (context as Record<string, unknown>).commentChannel === "drawing"
  );
}
