"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export interface CompanyContact {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone_business: string | null;
  job_title: string | null;
  company_id: string | null;
  person_type?: string | null;
}

export interface CompanyContactOption {
  value: string;
  label: string;
  email?: string;
}

interface UseCompanyContactsOptions {
  /** Filter contacts assigned to this specific vendor (preferred) */
  vendorId?: string;
  /** Legacy: filter by company_id on the people table */
  companyId?: string;
  search?: string;
  limit?: number;
  enabled?: boolean;
}

interface UseCompanyContactsReturn {
  contacts: CompanyContact[];
  options: CompanyContactOption[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

function matchesSearch(contact: CompanyContact, search?: string): boolean {
  if (!search) return true;
  const term = search.trim().toLowerCase();
  if (!term) return true;

  return [
    contact.first_name,
    contact.last_name,
    contact.email,
    contact.job_title,
  ]
    .filter((value): value is string => Boolean(value))
    .some((value) => value.toLowerCase().includes(term));
}

function sortContacts(a: CompanyContact, b: CompanyContact): number {
  const aLast = (a.last_name || "").toLowerCase();
  const bLast = (b.last_name || "").toLowerCase();
  if (aLast !== bLast) return aLast.localeCompare(bLast);

  const aFirst = (a.first_name || "").toLowerCase();
  const bFirst = (b.first_name || "").toLowerCase();
  if (aFirst !== bFirst) return aFirst.localeCompare(bFirst);

  return (a.email || "").toLowerCase().localeCompare((b.email || "").toLowerCase());
}

/**
 * Hook for fetching contacts for a vendor or company.
 * For vendors, it merges explicit vendor assignments with contacts linked to the
 * vendor's backing company so directory contacts appear everywhere consistently.
 */
export function useCompanyContacts(
  options: UseCompanyContactsOptions = {},
): UseCompanyContactsReturn {
  const { vendorId, companyId, search, limit = 100, enabled = true } = options;
  const [contacts, setContacts] = useState<CompanyContact[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchContacts = useCallback(async () => {
    const hasFilter = !!vendorId || !!companyId;
    if (!enabled || !hasFilter) {
      setContacts([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const supabase = createClient();

      if (vendorId) {
        // After vendors→companies migration, vendorId IS the companyId
        const resolvedCompanyId = vendorId ?? companyId;

        // Fetch vendor_contacts links (non-fatal — failure still allows company contacts through)
        const { data: vcData } = await supabase
          .from("vendor_contacts")
          .select(
            "people!vendor_contacts_person_id_fkey(id, first_name, last_name, email, phone_business, job_title, company_id, person_type)",
          )
          .eq("company_id", vendorId)
          .limit(limit);

        const vendorLinkedPeople = (vcData || [])
          .map((row) => (row as Record<string, unknown>).people)
          .filter(Boolean) as CompanyContact[];

        // Always fetch all people directly on the company — this is the primary source
        let companyContacts: CompanyContact[] = [];
        if (resolvedCompanyId) {
          const { data: companyContactData, error: companyContactsError } = await supabase
            .from("people")
            .select(
              "id, first_name, last_name, email, phone_business, job_title, company_id, person_type",
            )
            .eq("company_id", resolvedCompanyId)
            .order("last_name", { ascending: true })
            .order("first_name", { ascending: true })
            .limit(limit);

          if (companyContactsError) throw new Error(companyContactsError.message);
          companyContacts = (companyContactData || []) as CompanyContact[];
        }

        const merged = new Map<string, CompanyContact>();

        for (const contact of [...vendorLinkedPeople, ...companyContacts]) {
          if (!contact?.id) continue;
          merged.set(contact.id, contact);
        }

        setContacts(
          Array.from(merged.values())
            .filter((contact) => matchesSearch(contact, search))
            .sort(sortContacts)
            .slice(0, limit),
        );
      } else if (companyId) {
        // Legacy: filter directly on people.company_id
        let query = supabase
          .from("people")
          .select(
            "id, first_name, last_name, email, phone_business, job_title, company_id, person_type",
          )
          .eq("company_id", companyId)
          .order("last_name", { ascending: true })
          .limit(limit);

        if (search) {
          query = query.or(
            `first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`,
          );
        }

        const { data, error: queryError } = await query;
        if (queryError) throw new Error(queryError.message);
        setContacts((data || []) as CompanyContact[]);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err
          : new Error("Failed to fetch company contacts"),
      );
    } finally {
      setIsLoading(false);
    }
  }, [vendorId, companyId, search, limit, enabled]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  const contactOptions: CompanyContactOption[] = contacts.map((contact) => {
    const fullName = [contact.first_name, contact.last_name]
      .filter(Boolean)
      .join(" ");
    return {
      value: contact.id,
      label: fullName || contact.email || "Unnamed Contact",
      email: contact.email || undefined,
    };
  });

  return {
    contacts,
    options: contactOptions,
    isLoading,
    error,
    refetch: fetchContacts,
  };
}
