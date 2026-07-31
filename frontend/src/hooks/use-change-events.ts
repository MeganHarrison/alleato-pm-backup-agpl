"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";

import { createClient } from "@/lib/supabase/client";
import type { ChangeEvent } from "@/types/change-events";

export type { ChangeEvent };

/**
 * Change Event in the Procore workflow:
 *
 * Change Events are the initial triggers for potential changes in a project.
 * They capture:
 * - Unforeseen field conditions
 * - Owner requests
 * - Design changes
 * - RFI outcomes
 * - Code compliance issues
 *
 * Workflow: Change Events → Potential Change Orders (PCO) → Prime Contract Change Orders (PCCO)
 */
export interface ChangeEventOption {
  value: string;
  label: string;
  status?: string;
  eventNumber?: string;
}

interface TabSummary {
  lineItems: number;
  noLineItems: number;
  rfqs: number;
  recycleBin: number;
}

interface UseChangeEventsOptions {
  // Filter by project ID
  projectId?: number;
  // Filter by status
  status?: string;
  // Filter by scope (e.g. "out_of_scope", "in_scope", "tbd")
  scope?: string;
  // Limit results
  limit?: number;
  // Page number (1-based) for server-side pagination
  page?: number;
  // Items per page for server-side pagination
  perPage?: number;
  // Tab filter for Procore-style tabs
  tab?: "line_items" | "no_line_items" | "rfqs" | "recycle_bin" | "all";
  // Whether to auto-fetch
  enabled?: boolean;
  // Include soft deleted records
  includeDeleted?: boolean;
}

interface UseChangeEventsReturn {
  changeEvents: ChangeEvent[];
  options: ChangeEventOption[];
  isLoading: boolean;
  error: Error | null;
  total: number;
  tabSummary: TabSummary | null;
  refetch: () => Promise<void>;
  createChangeEvent: (
    changeEvent: Partial<ChangeEvent>,
  ) => Promise<ChangeEvent | null>;
}

/**
 * Hook for fetching and managing change events from Supabase
 * Used in contract detail pages, change event forms, etc.
 */
export function useChangeEvents(
  options: UseChangeEventsOptions = {},
): UseChangeEventsReturn {
  const { projectId, status, scope, limit = 100, page, perPage, tab, enabled = true } = options;
  const { includeDeleted = false } = options;
  const [changeEvents, setChangeEvents] = useState<ChangeEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [total, setTotal] = useState(0);
  const [tabSummary, setTabSummary] = useState<TabSummary | null>(null);

  const fetchChangeEvents = useCallback(async () => {
    if (!enabled) return;

    setIsLoading(true);
    setError(null);

    try {
      // Project-scoped pages should use API enrichment so table parity fields
      // (RFQ title, commitment info, cost rollups) are consistently available.
      if (projectId) {
        const searchParams = new URLSearchParams();
        // Use page/perPage for server-side pagination when provided, else fall back to limit
        if (page !== undefined && perPage !== undefined) {
          searchParams.set("page", String(page));
          searchParams.set("limit", String(perPage));
        } else {
          searchParams.set("limit", String(limit));
        }
        if (status) searchParams.set("status", status);
        if (scope) searchParams.set("scope", scope);
        if (includeDeleted) searchParams.set("includeDeleted", "true");
        if (tab) searchParams.set("tab", tab);

        const payload = await apiFetch<{
          data?: ChangeEvent[];
          meta?: {
            total?: number;
            tabSummary?: TabSummary | null;
          };
        }>(
          `/api/projects/${projectId}/change-events?${searchParams.toString()}`,
          { cache: "no-store" },
        );
        setChangeEvents(payload.data || []);
        setTotal(payload.meta?.total ?? 0);
        setTabSummary(payload.meta?.tabSummary ?? null);
        return;
      }

      const supabase = createClient();
      let query = supabase
        .from("change_events")
        .select("*")
        .order("number", { ascending: true })
        .limit(limit);

      if (status) {
        query = query.eq("status", status);
      }

      if (!includeDeleted) {
        query = query.is("deleted_at", null);
      }

      const { data, error: queryError } = await query;

      if (queryError) {
        throw new Error(queryError.message);
      }

      setChangeEvents((data as ChangeEvent[]) || []);
    } catch (err) {
      const detail = err instanceof Error ? err.message : "an unexpected error occurred";
      setError(new Error(`Could not load change events: ${detail}`));
    } finally {
      setIsLoading(false);
    }
  }, [projectId, status, scope, limit, page, perPage, tab, enabled, includeDeleted]);

  useEffect(() => {
    fetchChangeEvents();
  }, [fetchChangeEvents]);

  const createChangeEvent = useCallback(
    async (changeEvent: Partial<ChangeEvent>): Promise<ChangeEvent | null> => {
      try {
        if (!changeEvent.project_id) {
          throw new Error("Project ID is required");
        }

        const data = await apiFetch<ChangeEvent>(
          `/api/projects/${changeEvent.project_id}/change-events`,
          {
            method: "POST",
            body: JSON.stringify({
              title: changeEvent.title,
              type: changeEvent.type || "Owner Change",
              scope: changeEvent.scope || "TBD",
              reason: changeEvent.reason || undefined,
              description: changeEvent.description || undefined,
            }),
          },
        );

        // Refetch to update the list
        await fetchChangeEvents();
        return data;
      } catch (err) {
        const detail = err instanceof Error ? err.message : "an unexpected error occurred";
        setError(new Error(`Could not create change event: ${detail}`));
        return null;
      }
    },
    [fetchChangeEvents],
  );

  // Transform change events to options for dropdowns
  const changeEventOptions: ChangeEventOption[] = changeEvents.map((ce) => {
    const number = ce.number || `CE-${ce.id}`;
    const label = ce.title ? `${number}: ${ce.title}` : number;

    return {
      value: ce.id.toString(),
      label,
      status: ce.status || undefined,
      eventNumber: number,
    };
  });

  return {
    changeEvents,
    options: changeEventOptions,
    isLoading,
    error,
    total,
    tabSummary,
    refetch: fetchChangeEvents,
    createChangeEvent,
  };
}

/**
 * Helper hook to get change events for a specific project
 */
type ProjectOptions = Omit<UseChangeEventsOptions, "projectId">;

export function useProjectChangeEvents(
  projectId: number,
  options: ProjectOptions = {},
) {
  const { enabled, ...rest } = options;
  return useChangeEvents({
    projectId,
    enabled: enabled ?? !!projectId,
    ...rest,
  });
}
