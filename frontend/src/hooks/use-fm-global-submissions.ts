"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api-client";
import type { FmGlobalSpecInput } from "@/types/fm-global";

const SUBMISSIONS_QUERY_KEY = ["fm-global-submissions"] as const;

export interface FmGlobalSubmissionContactInfo {
  name?: string | null;
  email?: string | null;
}

export interface FmGlobalSubmissionProjectDetails {
  project_name?: string | null;
  project_location?: string | null;
}

export interface FmGlobalSubmissionListItem {
  id: string;
  created_at: string | null;
  updated_at: string | null;
  contact_info: FmGlobalSubmissionContactInfo | null;
  project_details: FmGlobalSubmissionProjectDetails | null;
  user_input: FmGlobalSpecInput | null;
  matched_table_ids: string[] | null;
  lead_status: string | null;
  lead_score: number | null;
}

interface SubmissionsResponse {
  data: FmGlobalSubmissionListItem[];
}

export function useFmGlobalSubmissions() {
  return useQuery<SubmissionsResponse>({
    queryKey: SUBMISSIONS_QUERY_KEY,
    queryFn: ({ signal }) =>
      apiFetch<SubmissionsResponse>("/api/fm-global/submissions", { signal }),
  });
}

export function useDeleteFmGlobalSubmission() {
  const queryClient = useQueryClient();
  return useMutation<{ ok: true }, Error, string>({
    mutationFn: (submissionId) =>
      apiFetch<{ ok: true }>(`/api/fm-global/submissions/${submissionId}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: SUBMISSIONS_QUERY_KEY });
    },
  });
}
