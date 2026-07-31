"use client";

import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiError, apiFetch } from "@/lib/api-client";

// =============================================================================
// Types
// =============================================================================

export interface MeetingPrep {
  id: string;
  meeting_id: string;
  project_id: number | null;
  content: string;
  generated_by: string;
  model_used: string | null;
  generation_time_ms: number | null;
  version: number;
  created_at: string | null;
  updated_at: string | null;
}

interface MeetingPrepApiResponse {
  data: MeetingPrep | null;
}

// =============================================================================
// Query Keys
// =============================================================================

export const meetingPrepKeys = {
  all: ["meeting-preps"] as const,
  detail: (meetingId: string) => [...meetingPrepKeys.all, meetingId] as const,
};

// =============================================================================
// Get Meeting Prep
// =============================================================================

export function useMeetingPrep(projectId: string, meetingId: string) {
  return useQuery<MeetingPrepApiResponse>({
    queryKey: meetingPrepKeys.detail(meetingId),
    queryFn: async () => {
      try {
        return await apiFetch<MeetingPrepApiResponse>(
          `/api/projects/${projectId}/meetings/${meetingId}/prep`
        );
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          return { data: null };
        }
        throw error;
      }
    },
    enabled: !!projectId && !!meetingId,
    staleTime: 30 * 1000,
  });
}

// =============================================================================
// Save Meeting Prep (auto-save from editor)
// =============================================================================

export function useSaveMeetingPrep(projectId: string, meetingId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (content: string) =>
      apiFetch<MeetingPrepApiResponse>(
        `/api/projects/${projectId}/meetings/${meetingId}/prep`,
        {
          method: "PUT",
          body: JSON.stringify({ content }),
        }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: meetingPrepKeys.detail(meetingId),
      });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

// =============================================================================
// Generate Meeting Prep (AI)
// =============================================================================

export function useGenerateMeetingPrep(projectId: string, meetingId: string) {
  const queryClient = useQueryClient();

  return useMutation<MeetingPrepApiResponse>({
    mutationFn: async () =>
      apiFetch<MeetingPrepApiResponse>(
        `/api/projects/${projectId}/meetings/${meetingId}/prep/generate`,
        { method: "POST" }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: meetingPrepKeys.detail(meetingId),
      });
      toast.success("Meeting prep generated");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}
