"use client";

import { createClient } from "@/lib/supabase/client";
import { useCallback, useEffect, useState } from "react";

export interface AppUser {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone_business: string | null;
  phone_mobile: string | null;
  job_title: string | null;
  company_id: string | null;
  person_type: string;
  status: string | null;
  created_at: string | null;
  updated_at: string | null;
}

// Keep Employee as alias for backwards compatibility
export type Employee = AppUser;

export interface UserOption {
  value: string;
  label: string;
  email?: string;
  role?: string;
}

interface UseUsersOptions {
  search?: string;
  role?: string;
  limit?: number;
  enabled?: boolean;
  /** @deprecated source parameter is ignored — all users come from people table */
  source?: string;
  personType?: "user" | "contact" | "all";
}

interface UseUsersReturn {
  users: AppUser[];
  options: UserOption[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Hook for fetching users from the people table.
 * Replaces the old app_users/employees split.
 */
export function useUsers(options: UseUsersOptions = {}): UseUsersReturn {
  const {
    search,
    limit = 100,
    enabled = true,
    personType = "all",
  } = options;
  const [users, setUsers] = useState<AppUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchUsers = useCallback(async () => {
    if (!enabled) return;

    setIsLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      let query = supabase
        .from("people")
        .select("*")
        .order("last_name", { ascending: true })
        .limit(limit);

      if (personType !== "all") {
        query = query.eq("person_type", personType);
      }

      if (search) {
        query = query.or(
          `first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`,
        );
      }

      const { data, error: queryError } = await query;

      if (queryError) {
        throw new Error(queryError.message);
      }

      setUsers(data || []);
    } catch (err) {
      const detail = err instanceof Error ? err.message : "an unexpected error occurred";
      setError(new Error(`Could not load users: ${detail}`));
    } finally {
      setIsLoading(false);
    }
  }, [search, limit, enabled, personType]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const userOptions: UserOption[] = users.map((user) => {
    const fullName = [user.first_name, user.last_name]
      .filter(Boolean)
      .join(" ");
    return {
      value: user.id,
      label: fullName || user.email || "Unnamed User",
      email: user.email || undefined,
    };
  });

  return {
    users,
    options: userOptions,
    isLoading,
    error,
    refetch: fetchUsers,
  };
}

/**
 * Hook specifically for fetching employees (person_type = 'user')
 */
export function useEmployees(options: Omit<UseUsersOptions, "source" | "personType"> = {}) {
  return useUsers({ ...options, personType: "user" });
}
