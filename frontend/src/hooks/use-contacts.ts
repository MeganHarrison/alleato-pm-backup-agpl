"use client";

import { createClient } from "@/lib/supabase/client";
import { useCallback, useEffect, useState } from "react";

export interface Contact {
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
  notes: string | null;
  business_unit: string | null;
  profile_photo_url: string | null;
  created_at: string | null;
}

export interface ContactOption {
  value: string;
  label: string;
  email?: string;
}

interface UseContactsOptions {
  projectId?: string;
  search?: string;
  limit?: number;
  enabled?: boolean;
}

interface UseContactsReturn {
  contacts: Contact[];
  options: ContactOption[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  createContact: (contact: Partial<Contact>) => Promise<Contact | null>;
}

/**
 * Hook for fetching contacts from the people table (person_type = 'contact').
 * Replaces the old contacts table hook.
 */
export function useContacts(
  options: UseContactsOptions = {},
): UseContactsReturn {
  const { projectId, search, limit = 100, enabled = true } = options;
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchContacts = useCallback(async () => {
    if (!enabled) return;

    setIsLoading(true);
    setError(null);

    try {
      const supabase = createClient();

      if (projectId) {
        // Fetch contacts for a specific project via memberships
        let query = supabase
          .from("people")
          .select(`
            *,
            project_directory_memberships!inner(project_id)
          `)
          .eq("person_type", "contact")
          .eq("project_directory_memberships.project_id", parseInt(projectId, 10))
          .order("last_name", { ascending: true })
          .limit(limit);

        if (search) {
          query = query.or(
            `first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`,
          );
        }

        const { data, error: queryError } = await query;
        if (queryError) throw new Error(queryError.message);
        setContacts(data || []);
      } else {
        // Fetch all contacts globally
        let query = supabase
          .from("people")
          .select("*")
          .eq("person_type", "contact")
          .order("last_name", { ascending: true })
          .limit(limit);

        if (search) {
          query = query.or(
            `first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`,
          );
        }

        const { data, error: queryError } = await query;
        if (queryError) throw new Error(queryError.message);
        setContacts(data || []);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err : new Error("Failed to fetch contacts"),
      );
    } finally {
      setIsLoading(false);
    }
  }, [projectId, search, limit, enabled]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  const createContact = useCallback(
    async (contact: Partial<Contact>): Promise<Contact | null> => {
      try {
        const supabase = createClient();
        const { data, error: insertError } = await supabase
          .from("people")
          .insert({
            first_name: contact.first_name || "",
            last_name: contact.last_name || "",
            email: contact.email,
            phone_business: contact.phone_business,
            phone_mobile: contact.phone_mobile,
            job_title: contact.job_title,
            company_id: contact.company_id,
            person_type: "contact",
            status: "active",
            notes: contact.notes,
          })
          .select()
          .single();

        if (insertError) throw new Error(insertError.message);
        await fetchContacts();
        return data;
      } catch (err) {
        setError(
          err instanceof Error ? err : new Error("Failed to create contact"),
        );
        return null;
      }
    },
    [fetchContacts],
  );

  const contactOptions: ContactOption[] = contacts.map((contact) => {
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
    createContact,
  };
}
