"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";

interface Person {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  job_title: string | null;
  person_type: "user" | "contact" | "employee";
  company: { id: string; name: string } | null;
}

interface UsePeopleOptions {
  search?: string;
  /** "employee" resolves to person_type IN ('employee','user') in /api/people. */
  type?: "user" | "contact" | "employee" | "all";
}

export function usePeople(options: UsePeopleOptions = {}) {
  const { search, type } = options;

  const query = useQuery({
    queryKey: ["people", { search, type }],
    queryFn: async () => {
      const params = new URLSearchParams({ per_page: "500" });
      if (search) params.set("search", search);
      if (type) params.set("type", type);
      const res = await apiFetch<{ data: Person[] }>(`/api/people?${params}`);
      return res.data ?? [];
    },
    staleTime: 60_000,
  });

  return {
    people: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
  };
}
