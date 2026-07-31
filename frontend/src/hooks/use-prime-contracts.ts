"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { apiFetch, apiFetchWithTransientRouteRetry } from "@/lib/api-client";
import type { CreateContractInput, UpdateContractInput } from "@/app/api/projects/[projectId]/contracts/validation";
import {
  primeContractsSchema,
  type PrimeContract,
} from "@/lib/validation/prime-contracts";

// =============================================================================
// Query Keys
// =============================================================================

export const primeContractKeys = {
  all: (projectId: number) => ["prime-contracts", projectId] as const,
  list: (projectId: number, params?: Record<string, unknown>) =>
    [...primeContractKeys.all(projectId), "list", params] as const,
  detail: (projectId: number, contractId: string) =>
    [...primeContractKeys.all(projectId), contractId] as const,
};

// =============================================================================
// List Hook
// =============================================================================

export function usePrimeContracts(
  projectId: number,
  params?: { status?: string; search?: string },
) {
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.set("status", params.status);
  if (params?.search) searchParams.set("search", params.search);

  const queryString = searchParams.toString();
  const url = `/api/projects/${projectId}/contracts${queryString ? `?${queryString}` : ""}`;

  return useQuery<PrimeContract[]>({
    queryKey: primeContractKeys.list(projectId, params),
    queryFn: async () => {
      const payload = await apiFetchWithTransientRouteRetry<
        PrimeContract[] | { data: PrimeContract[] }
      >(url);

      const contracts = Array.isArray(payload) ? payload : payload.data;
      const parsed = primeContractsSchema.safeParse(contracts);
      if (!parsed.success) {
        throw new Error("Invalid prime contracts response format");
      }
      return parsed.data;
    },
    enabled: !!projectId,
  });
}

// =============================================================================
// Detail Hook
// =============================================================================

export function usePrimeContract(projectId: number, contractId: string) {
  return useQuery<PrimeContract>({
    queryKey: primeContractKeys.detail(projectId, contractId),
    queryFn: () =>
      apiFetchWithTransientRouteRetry<PrimeContract>(
        `/api/projects/${projectId}/contracts/${contractId}`,
      ),
    enabled: !!projectId && !!contractId,
  });
}

// =============================================================================
// Create Hook
// =============================================================================

export function useCreatePrimeContract(projectId: number) {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation<PrimeContract, Error, CreateContractInput>({
    mutationFn: (data) =>
      apiFetch<PrimeContract>(`/api/projects/${projectId}/contracts`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: (contract) => {
      queryClient.invalidateQueries({
        queryKey: primeContractKeys.all(projectId),
      });
      toast.success(`Contract "${contract.title}" created`);
      router.push(`/${projectId}/prime-contracts/${contract.id}`);
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "Failed to create contract";
      toast.error(message);
    },
  });
}

// =============================================================================
// Update Hook
// =============================================================================

export function useUpdatePrimeContract(projectId: number, contractId: string) {
  const queryClient = useQueryClient();

  return useMutation<PrimeContract, Error, UpdateContractInput>({
    mutationFn: (data) =>
      apiFetch<PrimeContract>(
        `/api/projects/${projectId}/contracts/${contractId}`,
        {
          method: "PUT",
          body: JSON.stringify(data),
        },
      ),
    onSuccess: (contract) => {
      queryClient.invalidateQueries({
        queryKey: primeContractKeys.all(projectId),
      });
      queryClient.setQueryData(
        primeContractKeys.detail(projectId, contractId),
        contract,
      );
      toast.success("Contract updated");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update contract");
    },
  });
}

// =============================================================================
// Delete Hook
// =============================================================================

export function useDeletePrimeContract(projectId: number) {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: (contractId) =>
      apiFetch<void>(
        `/api/projects/${projectId}/contracts/${contractId}`,
        { method: "DELETE" },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: primeContractKeys.all(projectId),
      });
      toast.success("Contract deleted");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to delete contract");
    },
  });
}
