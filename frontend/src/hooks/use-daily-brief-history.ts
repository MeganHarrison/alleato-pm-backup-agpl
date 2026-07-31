"use client";

import { useQuery } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api-client";
import type { DailyBriefHistoryResponse } from "@/lib/daily-briefs/types";

export const dailyBriefHistoryKeys = {
  list: () => ["daily-brief-history"] as const,
};

export function useDailyBriefHistory() {
  return useQuery({
    queryKey: dailyBriefHistoryKeys.list(),
    queryFn: ({ signal }) =>
      apiFetch<DailyBriefHistoryResponse>(
        "/api/executive/daily-brief/history",
        { signal },
      ),
  });
}
