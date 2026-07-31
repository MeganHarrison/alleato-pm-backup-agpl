"use client";

import { VeltCommentsSidebar } from "@veltdev/react";

import { EntityComments } from "@/components/comments/entity-comments";
import { EntityRoom } from "@/components/comments/entity-room";
import { cn } from "@/lib/utils";

interface DrawingCommentsProps {
  drawingId: string;
  documentId?: string;
  projectId?: number;
  className?: string;
}

export function DrawingComments({
  drawingId,
  documentId,
  projectId,
  className,
}: DrawingCommentsProps) {
  if (!documentId) {
    return (
      <EntityRoom entityType="drawing" entityId={drawingId} projectId={projectId}>
        <EntityComments title="" stickyComposer className={className} />
      </EntityRoom>
    );
  }

  return (
    <section
      className={cn("alleato-comments h-full min-h-0 w-full", className)}
      data-comment-document-id={documentId}
      data-drawing-id={drawingId}
    >
      <VeltCommentsSidebar
        embedMode
        pageMode
        shadowDom={false}
        groupConfig={{ enable: false }}
        focusedThreadMode
        context={{
          commentChannel: "drawing",
          surface: "drawing-viewer",
          drawingId,
        }}
      />
    </section>
  );
}
