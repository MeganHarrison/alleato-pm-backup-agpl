"use client";

import * as React from "react";
import type { CommentableEntityType } from "@/lib/collaboration/rooms";

export interface CollaborationEntityContextValue {
  entityType: CommentableEntityType;
  entityId: string;
  projectId?: number;
}

const CollaborationEntityContext =
  React.createContext<CollaborationEntityContextValue | null>(null);

export function CollaborationEntityProvider({
  value,
  children,
}: {
  value: CollaborationEntityContextValue;
  children: React.ReactNode;
}) {
  return (
    <CollaborationEntityContext.Provider value={value}>
      {children}
    </CollaborationEntityContext.Provider>
  );
}

export function useCollaborationEntityContext() {
  return React.useContext(CollaborationEntityContext);
}
