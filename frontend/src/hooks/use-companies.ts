"use client";

import { useCallback, useEffect, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import type { Company } from "@/types/financial";

export interface CompanyOption {
  value: string;
  label: string;
}

interface UseCompaniesOptions {
  // Filter companies by search term
  search?: string;
  // Limit number of results
  limit?: number;
  // Whether to auto-fetch on mount
  enabled?: boolean;
}

interface UseCompaniesReturn {
  companies: Company[];
  options: CompanyOption[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  createCompany: (company: Partial<Company>) => Promise<Company | null>;
}

/**
 * Hook for fetching companies from Supabase
 * Used in contract forms, vendor selection, etc.
 */
export function useCompanies(
  options: UseCompaniesOptions = {},
): UseCompaniesReturn {
  const { search, limit = 1000, enabled = true } = options;
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchCompanies = useCallback(async () => {
    if (!enabled) return;

    setIsLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      let query = supabase
        .from("companies")
        .select("*")
        .order("name", { ascending: true })
        .limit(limit);

      if (search) {
        query = query.ilike("name", `%${search}%`);
      }

      const { data, error: queryError } = await query;

      if (queryError) {
        throw new Error(queryError.message);
      }

      setCompanies((data || []) as Company[]);
    } catch (err) {
      setError(
        err instanceof Error ? err : new Error("Failed to fetch companies"),
      );
    } finally {
      setIsLoading(false);
    }
  }, [search, limit, enabled]);

  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  // Companies are managed exclusively in Acumatica (ERP) by Accounting, so
  // insurance, EIN, and legal details stay accurate. Creating a company from
  // the PM app is disabled — records sync in automatically.
  const createCompany = useCallback(
    async (_company: Partial<Company>): Promise<Company | null> => {
      setError(
        new Error(
          "Companies are managed in Acumatica (ERP) by Accounting and can no longer be created here.",
        ),
      );
      return null;
    },
    [],
  );

  // Transform companies to options for dropdowns
  const companyOptions: CompanyOption[] = companies.map((company) => ({
    value: company.id,
    label: company.name,
  }));

  return {
    companies,
    options: companyOptions,
    isLoading,
    error,
    refetch: fetchCompanies,
    createCompany,
  };
}
