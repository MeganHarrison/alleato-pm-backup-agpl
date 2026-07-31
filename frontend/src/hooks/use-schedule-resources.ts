"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import type {
  ScheduleResourceCapacityProfile,
  ScheduleResourceCapacityProfileInput,
  ScheduleResourceCapacityRangeResponse,
  ScheduleResourceLevelingPreviewResult,
  ScheduleResourceRosterResponse,
  ScheduleTaskAssignment,
  ScheduleTaskAssignmentExpectation,
  ScheduleTaskAssignmentInput,
} from "@/types/scheduling";

interface UseScheduleResourcesOptions {
  projectId: string;
  enabled?: boolean;
}

interface UseScheduleResourcesReturn {
  roster: ScheduleResourceRosterResponse | null;
  isLoading: boolean;
  error: Error | null;
  capacityRange: ScheduleResourceCapacityRangeResponse | null;
  isCapacityRangeLoading: boolean;
  capacityRangeError: Error | null;
  selectedCapacityProfile: ScheduleResourceCapacityProfile | null;
  isCapacityProfileLoading: boolean;
  capacityProfileError: Error | null;
  levelingPreview: ScheduleResourceLevelingPreviewResult | null;
  isLevelingPreviewLoading: boolean;
  levelingPreviewError: Error | null;
  refetch: () => Promise<void>;
  loadCapacityRange: (start: string, finish: string) => Promise<ScheduleResourceCapacityRangeResponse>;
  fetchCapacityProfilesForRange: (start: string, finish: string) => Promise<ScheduleResourceCapacityProfile[]>;
  loadCapacityProfile: (resourceId: string) => Promise<ScheduleResourceCapacityProfile>;
  replaceCapacityProfile: (
    resourceId: string,
    input: ScheduleResourceCapacityProfileInput,
  ) => Promise<ScheduleResourceCapacityProfile>;
  previewResourceLeveling: (horizonDays?: number) => Promise<ScheduleResourceLevelingPreviewResult>;
  clearLevelingPreview: () => void;
  replaceTaskAssignments: (
    taskId: string,
    assignments: ScheduleTaskAssignmentInput[],
    expectedAssignments: ScheduleTaskAssignmentExpectation[],
  ) => Promise<ScheduleTaskAssignment[]>;
}

const RANGE_LIMIT_DAYS = 92;
const DAY_MS = 86_400_000;
const CAPACITY_READ_DRIFT_MESSAGE = "Project capacity changed while this date range was loading. Retry to use one consistent version.";

function addCalendarDays(value: string, days: number): string {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(parsed.getTime())) throw new Error("Choose valid project-capacity dates.");
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

function mergeCapacityRanges(
  projectId: number,
  start: string,
  finish: string,
  chunks: ScheduleResourceCapacityRangeResponse[],
): ScheduleResourceCapacityRangeResponse {
  const firstChunk = chunks[0];
  if (firstChunk) {
    const baseline = new Map(firstChunk.profiles.map((profile) => [
      profile.resource_id,
      JSON.stringify({
        profile_id: profile.profile_id,
        configured: profile.configured,
        version: profile.version,
        weekday_overrides: [...profile.weekday_overrides].sort((left, right) => left.weekday - right.weekday),
      }),
    ]));
    for (const chunk of chunks.slice(1)) {
      if (chunk.profiles.length !== baseline.size) throw new Error(CAPACITY_READ_DRIFT_MESSAGE);
      for (const profile of chunk.profiles) {
        const signature = baseline.get(profile.resource_id);
        const currentSignature = JSON.stringify({
          profile_id: profile.profile_id,
          configured: profile.configured,
          version: profile.version,
          weekday_overrides: [...profile.weekday_overrides].sort((left, right) => left.weekday - right.weekday),
        });
        if (signature !== currentSignature) throw new Error(CAPACITY_READ_DRIFT_MESSAGE);
      }
    }
  }

  const profilesByResource = new Map<string, ScheduleResourceCapacityProfile>();
  for (const chunk of chunks) {
    for (const profile of chunk.profiles) {
      const existing = profilesByResource.get(profile.resource_id);
      if (!existing) {
        profilesByResource.set(profile.resource_id, {
          ...profile,
          coverage_start_date: start,
          coverage_finish_date: finish,
          weekday_overrides: [...profile.weekday_overrides],
          exceptions: [...profile.exceptions],
        });
        continue;
      }
      const exceptions = new Map(existing.exceptions.map((exception) => [exception.date, exception]));
      for (const exception of profile.exceptions) exceptions.set(exception.date, exception);
      existing.exceptions = [...exceptions.values()].sort((left, right) => left.date.localeCompare(right.date));
    }
  }
  return { project_id: projectId, range: { start, finish }, profiles: [...profilesByResource.values()] };
}

