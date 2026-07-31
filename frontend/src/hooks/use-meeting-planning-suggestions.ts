"use client";

import { useQuery } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api-client";

export type MeetingPlanningSuggestionKind =
  | "task"
  | "rfi"
  | "submittal"
  | "change_event"
  | "schedule"
  | "context";

export interface MeetingPlanningSuggestion {
  id: string;
  kind: MeetingPlanningSuggestionKind;
  title: string;
  description: string;
  href: string;
  sourceLabel: string;
  sourceContext?: string | null;
  priority?: "low" | "medium" | "high";
}

export interface MeetingPlanningRecap {
  id: string;
  title: string;
  date: string | null;
  summary: string;
  openThreads: string[];
  decisions: string[];
  href: string;
}

export interface MeetingPlanningSuggestionsPayload {
  suggestions: MeetingPlanningSuggestion[];
  meetingRecaps: MeetingPlanningRecap[];
  generatedBy: "ai" | "source" | "fallback";
  model?: string | null;
  fallbackReason?: string;
}

export type MeetingPlanningSuggestionMode = "source" | "ai";

export function useMeetingPlanningSuggestions(
  projectId: string,
  mode: MeetingPlanningSuggestionMode = "source",
) {
  return useQuery({
    queryKey: ["meeting-planning-suggestions", projectId, mode],
    queryFn: () => loadMeetingPlanningSuggestions(projectId, mode),
    enabled: Boolean(projectId),
    staleTime: 60_000,
    retry: false,
  });
}

async function loadMeetingPlanningSuggestions(
  projectId: string,
  mode: MeetingPlanningSuggestionMode,
): Promise<MeetingPlanningSuggestionsPayload> {
  try {
    return await apiFetch<MeetingPlanningSuggestionsPayload>(
      `/api/projects/${projectId}/meetings/prep-suggestions`,
      {
        method: "POST",
        body: JSON.stringify({ mode }),
      },
    );
  } catch {
    return {
      suggestions: [],
      meetingRecaps: [],
      generatedBy: "fallback",
      model: null,
      fallbackReason: "Meeting prep is unavailable. You can still create a blank agenda.",
    };
  }
}
