"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { apiFetch } from "@/lib/api-client";

export type BudgetRomMode = "latest_cost" | "latest_price" | "none";

export interface ChangeEventSettings {
  project_id: number;
  maintain_budget_codes_in_sync: boolean;
  display_revenue_rom_columns: boolean;
  display_unit_columns: boolean;
  allow_line_item_autopopulation: boolean;
  always_create_commitment_cos_using_latest_cost: boolean;
  copy_attachments_to_prime_pcos: boolean;
  copy_attachments_to_commitment_cos: boolean;
  budget_rom_in_scope: BudgetRomMode;
  budget_rom_out_of_scope: BudgetRomMode;
  budget_rom_tbd_scope: BudgetRomMode;
  prevent_budget_changes_and_prime_pcos_on_same_line_item: boolean;
  updated_at: string | null;
}

export type UpdateChangeEventSettingsInput = Partial<
  Omit<ChangeEventSettings, "project_id" | "updated_at">
>;

export const changeEventSettingsKeys = {
  all: ["change-event-settings"] as const,
  detail: (projectId: string | number) =>
    [...changeEventSettingsKeys.all, String(projectId)] as const,
};

export function useChangeEventSettings(projectId: string | number) {
  return useQuery<ChangeEventSettings>({
    queryKey: changeEventSettingsKeys.detail(projectId),
    queryFn: async () =>
      apiFetch<ChangeEventSettings>(
        `/api/projects/${projectId}/change-events/settings`,
      ),
    enabled: Boolean(projectId),
    staleTime: 30 * 1000,
  });
}

export function useUpdateChangeEventSettings(projectId: string | number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateChangeEventSettingsInput) =>
      apiFetch<ChangeEventSettings>(
        `/api/projects/${projectId}/change-events/settings`,
        {
          method: "PUT",
          body: JSON.stringify(input),
        },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: changeEventSettingsKeys.detail(projectId),
      });
      toast.success("Change event settings saved");
    },
    onError: (error: Error) => {
      toast.error("Could not save change event settings", {
        description: error.message,
      });
    },
  });
}
