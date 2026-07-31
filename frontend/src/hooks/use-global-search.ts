"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { GlobalSearchResult } from "@/lib/search/global-search-config";

interface GlobalSearchResponse {
  results: GlobalSearchResult[];
}

/**
 * Fetches site-wide search results for a (already-debounced) term.
 *
 * Pass `enabled: false` while the palette is closed to avoid firing requests.
 * The term should be trimmed by the caller; queries shorter than 2 characters
 * are skipped to keep the palette responsive and avoid over-broad matches.
 */
export function useGlobalSearch(term: string, projectId: number | null) {
  const trimmed = term.trim();
  const enabled = trimmed.length >= 2;

  const query = useQuery({
    queryKey: ["global-search", trimmed, projectId],
    enabled,
    staleTime: 30_000,
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams({ q: trimmed });
      if (projectId !== null) {
        params.set("projectId", String(projectId));
      }
      const response = await apiFetch<GlobalSearchResponse>(
        `/api/search?${params.toString()}`,
        { signal },
      );
      return response.results;
    },
  });

  return {
    results: query.data ?? [],
    isLoading: enabled && query.isLoading,
    isError: query.isError,
    enabled,
  };
}
