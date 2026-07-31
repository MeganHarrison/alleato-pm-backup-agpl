import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api-client";
import type {
  MyFeedbackItem,
  MyFeedbackSignalTone,
} from "@/lib/ai/services/my-feedback-service";

export type { MyFeedbackItem } from "@/lib/ai/services/my-feedback-service";

interface MyFeedbackResponse {
  items: MyFeedbackItem[];
  surfaces: { key: string; label: string }[];
  total: number;
}

export interface MyFeedbackFilters {
  surface?: string;
  signal?: MyFeedbackSignalTone;
}

const BASE = "/api/ai-assistant/my-feedback";

function buildUrl(filters: MyFeedbackFilters): string {
  const params = new URLSearchParams();
  if (filters.surface) params.set("surface", filters.surface);
  if (filters.signal) params.set("signal", filters.signal);
  const qs = params.toString();
  return qs ? `${BASE}?${qs}` : BASE;
}

export function useMyFeedback(filters: MyFeedbackFilters = {}) {
  return useQuery({
    queryKey: ["my-feedback", filters.surface ?? null, filters.signal ?? null],
    queryFn: () => apiFetch<MyFeedbackResponse>(buildUrl(filters)),
    staleTime: 30_000,
  });
}

export interface EditMyFeedbackInput {
  id: string;
  signal?: "positive" | "negative";
  note?: string | null;
}

export function useEditMyFeedback() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: EditMyFeedbackInput) =>
      apiFetch<{ success: boolean }>(BASE, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-feedback"] });
    },
  });
}

export function useRetractMyFeedback() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ success: boolean }>(BASE, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-feedback"] });
    },
  });
}
