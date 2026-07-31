"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type {
  ScheduleTaskWithHierarchy,
  ScheduleSummary,
  GanttChartItem,
} from "@/types/scheduling";

export interface SchedulePageData {
  tasks: ScheduleTaskWithHierarchy[];
  summary: ScheduleSummary;
  ganttData: GanttChartItem[];
}

interface UseScheduleTasksOptions {
  projectId: string;
  enabled?: boolean;
}

interface UseScheduleTasksReturn {
  data: SchedulePageData | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

const defaultSummary: ScheduleSummary = {
  total_tasks: 0,
  completed_tasks: 0,
  in_progress_tasks: 0,
  not_started_tasks: 0,
  milestones_count: 0,
  overdue_tasks: 0,
  overall_percent_complete: 0,
};

/**
 * Hook for fetching schedule tasks data from API
 * Follows the same pattern as use-companies.ts and use-commitments.ts
 * Includes race condition protection via cancellation flag
 */
export function useScheduleTasks(
  options: UseScheduleTasksOptions
): UseScheduleTasksReturn {
  const { projectId, enabled = true } = options;
  const [data, setData] = useState<SchedulePageData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const cancelledRef = useRef(false);

  const fetchScheduleData = useCallback(async () => {
    if (!enabled || !projectId) return;

    cancelledRef.current = false;
    setIsLoading(true);
    setError(null);

    try {
      const apiUrl = `/api/projects/${projectId}/scheduling/tasks`;

      // Fetch all data in parallel (same as original fetcher pattern)
      const [hierarchyRes, summaryRes, ganttRes] = await Promise.all([
        fetch(`${apiUrl}?view=hierarchy`, { credentials: "include" }),
        fetch(`${apiUrl}?view=summary`, { credentials: "include" }),
        fetch(`${apiUrl}?view=gantt`, { credentials: "include" }),
      ]);

      if (cancelledRef.current) return;

      // Check for errors - detect auth failures specifically
      if (!hierarchyRes.ok || !summaryRes.ok || !ganttRes.ok) {
        const failedRes = !hierarchyRes.ok
          ? hierarchyRes
          : !summaryRes.ok
            ? summaryRes
            : ganttRes;

        if (failedRes.status === 401) {
          throw new Error("Your session has expired. Please refresh the page or log in again.");
        }
        if (failedRes.status === 403) {
          throw new Error("You don't have access to this project's schedule.");
        }

        throw new Error(`Failed to fetch schedule data (status: ${failedRes.status})`);
      }

      // Parse responses
      const [hierarchyData, summaryData, ganttData] = await Promise.all([
        hierarchyRes.json(),
        summaryRes.json(),
        ganttRes.json(),
      ]);

      if (cancelledRef.current) return;

      setData({
        tasks: hierarchyData.data || [],
        summary: summaryData.data || defaultSummary,
        ganttData: ganttData.data || [],
      });
    } catch (err) {
      if (!cancelledRef.current) {
        setError(
          err instanceof Error ? err : new Error("Failed to fetch schedule data")
        );
      }
    } finally {
      if (!cancelledRef.current) {
        setIsLoading(false);
      }
    }
  }, [projectId, enabled]);

  useEffect(() => {
    fetchScheduleData();

    return () => {
      cancelledRef.current = true;
    };
  }, [fetchScheduleData]);

  return {
    data,
    isLoading,
    error,
    refetch: fetchScheduleData,
  };
}
