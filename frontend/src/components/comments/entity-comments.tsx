"use client";

import * as React from "react";
import { AlertCircle, MessageSquarePlus } from "lucide-react";
import { VeltInlineCommentsSection } from "@veltdev/react";

import { cn } from "@/lib/utils";
import { useCollaborationEntityContext } from "./entity-context";

interface EntityCommentsProps {
  title?: string;
  className?: string;
  /** Keep the composer visible at the bottom while scrolling thread history. */
  stickyComposer?: boolean;
}

function toDomId(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "-");
}

// Render an inline comment section for the current entity context.
export function EntityComments(props: EntityCommentsProps) {
  return <VeltEntityComments {...props} />;
}

function VeltEntityComments({
  title = "Comments",
  className,
  stickyComposer = false,
}: EntityCommentsProps) {
  const entity = useCollaborationEntityContext();
  const reactId = React.useId();

  if (!entity) {
    return (
      <div className="flex flex-col items-center gap-2 py-10 text-center">
        <AlertCircle className="h-5 w-5 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Comments unavailable for this page.
        </p>
      </div>
    );
  }

  const documentId = `entity:${entity.entityType}:${entity.entityId}`;
  const sectionId = `velt-inline-${toDomId(documentId)}-${toDomId(reactId)}`;

  return (
    <section
      id={sectionId}
      className={cn(
        "alleato-comments w-full",
        stickyComposer && "flex h-full min-h-0 flex-col",
        className,
      )}
    >
      {title.trim().length > 0 ? (
        <div className="mb-6 flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
            <MessageSquarePlus className="h-4 w-4 text-primary" />
          </div>
          {/* eslint-disable-next-line design-system/no-raw-heading */}
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        </div>
      ) : null}

      <VeltInlineCommentsSection
        targetElementId={sectionId}
        documentId={documentId}
        shadowDom={false}
        multiThread
        composerPosition="bottom"
        sortBy="lastUpdated"
        sortOrder="desc"
        messageTruncation
        messageTruncationLines={4}
        commentPlaceholder="Write a comment..."
        replyPlaceholder="Write a reply..."
        composerPlaceholder="Write a comment..."
        context={{
          surface: "entity-comments",
          entityType: entity.entityType,
          entityId: entity.entityId,
          projectId: entity.projectId,
        }}
      />
    </section>
  );
}
