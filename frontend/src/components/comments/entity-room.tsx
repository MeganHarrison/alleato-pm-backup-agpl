"use client";

import type { ReactNode } from "react";
import {
  CollaborationEntityProvider,
  type CollaborationEntityContextValue,
} from "./entity-context";
import type { CommentableEntityType } from "@/lib/collaboration/rooms";

interface EntityRoomProps {
  entityType: CommentableEntityType;
  entityId: string | number;
  projectId?: number;
  children: ReactNode;
}

/**
 * Preserves the existing EntityRoom API while using Supabase-backed collaboration.
 */
export function EntityRoom({
  entityType,
  entityId,
  projectId,
  children,
}: EntityRoomProps) {
  const value: CollaborationEntityContextValue = {
    entityType,
    entityId: String(entityId),
    projectId,
  };

  return <CollaborationEntityProvider value={value}>{children}</CollaborationEntityProvider>;
}
