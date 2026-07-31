import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-client";

export interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  job_title: string | null;
  person_type: string;
}

export interface InitiativeCard {
  id: string;
  title: string;
  description: string | null;
  status: "idea" | "planned" | "in_progress" | "done";
  priority: "urgent" | "high" | "medium" | "low";
  labels: string[] | null;
  sort_order: number;
  linked_record_type: string | null;
  linked_record_id: string | null;
  source: "manual" | "agentation" | "ai_chat" | "github";
  external_id: string | null;
  github_issue_url: string | null;
  assignee: string | null;
  assignee_id: string | null;
  due_date: string | null;
  dispatch_status: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

const QUERY_KEY = ["initiative-cards"];

export function useInitiativeCards() {
  return useQuery<InitiativeCard[]>({
    queryKey: QUERY_KEY,
    queryFn: ({ signal }) =>
      apiFetch<InitiativeCard[]>("/api/initiative-cards", { signal }),
  });
}

export function useEmployees() {
  return useQuery<Employee[]>({
    queryKey: ["employees"],
    queryFn: ({ signal }) => apiFetch<Employee[]>("/api/employees", { signal }),
    staleTime: 5 * 60 * 1000, // Cache for 5 min
  });
}

export function useCreateCard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (card: Partial<InitiativeCard>) =>
      apiFetch<InitiativeCard>("/api/initiative-cards", {
        method: "POST",
        body: JSON.stringify(card),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useUpdateCard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...updates
    }: Partial<InitiativeCard> & { id: string }) =>
      apiFetch<InitiativeCard>(`/api/initiative-cards/${id}`, {
        method: "PATCH",
        body: JSON.stringify(updates),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useDeleteCard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/initiative-cards/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useReorderCards() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (
      cards: { id: string; status: string; sort_order: number }[],
    ) =>
      apiFetch("/api/initiative-cards", {
        method: "PATCH",
        body: JSON.stringify({ cards }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useDispatchCard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (cardId: string) =>
      apiFetch<{
        success: boolean;
        prompt: string;
        cliCommand: string;
        message: string;
      }>(`/api/initiative-cards/${cardId}/dispatch`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}