export function useScheduleResources({
  projectId,
  enabled = true,
}: UseScheduleResourcesOptions): UseScheduleResourcesReturn {
  const [roster, setRoster] = useState<ScheduleResourceRosterResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [capacityRange, setCapacityRange] = useState<ScheduleResourceCapacityRangeResponse | null>(null);
  const [isCapacityRangeLoading, setIsCapacityRangeLoading] = useState(false);
  const [capacityRangeError, setCapacityRangeError] = useState<Error | null>(null);
  const [selectedCapacityProfile, setSelectedCapacityProfile] = useState<ScheduleResourceCapacityProfile | null>(null);
  const [isCapacityProfileLoading, setIsCapacityProfileLoading] = useState(false);
  const [capacityProfileError, setCapacityProfileError] = useState<Error | null>(null);
  const [levelingPreview, setLevelingPreview] = useState<ScheduleResourceLevelingPreviewResult | null>(null);
  const [isLevelingPreviewLoading, setIsLevelingPreviewLoading] = useState(false);
  const [levelingPreviewError, setLevelingPreviewError] = useState<Error | null>(null);
  const requestIdRef = useRef(0);
  const capacityRangeRequestIdRef = useRef(0);
  const capacityProfileRequestIdRef = useRef(0);
  const levelingRequestIdRef = useRef(0);

  const refetch = useCallback(async () => {
    if (!enabled || !projectId) {
      requestIdRef.current += 1;
      setRoster(null);
      setError(null);
      setIsLoading(false);
      capacityRangeRequestIdRef.current += 1;
      capacityProfileRequestIdRef.current += 1;
      levelingRequestIdRef.current += 1;
      setCapacityRange(null);
      setCapacityRangeError(null);
      setIsCapacityRangeLoading(false);
      setSelectedCapacityProfile(null);
      setCapacityProfileError(null);
      setIsCapacityProfileLoading(false);
      setLevelingPreview(null);
      setLevelingPreviewError(null);
      setIsLevelingPreviewLoading(false);
      return;
    }
    const requestId = ++requestIdRef.current;
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiFetch<ScheduleResourceRosterResponse>(
        `/api/projects/${projectId}/scheduling/resources`,
        { cache: "no-store" },
      );
      if (requestId === requestIdRef.current) setRoster(data);
    } catch (cause) {
      if (requestId === requestIdRef.current) {
        setRoster(null);
        setError(cause instanceof Error ? cause : new Error("Unable to load schedule resources."));
      }
    } finally {
      if (requestId === requestIdRef.current) setIsLoading(false);
    }
  }, [enabled, projectId]);

  useEffect(() => {
    void refetch();
    return () => {
      requestIdRef.current += 1;
      capacityRangeRequestIdRef.current += 1;
      capacityProfileRequestIdRef.current += 1;
      levelingRequestIdRef.current += 1;
    };
  }, [refetch]);

  const fetchCapacityProfilesForRange = useCallback(async (start: string, finish: string) => {
    if (!projectId) throw new Error("Select a project before loading project capacity.");
    const startTime = Date.parse(`${start}T00:00:00.000Z`);
    const finishTime = Date.parse(`${finish}T00:00:00.000Z`);
    if (!Number.isFinite(startTime) || !Number.isFinite(finishTime) || finishTime < startTime) {
      throw new Error("Choose valid ascending project-capacity dates.");
    }
    const chunks: ScheduleResourceCapacityRangeResponse[] = [];
    for (let chunkStart = start; chunkStart <= finish;) {
      const chunkFinish = [addCalendarDays(chunkStart, RANGE_LIMIT_DAYS - 1), finish].sort()[0];
      chunks.push(await apiFetch<ScheduleResourceCapacityRangeResponse>(
        `/api/projects/${projectId}/scheduling/resources?view=capacity&start=${encodeURIComponent(chunkStart)}&finish=${encodeURIComponent(chunkFinish)}`,
        { cache: "no-store" },
      ));
      if (chunkFinish === finish) break;
      chunkStart = addCalendarDays(chunkFinish, 1);
    }
    return mergeCapacityRanges(Number(projectId), start, finish, chunks).profiles;
  }, [projectId]);

  const loadCapacityRange = useCallback(async (start: string, finish: string) => {
    const requestId = ++capacityRangeRequestIdRef.current;
    setIsCapacityRangeLoading(true);
    setCapacityRangeError(null);
    try {
      const profiles = await fetchCapacityProfilesForRange(start, finish);
      const response = { project_id: Number(projectId), range: { start, finish }, profiles };
      if (requestId === capacityRangeRequestIdRef.current) setCapacityRange(response);
      return response;
    } catch (cause) {
      const nextError = cause instanceof Error ? cause : new Error("Unable to load project capacity.");
      if (requestId === capacityRangeRequestIdRef.current) {
        setCapacityRange(null);
        setCapacityRangeError(nextError);
      }
      throw nextError;
    } finally {
      if (requestId === capacityRangeRequestIdRef.current) setIsCapacityRangeLoading(false);
    }
  }, [fetchCapacityProfilesForRange, projectId]);

  const loadCapacityProfile = useCallback(async (resourceId: string) => {
    const requestId = ++capacityProfileRequestIdRef.current;
    setIsCapacityProfileLoading(true);
    setCapacityProfileError(null);
    setSelectedCapacityProfile(null);
    try {
      const response = await apiFetch<{ data: ScheduleResourceCapacityProfile }>(
        `/api/projects/${projectId}/scheduling/resources?view=capacity-profile&resourceId=${encodeURIComponent(resourceId)}`,
        { cache: "no-store" },
      );
      if (requestId === capacityProfileRequestIdRef.current) setSelectedCapacityProfile(response.data);
      return response.data;
    } catch (cause) {
      const nextError = cause instanceof Error ? cause : new Error("Unable to load this capacity profile.");
      if (requestId === capacityProfileRequestIdRef.current) setCapacityProfileError(nextError);
      throw nextError;
    } finally {
      if (requestId === capacityProfileRequestIdRef.current) setIsCapacityProfileLoading(false);
    }
  }, [projectId]);

  const clearLevelingPreview = useCallback(() => {
    levelingRequestIdRef.current += 1;
    setLevelingPreview(null);
    setLevelingPreviewError(null);
    setIsLevelingPreviewLoading(false);
  }, []);

  const replaceCapacityProfile = useCallback(async (
    resourceId: string,
    input: ScheduleResourceCapacityProfileInput,
  ) => {
    setCapacityProfileError(null);
    const response = await apiFetch<{ data: ScheduleResourceCapacityProfile }>(
      `/api/projects/${projectId}/scheduling/resources?view=capacity-profile&resourceId=${encodeURIComponent(resourceId)}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      },
    );
    setSelectedCapacityProfile(response.data);
    setCapacityRange((current) => {
      if (!current) return current;
      const nextProfile = {
        ...response.data,
        coverage_start_date: current.range.start,
        coverage_finish_date: current.range.finish,
      };
      return {
        ...current,
        profiles: current.profiles.some((profile) => profile.resource_id === resourceId)
          ? current.profiles.map((profile) => profile.resource_id === resourceId ? nextProfile : profile)
          : [...current.profiles, nextProfile],
      };
    });
    clearLevelingPreview();
    return response.data;
  }, [clearLevelingPreview, projectId]);

  const previewResourceLeveling = useCallback(async (horizonDays = 365) => {
    const requestId = ++levelingRequestIdRef.current;
    setIsLevelingPreviewLoading(true);
    setLevelingPreviewError(null);
    try {
      const response = await apiFetch<{ data: ScheduleResourceLevelingPreviewResult }>(
        `/api/projects/${projectId}/scheduling/resources?operation=leveling-preview`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ horizon_days: horizonDays }),
        },
      );
      if (requestId === levelingRequestIdRef.current) setLevelingPreview(response.data);
      return response.data;
    } catch (cause) {
      const nextError = cause instanceof Error ? cause : new Error("Unable to preview resource leveling.");
      if (requestId === levelingRequestIdRef.current) {
        setLevelingPreview(null);
        setLevelingPreviewError(nextError);
      }
      throw nextError;
    } finally {
      if (requestId === levelingRequestIdRef.current) setIsLevelingPreviewLoading(false);
    }
  }, [projectId]);

  const replaceTaskAssignments = useCallback(async (
    taskId: string,
    assignments: ScheduleTaskAssignmentInput[],
    expectedAssignments: ScheduleTaskAssignmentExpectation[],
  ) => {
    const response = await apiFetch<{ data?: ScheduleTaskAssignment[] }>(
      `/api/projects/${projectId}/scheduling/tasks/${taskId}/assignments`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignments,
          expected_assignments: expectedAssignments,
        }),
      },
    );
    await refetch();
    clearLevelingPreview();
    return response.data ?? [];
  }, [clearLevelingPreview, projectId, refetch]);

  return {
    roster,
    isLoading,
    error,
    capacityRange,
    isCapacityRangeLoading,
    capacityRangeError,
    selectedCapacityProfile,
    isCapacityProfileLoading,
    capacityProfileError,
    levelingPreview,
    isLevelingPreviewLoading,
    levelingPreviewError,
    refetch,
    loadCapacityRange,
    fetchCapacityProfilesForRange,
    loadCapacityProfile,
    replaceCapacityProfile,
    previewResourceLeveling,
    clearLevelingPreview,
    replaceTaskAssignments,
  };
}
