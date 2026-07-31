"use client";

import { useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-client";
import {
  assistantSurfaceQuery,
  DEFAULT_ASSISTANT_SURFACE,
  type AssistantSurface,
} from "@/lib/ai/chat-surface";

export interface RagConversation {
  session_id: string;
  title: string | null;
  last_message_at: string | null;
  created_at: string | null;
  metadata: Record<string, unknown> | null;
  is_pinned: boolean;
}

function queryKey(surface: AssistantSurface) {
  return ["rag-conversations", surface] as const;
}

export function useRagConversations(
  surface: AssistantSurface = DEFAULT_ASSISTANT_SURFACE,
) {
  return useQuery<RagConversation[]>({
    queryKey: queryKey(surface),
    queryFn: async ({ signal }) => {
      const data = await apiFetch<{ conversations: RagConversation[] }>(
        `/api/ai-assistant/conversations?${assistantSurfaceQuery(surface)}`,
        { signal },
      );
      return data.conversations;
    },
  });
}

export function useCreateConversation(
  surface: AssistantSurface = DEFAULT_ASSISTANT_SURFACE,
) {
  const queryClient = useQueryClient();
  const inFlightRequestRef = useRef<Promise<RagConversation> | null>(null);

  return useMutation({
    mutationFn: (title: string) => {
      if (inFlightRequestRef.current) return inFlightRequestRef.current;

      const request = apiFetch<{ conversation: RagConversation }>(
        `/api/ai-assistant/conversations?${assistantSurfaceQuery(surface)}`,
        {
          method: "POST",
          body: JSON.stringify({ title, metadata: { surface } }),
        },
      ).then((data) => data.conversation);

      inFlightRequestRef.current = request;
      return request.finally(() => {
        if (inFlightRequestRef.current === request) {
          inFlightRequestRef.current = null;
        }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKey(surface) });
    },
    onError: (err: Error) => {
      toast.error(`Failed to create conversation: ${err.message}`);
    },
  });
}

export function useRenameConversation(
  surface: AssistantSurface = DEFAULT_ASSISTANT_SURFACE,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ sessionId, title }: { sessionId: string; title: string }) =>
      apiFetch(
        `/api/ai-assistant/conversations/${sessionId}?${assistantSurfaceQuery(surface)}`,
        {
          method: "PATCH",
          body: JSON.stringify({ title }),
        },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKey(surface) });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}

export function useTogglePinConversation(
  surface: AssistantSurface = DEFAULT_ASSISTANT_SURFACE,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      sessionId,
      isPinned,
    }: {
      sessionId: string;
      isPinned: boolean;
    }) =>
      apiFetch(
        `/api/ai-assistant/conversations/${sessionId}?${assistantSurfaceQuery(surface)}`,
        {
          method: "PATCH",
          body: JSON.stringify({ is_pinned: isPinned }),
        },
      ),
    onMutate: async ({ sessionId, isPinned }) => {
      await queryClient.cancelQueries({ queryKey: queryKey(surface) });
      const previous = queryClient.getQueryData<RagConversation[]>(
        queryKey(surface),
      );
      queryClient.setQueryData<RagConversation[]>(
        queryKey(surface),
        (current) =>
          (current ?? []).map((conversation) =>
            conversation.session_id === sessionId
              ? { ...conversation, is_pinned: isPinned }
              : conversation,
          ),
      );
      return { previous };
    },
    onError: (err: Error, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey(surface), context.previous);
      }
      toast.error(err.message);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKey(surface) });
    },
  });
}

export function useDeleteConversation(
  surface: AssistantSurface = DEFAULT_ASSISTANT_SURFACE,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (sessionId: string) =>
      apiFetch(
        `/api/ai-assistant/conversations/${sessionId}?${assistantSurfaceQuery(surface)}`,
        {
          method: "DELETE",
        },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKey(surface) });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}
