"use client";

import { useCallback, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { BoardStatus } from "@/lib/admin-feedback/constants";

export interface BoardAssignee {
  id: string;
  full_name: string | null;
  email: string;
}

export interface BoardItem {
  id: string;
  title: string;
  comment: string;
  request_type: string;
  board_status: BoardStatus;
  severity: string | null;
  position: number;
  created_at: string;
  page_title: string | null;
  page_path: string;
  created_by: string;
  metadata?: unknown;
  assignee_id: string | null;
  assignee?: BoardAssignee | null;
  submitter?: BoardAssignee | null;
  comment_count: number;
  screenshot_url: string | null;
}

export function useProductBoard() {
  const queryClient = useQueryClient();

  const query = useQuery<{ items: BoardItem[] }>({
    queryKey: ["product-board"],
    queryFn: () => apiFetch("/api/admin/feedback/board"),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, board_status, position }: { id: string; board_status: BoardStatus; position?: number }) =>
      apiFetch(`/api/admin/feedback/board/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ board_status, ...(position !== undefined ? { position } : {}) }),
      }),
    onMutate: async ({ id, board_status, position }) => {
      await queryClient.cancelQueries({ queryKey: ["product-board"] });
      const previous = queryClient.getQueryData<{ items: BoardItem[] }>(["product-board"]);
      queryClient.setQueryData<{ items: BoardItem[] }>(["product-board"], (old) => ({
        items: (old?.items ?? []).map((item) =>
          item.id === id
            ? { ...item, board_status, ...(position !== undefined ? { position } : {}) }
            : item
        ),
      }));
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(["product-board"], context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["product-board"] }),
  });

  const reorderMutation = useMutation({
    mutationFn: ({ id, position }: { id: string; position: number }) =>
      apiFetch(`/api/admin/feedback/board/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ position }),
      }),
    onMutate: async ({ id, position }) => {
      await queryClient.cancelQueries({ queryKey: ["product-board"] });
      const previous = queryClient.getQueryData<{ items: BoardItem[] }>(["product-board"]);
      queryClient.setQueryData<{ items: BoardItem[] }>(["product-board"], (old) => ({
        items: (old?.items ?? []).map((item) =>
          item.id === id ? { ...item, position } : item
        ),
      }));
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(["product-board"], context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["product-board"] }),
  });

  const [activeId, setActiveId] = useState<string | null>(null);

  const updateStatus = useCallback(
    (id: string, board_status: BoardStatus, position?: number) =>
      statusMutation.mutate({ id, board_status, position }),
    [statusMutation]
  );

  const reorder = useCallback(
    (id: string, position: number) => reorderMutation.mutate({ id, position }),
    [reorderMutation]
  );

  return {
    items: query.data?.items ?? [],
    isLoading: query.isLoading,
    error: query.error,
    activeId,
    setActiveId,
    updateStatus,
    reorder,
  };
}
