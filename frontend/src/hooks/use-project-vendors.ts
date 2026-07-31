"use client";

import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/api-client";

export interface ProjectVendor {
  id: string;
  added_at: string;
  added_by: string | null;
  notes: string | null;
  companies: {
    id: string;
    name: string;
    legal_name: string | null;
    vendor_class: string | null;
    contact_name: string | null;
    contact_email: string | null;
    contact_phone: string | null;
    city: string | null;
    state: string | null;
    status: string | null;
    acumatica_vendor_id: string | null;
  } | null;
}

interface UseProjectVendorsResult {
  vendors: ProjectVendor[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  addVendor: (vendorId: string, notes?: string) => Promise<void>;
  removeVendor: (id: string) => Promise<void>;
}

export function useProjectVendors(projectId: string): UseProjectVendorsResult {
  const [vendors, setVendors] = useState<ProjectVendor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchVendors = useCallback(async () => {
    if (!projectId) return;
    setIsLoading(true);
    setError(null);
    try {
      const { data } = await apiFetch<{ data: ProjectVendor[] }>(
        `/api/projects/${projectId}/directory/vendors`,
      );
      setVendors(data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("an unexpected error occurred — please try again"));
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!projectId || cancelled) return;
      setIsLoading(true);
      setError(null);
      try {
        const { data } = await apiFetch<{ data: ProjectVendor[] }>(
          `/api/projects/${projectId}/directory/vendors`,
        );
        if (!cancelled) setVendors(data ?? []);
      } catch (err) {
        if (!cancelled)
          setError(err instanceof Error ? err : new Error("an unexpected error occurred — please try again"));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const addVendor = useCallback(
    async (vendorId: string, notes?: string) => {
      await apiFetch(`/api/projects/${projectId}/directory/vendors`, {
        method: "POST",
        body: JSON.stringify({ vendor_id: vendorId, notes }),
      });
      await fetchVendors();
    },
    [projectId, fetchVendors],
  );

  const removeVendor = useCallback(
    async (id: string) => {
      await apiFetch(
        `/api/projects/${projectId}/directory/vendors?id=${id}`,
        { method: "DELETE" },
      );
      await fetchVendors();
    },
    [projectId, fetchVendors],
  );

  return { vendors, isLoading, error, refetch: fetchVendors, addVendor, removeVendor };
}
