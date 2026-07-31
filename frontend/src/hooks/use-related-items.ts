/**
 * use-related-items.ts
 *
 * TanStack Query hooks for the Phase-2 entity-links system.
 * Provides:
 *   - useRelatedItems(entityType, entityId, projectId) — fetch grouped links
 *   - useAddRelatedItem()  — mutation to POST /api/entity-links
 *   - useRemoveRelatedItem() — mutation to DELETE /api/entity-links/{linkId}
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { EntityType, LinkType } from "@/lib/entity-links/table-map";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LinkedItem {
  linkId: string;
  linkType: string;
  note: string | null;
  createdAt: string;
  tableName: string;
  targetType: EntityType;
  targetId: string | number;
  targetLabel: string;
  targetTitle: string;
}

export interface GroupedLinks {
  targetType: EntityType;
  label: string;
  items: LinkedItem[];
}

interface GetLinksResponse {
  groups: GroupedLinks[];
}

export interface AddLinkPayload {
  sourceType: EntityType;
  sourceId: string;
  targetType: EntityType;
  targetId: string;
  projectId: number;
  linkType?: LinkType;
  note?: string;
}

export interface RemoveLinkPayload {
  linkId: string;
  tableName: string;
}

// ── Query keys ────────────────────────────────────────────────────────────────

export const relatedItemsKeys = {
  all: ["related-items"] as const,
  entity: (entityType: EntityType, entityId: string, projectId: number) =>
    ["related-items", entityType, entityId, projectId] as const,
};

// ── useRelatedItems ───────────────────────────────────────────────────────────

export function useRelatedItems(
  entityType: EntityType,
  entityId: string | undefined | null,
  projectId: number | undefined | null,
) {
  return useQuery({
    queryKey: relatedItemsKeys.entity(
      entityType,
      entityId ?? "",
      projectId ?? 0,
    ),
    queryFn: async (): Promise<GroupedLinks[]> => {
      if (!entityId || !projectId) return [];

      const data = await apiFetch<GetLinksResponse>(
        `/api/entity-links?entityType=${entityType}&entityId=${encodeURIComponent(entityId)}&projectId=${projectId}`,
      );
      return data.groups;
    },
    enabled: Boolean(entityId) && Boolean(projectId),
    staleTime: 30_000,
  });
}

// ── useAddRelatedItem ─────────────────────────────────────────────────────────

export function useAddRelatedItem(
  entityType: EntityType,
  entityId: string,
  projectId: number,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: AddLinkPayload) =>
      apiFetch<{ id: string }>("/api/entity-links", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: relatedItemsKeys.entity(entityType, entityId, projectId),
      });
    },
  });
}

// ── useRemoveRelatedItem ──────────────────────────────────────────────────────

export function useRemoveRelatedItem(
  entityType: EntityType,
  entityId: string,
  projectId: number,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ linkId, tableName }: RemoveLinkPayload) =>
      apiFetch(`/api/entity-links/${linkId}?table=${encodeURIComponent(tableName)}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: relatedItemsKeys.entity(entityType, entityId, projectId),
      });
    },
  });
}

// ── useEntitySearch ───────────────────────────────────────────────────────────
// Lightweight search for the "Add Link" dialog — queries via the entity-links search endpoint

export interface SearchResult {
  id: string;
  title: string;
}

interface SearchResponse {
  results: SearchResult[];
}

export function useEntitySearch(
  targetType: EntityType | null,
  projectId: number,
  query: string,
) {
  return useQuery({
    queryKey: ["entity-search", targetType, projectId, query] as const,
    queryFn: async (): Promise<SearchResult[]> => {
      if (!targetType || !query.trim()) return [];
      const data = await apiFetch<SearchResponse>(
        `/api/entity-links/search?targetType=${targetType}&projectId=${projectId}&q=${encodeURIComponent(query)}`,
      );
      return data.results;
    },
    enabled: Boolean(targetType) && query.trim().length > 0,
    staleTime: 15_000,
  });
}
