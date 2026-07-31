"use client";
import { useSetDocument } from "@veltdev/react";

/**
 * Adds Velt freestyle comments to any page.
 * Call with a documentId that scopes the comments to the current entity.
 *
 * Example:
 *   <VeltFeedbackComments documentId="feedback-inbox" />
 *   <VeltFeedbackComments documentId={`feedback-item-${itemId}`} />
 */
export function VeltFeedbackComments({
  documentId,
  documentName,
}: {
  documentId: string;
  documentName?: string;
  showSidebar?: boolean;
}) {
  useSetDocument(documentId, { documentName: documentName ?? documentId });

  return null;
}

/**
 * @deprecated Use CommentsSidebarButton from @/components/header/comments-sidebar-button instead.
 * Kept for any existing callsites; renders nothing.
 */
export function VeltCommentToolbar() {
  return null;
}
