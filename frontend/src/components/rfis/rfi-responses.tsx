"use client";

import { EntityRoom } from "@/components/comments/entity-room";
import { EntityComments } from "@/components/comments/entity-comments";

interface RfiResponsesProps {
  rfiId: string;
  projectId?: number;
  className?: string;
  title?: string;
}

/**
 * RFI Responses section powered by Supabase collaboration comments.
 *
 * Wraps EntityRoom + EntityComments to provide:
 * - Threaded responses from assignees
 * - Thread resolve = official response designation
 * - Real-time presence indicators
 * - Rich text composer for new responses
 *
 * Usage:
 * ```tsx
 * <RfiResponses rfiId={rfi.id} />
 * ```
 */
export function RfiResponses({
  rfiId,
  projectId,
  className,
  title = "Responses",
}: RfiResponsesProps) {
  return (
    <EntityRoom entityType="rfi" entityId={rfiId} projectId={projectId}>
      <EntityComments title={title} className={className} />
    </EntityRoom>
  );
}
