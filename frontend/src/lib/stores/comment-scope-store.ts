import { create } from "zustand";

import type { CommentScope } from "@/lib/comments/comment-scope";

interface CommentScopeState {
  scopeOverride: CommentScope | null;
  setScopeOverride: (scope: CommentScope) => void;
  clearScopeOverride: () => void;
}

/**
 * Coordinates short-lived Velt composer ownership. This is intentionally not
 * persisted: a reload always restores the route's canonical comment scope.
 */
export const useCommentScopeStore = create<CommentScopeState>((set) => ({
  scopeOverride: null,
  setScopeOverride: (scopeOverride) => set({ scopeOverride }),
  clearScopeOverride: () => set({ scopeOverride: null }),
}));
