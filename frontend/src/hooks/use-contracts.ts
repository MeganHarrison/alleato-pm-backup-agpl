"use client";

import { createClient } from "@/lib/supabase/client";
import { useCallback, useEffect, useState } from "react";

export interface Contract {
  id: string;
  contract_number: string;
  client_id: string | null;
  project_id: number;
  status: string | null;
  original_contract_value: number;
  revised_contract_value: number;
  executed: boolean;
  description: string | null;
  title: string;
  created_at: string;
  // Joined data
  client?: {
    id: string;
    name: string | null;
  } | null;
  project?: {
    id: number;
    name: string | null;
    project_number: string | null;
  } | null;
}

export interface ContractOption {
  value: string;
  label: string;
  contractNumber?: string;
  amount?: number;
}

interface UseContractsOptions {
  // Filter contracts by search term
  search?: string;
  // Filter by status
  status?: "approved" | "draft" | "terminated" | "complete" | "out_for_signature";
  // Filter by project ID
  projectId?: number;
  // Filter by client ID
  clientId?: string;
  // Whether to include only executed contracts
  executedOnly?: boolean;
  // Limit number of results
  limit?: number;
  // Whether to auto-fetch on mount
  enabled?: boolean;
}

interface UseContractsReturn {
  contracts: Contract[];
  options: ContractOption[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  createContract: (contract: Partial<Contract>) => Promise<Contract | null>;
}

/**
 * Hook for fetching contracts from Supabase
 * Used in change order forms, invoice forms, etc.
 */
export function useContracts(
  options: UseContractsOptions = {},
): UseContractsReturn {
  const {
    search,
    status,
    projectId,
    clientId,
    executedOnly = false,
    limit = 100,
    enabled = true,
  } = options;
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchContracts = useCallback(async () => {
    if (!enabled) return;

    setIsLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      let query = supabase
        .from("prime_contracts")
        .select(
          `
          *,
          client:companies!prime_contracts_client_company_id_fkey(id, name),
          project:projects(id, name, project_number)
        `,
        )
        .order("contract_number", { ascending: true })
        .limit(limit);

      if (search) {
        query = query.or(
          `contract_number.ilike.%${search}%,notes.ilike.%${search}%`,
        );
      }

      if (status) {
        query = query.eq("status", status);
      }

      if (projectId) {
        query = query.eq("project_id", projectId);
      }

      if (clientId) {
        query = query.eq("client_id", clientId);
      }

      if (executedOnly) {
        query = query.eq("executed", true);
      }

      const { data, error: queryError } = await query;

      if (queryError) {
        throw new Error(queryError.message);
      }

      setContracts((data || []) as unknown as Contract[]);
    } catch (err) {
      setError(
        err instanceof Error ? err : new Error("Failed to fetch contracts"),
      );
    } finally {
      setIsLoading(false);
    }
  }, [search, status, projectId, clientId, executedOnly, limit, enabled]);

  useEffect(() => {
    fetchContracts();
  }, [fetchContracts]);

  const createContract = useCallback(
    async (contract: Partial<Contract>): Promise<Contract | null> => {
      try {
        const supabase = createClient();
        const { data, error: insertError } = await supabase
          .from("prime_contracts")
          .insert({
            contract_number: contract.contract_number || "DRAFT",
            client_id: contract.client_id || null,
            project_id: contract.project_id || 0,
            title: contract.title || contract.contract_number || "Untitled Contract",
            status: (contract.status as "draft" | "out_for_signature" | "approved" | "complete" | "terminated") || "draft",
            original_contract_value: contract.original_contract_value || 0,
            executed: contract.executed || false,
            description: contract.description || null,
          })
          .select(
            `
          *,
          client:companies!prime_contracts_client_company_id_fkey(id, name),
          project:projects(id, name, project_number)
        `,
          )
          .single();

        if (insertError) {
          throw new Error(insertError.message);
        }

        // Refetch to update the list
        await fetchContracts();
        return data as unknown as Contract;
      } catch (err) {
        setError(
          err instanceof Error ? err : new Error("Failed to create contract"),
        );
        return null;
      }
    },
    [fetchContracts],
  );

  // Transform contracts to options for dropdowns
  const contractOptions: ContractOption[] = contracts.map((contract) => {
    const projectInfo =
      contract.project?.project_number || contract.project?.name || "";
    const label = contract.contract_number
      ? `${contract.contract_number}${projectInfo ? ` - ${projectInfo}` : ""}`
      : `Contract #${contract.id}`;

    return {
      value: contract.id,
      label,
      contractNumber: contract.contract_number || undefined,
      amount: contract.original_contract_value || undefined,
    };
  });

  return {
    contracts,
    options: contractOptions,
    isLoading,
    error,
    refetch: fetchContracts,
    createContract,
  };
}
