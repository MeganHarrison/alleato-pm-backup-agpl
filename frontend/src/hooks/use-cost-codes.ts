"use client";

import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database.types";
import { useCallback, useEffect, useState } from "react";

type CostCodeRow = Database["public"]["Tables"]["cost_codes"]["Row"];

export interface CostCode {
  id: string;
  title: string | null;
  description: string | null;
  division_id: string;
  division_title: string | null;
  status: string | null;
  created_at: string;
}

export interface CostCodeOption {
  value: string;
  label: string;
  code: string;
  description: string;
}

interface UseCostCodesOptions {
  // Filter cost codes by search term
  search?: string;
  // Filter by status (active/inactive)
  status?: string;
  // Limit number of results
  limit?: number;
  // Whether to auto-fetch on mount
  enabled?: boolean;
}

interface UseCostCodesReturn {
  costCodes: CostCode[];
  options: CostCodeOption[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  createCostCode: (costCode: Partial<CostCode>) => Promise<CostCode | null>;
}

function mapCostCodeRow(row: CostCodeRow): CostCode {
  return {
    id: row.id,
    title: row.title,
    description: row.title,
    division_id: row.division_id,
    division_title: row.division_title,
    status: row.status,
    created_at: row.created_at ?? "",
  };
}

/**
 * Hook for fetching cost codes from Supabase.
 *
 * Empty results and query failures must remain visible to callers. Do not add
 * synthetic cost-code rows here: forms depend on real database IDs.
 */
export function useCostCodes(
  options: UseCostCodesOptions = {},
): UseCostCodesReturn {
  const {
    search,
    status,
    limit = 100,
    enabled = true,
  } = options;
  const [costCodes, setCostCodes] = useState<CostCode[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchCostCodes = useCallback(async () => {
    if (!enabled) return;

    setIsLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      let query = supabase
        .from("cost_codes")
        .select("*")
        .order("id", { ascending: true })
        .limit(limit);

      if (search) {
        query = query.or(`id.ilike.%${search}%,description.ilike.%${search}%`);
      }

      if (status) {
        query = query.eq("status", status);
      }

      const { data, error: queryError } = await query;

      if (queryError) {
        throw new Error(queryError.message);
      }

      setCostCodes((data || []).map(mapCostCodeRow));
    } catch (err) {
      setError(
        err instanceof Error ? err : new Error("Failed to fetch cost codes"),
      );
      setCostCodes([]);
    } finally {
      setIsLoading(false);
    }
  }, [search, status, limit, enabled]);

  useEffect(() => {
    fetchCostCodes();
  }, [fetchCostCodes]);

  const createCostCode = useCallback(
    async (costCode: Partial<CostCode>): Promise<CostCode | null> => {
      try {
        const supabase = createClient();
        const { data, error: insertError } = await supabase
          .from("cost_codes")
          .insert({
            id: costCode.id || "",
            title: costCode.title || costCode.description,
            division_id: costCode.division_id || "",
            division_title: costCode.division_title,
            status: costCode.status || "active",
          })
          .select()
          .single();

        if (insertError) {
          throw new Error(insertError.message);
        }

        // Refetch to update the list
        await fetchCostCodes();
        return mapCostCodeRow(data);
      } catch (err) {
        setError(
          err instanceof Error ? err : new Error("Failed to create cost code"),
        );
        return null;
      }
    },
    [fetchCostCodes],
  );

  // Transform cost codes to options for dropdowns.
  // Deduplicate by id and filter out any records with a falsy id — duplicate or
  // empty ids would produce identical `key` props and trigger React's
  // "Encountered two children with the same key" warning.
  const seen = new Set<string>();
  const costCodeOptions: CostCodeOption[] = costCodes
    .filter((code) => {
      if (!code.id) return false;
      if (seen.has(code.id)) return false;
      seen.add(code.id);
      return true;
    })
    .map((code) => ({
      value: code.id,
      label: `${code.id} - ${code.title || code.description || "No Description"}`,
      code: code.id,
      description: code.title || code.description || "",
    }));

  return {
    costCodes,
    options: costCodeOptions,
    isLoading,
    error,
    refetch: fetchCostCodes,
    createCostCode,
  };
}
