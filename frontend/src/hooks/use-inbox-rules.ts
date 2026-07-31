"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api-client";
import type {
  InboxRuleAction,
  InboxRuleField,
  InboxRuleOperator,
} from "@/lib/email-assistant/inbox-rules";

export interface InboxRuleDto {
  id: string;
  field: InboxRuleField;
  operator: InboxRuleOperator;
  value: string;
  action: InboxRuleAction;
  actionValue: string | null;
  enabled: boolean;
  mailboxUserId: string;
  name: string | null;
  createdByEmail: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InboxRuleInput {
  name?: string | null;
  field: InboxRuleField;
  operator: InboxRuleOperator;
  value: string;
  action: InboxRuleAction;
  actionValue?: string | null;
  enabled?: boolean;
}

const RULES_KEY = ["outlook-inbox-rules"] as const;
const ENDPOINT = "/api/outlook-inbox-rules";

export function useInboxRules() {
  return useQuery<InboxRuleDto[]>({
    queryKey: RULES_KEY,
    queryFn: async ({ signal }) => {
      const data = await apiFetch<{ rules: InboxRuleDto[] }>(ENDPOINT, { signal });
      return data.rules;
    },
  });
}

export function useCreateInboxRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: InboxRuleInput) =>
      apiFetch<InboxRuleDto>(ENDPOINT, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: RULES_KEY });
    },
  });
}

export function useUpdateInboxRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: InboxRuleInput & { id: string }) =>
      apiFetch<InboxRuleDto>(`${ENDPOINT}/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: RULES_KEY });
    },
  });
}

export function useToggleInboxRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      apiFetch<InboxRuleDto>(`${ENDPOINT}/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ enabled }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: RULES_KEY });
    },
  });
}

export function useDeleteInboxRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ id: string; deleted: boolean }>(`${ENDPOINT}/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: RULES_KEY });
    },
  });
}
