"use client";

import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { BoardStatus } from "@/lib/admin-feedback/constants";
import type { BoardCaptureTopicKey } from "./topics";

export interface BoardComment {
  id: string;
  body: string;
  created_at: string;
  author_id: string;
  screenshot_url: string | null;
  user_profiles: { full_name: string | null; email: string } | null;
}

export interface BoardItemLink {
  id: string;
  url: string;
  label: string;
}

export interface BoardLabel {
  id: string;
  color: string; // tailwind bg class e.g. "bg-red-500"
  name: string;  // user-supplied name e.g. "Design", "Backend"
}

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

export interface BoardItemMeta {
  links?: BoardItemLink[];
  upvotes?: number;
  upvoted_by?: string[]; // user IDs — persists across sessions
  labels?: BoardLabel[];
  topics?: BoardCaptureTopicKey[];
  tool?: string | null;
  category?: string | null;
  type?: string | null;
  due_date?: string | null;
  subtasks?: ChecklistItem[];
  prerequisites?: ChecklistItem[];
  docs_url?: string | null;
  linear_issue_id?: string | null;
  linear_issue_url?: string | null;
}

// ── Comments ─────────────────────────────────────────────────────────────────

export function useBoardItemComments(itemId: string) {
  return useQuery<{ comments: BoardComment[] }>({
    queryKey: ["board-item-comments", itemId],
    queryFn: () => apiFetch(`/api/admin/feedback/board/${itemId}/comments`),
    enabled: !!itemId,
  });
}

export function useAddComment(itemId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ body, screenshot_url }: { body: string; screenshot_url?: string | null }) =>
      apiFetch(`/api/admin/feedback/board/${itemId}/comments`, {
        method: "POST",
        body: JSON.stringify({ body, screenshot_url: screenshot_url ?? null }),
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["board-item-comments", itemId] }),
  });
}

// ── Update ────────────────────────────────────────────────────────────────────

export function useUpdateBoardItem(itemId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (updates: {
      board_status?: BoardStatus;
      title?: string;
      comment?: string;
      severity?: "low" | "medium" | "high";
      position?: number;
      assignee_id?: string | null;
      screenshot_url?: string | null;
      metadata?: Partial<BoardItemMeta>;
    }) =>
      apiFetch(`/api/admin/feedback/board/${itemId}`, {
        method: "PATCH",
        body: JSON.stringify(updates),
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["product-board"] }),
  });
}

export function usePatchBoardItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      itemId,
      updates,
    }: {
      itemId: string;
      updates: {
        board_status?: BoardStatus;
        title?: string;
        comment?: string;
        severity?: "low" | "medium" | "high";
        position?: number;
        assignee_id?: string | null;
        screenshot_url?: string | null;
        metadata?: Partial<BoardItemMeta>;
      };
    }) =>
      apiFetch(`/api/admin/feedback/board/${itemId}`, {
        method: "PATCH",
        body: JSON.stringify(updates),
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["product-board"] }),
  });
}

// ── Create ────────────────────────────────────────────────────────────────────

export function useCreateBoardItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (item: {
      title: string;
      board_status: BoardStatus;
      severity?: string;
      assignee_id?: string | null;
      topics?: BoardCaptureTopicKey[];
      tool?: string | null;
      category?: string | null;
      type?: string | null;
    }) =>
      apiFetch("/api/admin/feedback/board/create", {
        method: "POST",
        body: JSON.stringify(item),
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["product-board"] }),
  });
}

// ── Delete ────────────────────────────────────────────────────────────────────

export function useDeleteBoardItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) =>
      apiFetch(`/api/admin/feedback/board/${itemId}`, { method: "DELETE" }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["product-board"] }),
  });
}

// ── Users (for assignee selector) ─────────────────────────────────────────────

export interface BoardUser {
  id: string;
  full_name: string | null;
  email: string;
}

export function useBoardUsers() {
  return useQuery<{ users: BoardUser[] }>({
    queryKey: ["board-users"],
    queryFn: () => apiFetch("/api/users"),
    staleTime: 5 * 60 * 1000,
  });
}
