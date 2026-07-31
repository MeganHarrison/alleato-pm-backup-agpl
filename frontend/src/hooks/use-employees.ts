"use client";

import { useCallback, useEffect, useState } from "react";

import { createClient } from "@/lib/supabase/client";

export interface Employee {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  job_title: string | null;
}

export interface EmployeeOption {
  value: string;
  label: string;
  email?: string;
}

interface UseEmployeesOptions {
  search?: string;
  limit?: number;
  enabled?: boolean;
}

interface UseEmployeesReturn {
  employees: Employee[];
  options: EmployeeOption[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Fetches Alleato employees from the `people` table (`person_type = 'employee'`).
 *
 * Used for internal-owner fields like a purchase order's "Assigned To" — the
 * person on Alleato's side responsible for the PO. This is intentionally NOT the
 * project directory or a vendor's contacts (those are external parties).
 */
export function useEmployees(params: UseEmployeesOptions = {}): UseEmployeesReturn {
  const { search, limit = 200, enabled = true } = params;
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchEmployees = useCallback(async () => {
    if (!enabled) return;
    setIsLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      let query = supabase
        .from("people")
        .select("id, first_name, last_name, email, job_title")
        .eq("person_type", "employee")
        .order("last_name", { ascending: true })
        .order("first_name", { ascending: true })
        .limit(limit);

      if (search) {
        query = query.or(
          `first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`,
        );
      }

      const { data, error: queryError } = await query;
      if (queryError) throw new Error(queryError.message);
      setEmployees((data as Employee[]) || []);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to fetch employees"));
    } finally {
      setIsLoading(false);
    }
  }, [search, limit, enabled]);

  useEffect(() => {
    void fetchEmployees();
  }, [fetchEmployees]);

  const options: EmployeeOption[] = employees.map((employee) => {
    const fullName = [employee.first_name, employee.last_name].filter(Boolean).join(" ");
    return {
      value: employee.id,
      label: fullName || employee.email || "Unnamed Employee",
      email: employee.email || undefined,
    };
  });

  return { employees, options, isLoading, error, refetch: fetchEmployees };
}
