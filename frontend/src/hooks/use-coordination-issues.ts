"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";

export interface CoordinationIssueSummary {
  id: number;
  title: string;
  description: string | null;
  category: string;
  severity: string | null;
  status: string | null;
  created_at: string;
}

const issueKeys = {
  list: (projectId: string) => ["coordination-issues", projectId] as const,
};

export function useCoordinationIssues(projectId: string) {
  return useQuery<{ issues: CoordinationIssueSummary[] }>({
    queryKey: issueKeys.list(projectId),
    queryFn: () => apiFetch(`/api/projects/${projectId}/coordination-issues`),
    enabled: Boolean(projectId),
  });
}

export function useCreateCoordinationIssue() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, title, description }: { projectId: string; title: string; description?: string }) =>
      apiFetch<{ issue: CoordinationIssueSummary }>(`/api/projects/${projectId}/coordination-issues`, {
        method: "POST",
        body: JSON.stringify({ title, description, category: "Other", severity: "Medium" }),
      }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: issueKeys.list(variables.projectId) });
    },
  });
}
