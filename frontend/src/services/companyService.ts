import type { createClient } from "@supabase/supabase-js";
import type { Database } from "../types/database.types";

type Tables = Database["public"]["Tables"];
type Company = Tables["companies"]["Row"];
type Person = Tables["people"]["Row"];

// Types for project-scoped company data
export interface ProjectCompany {
  id: string;
  project_id: number;
  company_id: string;
  business_phone: string | null;
  email_address: string | null;
  primary_contact_id: string | null;
  erp_vendor_id: string | null;
  company_type:
    | "YOUR_COMPANY"
    | "VENDOR"
    | "SUBCONTRACTOR"
    | "SUPPLIER"
    | "CONNECTED_COMPANY";
  status: "ACTIVE" | "INACTIVE";
  logo_url: string | null;
  created_at: string | null;
  updated_at: string | null;
  // Joined data - can be null when not joined
  company?: Company | null;
  primary_contact?: Person | null;
  user_count?: number | null;
}

function withBusinessPhone<T extends { company?: Company | null }>(
  row: T,
): T & { business_phone: string | null } {
  return {
    ...row,
    business_phone: row.company?.contact_phone ?? null,
  };
}

export interface CompanyListResponse {
  data: ProjectCompany[];
  pagination: {
    current_page: number;
    per_page: number;
    total: number;
    total_pages: number;
  };
}

export interface CompanyFilters {
  search?: string;
  status?: "ACTIVE" | "INACTIVE" | "all";
  company_type?: string;
  sort?: string;
  page?: number;
  per_page?: number;
}

export interface CompanyCreateDTO {
  name: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  website?: string;
  license_number?: string;
  business_phone?: string;
  email_address?: string;
  erp_vendor_id?: string;
  company_type?:
    | "YOUR_COMPANY"
    | "VENDOR"
    | "SUBCONTRACTOR"
    | "SUPPLIER"
    | "CONNECTED_COMPANY";
}

export interface CompanyUpdateDTO {
  name?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  website?: string;
  license_number?: string;
  business_phone?: string;
  email_address?: string;
  primary_contact_id?: string;
  erp_vendor_id?: string;
  company_type?:
    | "YOUR_COMPANY"
    | "VENDOR"
    | "SUBCONTRACTOR"
    | "SUPPLIER"
    | "CONNECTED_COMPANY";
  status?: "ACTIVE" | "INACTIVE";
  logo_url?: string;
}

export class CompanyService {
  constructor(private supabase: ReturnType<typeof createClient<Database>>) {}

  /**
   * Get paginated list of companies for a project
   */
  async getCompanies(
    projectId: string,
    filters: CompanyFilters = {},
  ): Promise<CompanyListResponse> {
    const {
      search,
      status = "ACTIVE",
      company_type,
      sort = "name",
      page = 1,
      per_page = 25,
    } = filters;

    const projectIdNum = Number.parseInt(projectId, 10);
    const offset = (page - 1) * per_page;

    // First, get the project companies with their base company data
    let query = this.supabase
      .from("project_companies")
      .select(
        `
        *,
        company:companies(*)
      `,
        { count: "exact" },
      )
      .eq("project_id", projectIdNum);

    // Apply status filter
    if (status !== "all") {
      query = query.eq("status", status);
    }

    // Apply company type filter
    if (company_type) {
      query = query.eq("company_type", company_type);
    }

    // Apply search across company name, email, and phone
    if (search) {
      const { data: matchingCompanies, error: companySearchError } =
        await this.supabase
          .from("companies")
          .select("id")
          .or(
            `name.ilike.%${search}%,contact_phone.ilike.%${search}%,contact_email.ilike.%${search}%`,
          );

      if (companySearchError) throw companySearchError;

      const matchingIds = (matchingCompanies || []).map((row) => row.id);
      const searchFilter = [
        matchingIds.length > 0
          ? `company_id.in.(${matchingIds.join(",")})`
          : null,
        `email_address.ilike.%${search}%`,
      ]
        .filter(Boolean)
        .join(",");

      query = query.or(searchFilter);
    }

    // Apply sorting
    const [sortField, sortDirection = "asc"] = sort.split(":");
    if (sortField === "name") {
      query = query.order("name", {
        ascending: sortDirection === "asc",
        foreignTable: "companies",
      });
    } else {
      query = query.order(sortField, { ascending: sortDirection === "asc" });
    }

    // Apply pagination
    query = query.range(offset, offset + per_page - 1);

    const { data, error, count } = await query;

    if (error) throw error;

    // Transform and add user counts
    const projectCompanies = (data || []) as ProjectCompany[];

    const companiesWithDetails = await Promise.all(
      projectCompanies.map(async (pc) => {
        const userCount = await this.getCompanyUserCount(
          projectIdNum,
          pc.company_id,
        );

        let primaryContact = null;
        const contactId =
          pc.primary_contact_id ?? pc.company?.primary_contact_id ?? null;
        if (contactId) {
          const { data: contact } = await this.supabase
            .from("people")
            .select("*")
            .eq("id", contactId)
            .single();
          primaryContact = contact;
        }

        return {
          ...withBusinessPhone(pc),
          primary_contact: primaryContact,
          user_count: userCount,
        } as ProjectCompany;
      }),
    );

    return {
      data: companiesWithDetails,
      pagination: {
        current_page: page,
        per_page,
        total: count || 0,
        total_pages: Math.ceil(
          (count || 0) / per_page,
        ),
      },
    };
  }

  /**
   * Get a single company with full details
   */
  async getCompany(
    projectId: string,
    companyId: string,
  ): Promise<ProjectCompany> {
    const projectIdNum = Number.parseInt(projectId, 10);

    // Get the project company with joined data
    const { data, error } = await this.supabase
      .from("project_companies")
      .select(
        `
        *,
        company:companies(*)
      `,
      )
      .eq("project_id", projectIdNum)
      .eq("id", companyId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        const notFoundError = new Error(
          `Company with ID ${companyId} not found.`,
        );
        (notFoundError as NodeJS.ErrnoException).code = "RESOURCE_NOT_FOUND";
        throw notFoundError;
      }
      throw error;
    }

    // Get primary contact if exists
    let primaryContact = null;
    if (data.primary_contact_id) {
      const { data: contact } = await this.supabase
        .from("people")
        .select("*")
        .eq("id", data.primary_contact_id)
        .single();
      primaryContact = contact;
    }

    // Get users for this company
    const users = await this.getCompanyUsers(projectId, data.company_id);
    const userCount = users.length;

    return {
      ...withBusinessPhone(data),
      primary_contact: primaryContact,
      user_count: userCount,
    } as ProjectCompany;
  }

  /**
   * Create a new company (both global company and project association)
   */
  async createCompany(
    projectId: string,
    data: CompanyCreateDTO,
  ): Promise<ProjectCompany> {
    const projectIdNum = Number.parseInt(projectId, 10);

    // First, create the global company record
    const { data: company, error: companyError } = await this.supabase
      .from("companies")
      .insert({
        name: data.name,
        address: data.address,
        city: data.city,
        state: data.state,
        contact_phone: data.business_phone,
        license_number: data.license_number,
        website: data.website,
      })
      .select()
      .single();

    if (companyError) throw companyError;

    // Then, create the project company association
     
    const { data: projectCompany, error: pcError } = await this.supabase
      .from("project_companies")
      .insert({
        project_id: projectIdNum,
        company_id: company.id,
        email_address: data.email_address,
        erp_vendor_id: data.erp_vendor_id,
        company_type: data.company_type || "VENDOR",
        status: "ACTIVE",
      })
      .select(
        `
        *,
        company:companies(*)
      `,
      )
      .single();

    if (pcError) throw pcError;

    return {
      ...withBusinessPhone(projectCompany),
      user_count: 0,
    } as ProjectCompany;
  }

  /**
   * Update a company
   */
  async updateCompany(
    projectId: string,
    companyId: string,
    data: CompanyUpdateDTO,
  ): Promise<ProjectCompany> {
    const projectIdNum = Number.parseInt(projectId, 10);

    // Update global company fields if provided
    const globalFields: Record<string, unknown> = {};
    if (data.name !== undefined) globalFields.name = data.name;
    if (data.address !== undefined) globalFields.address = data.address;
    if (data.city !== undefined) globalFields.city = data.city;
    if (data.state !== undefined) globalFields.state = data.state;
    if (data.zip !== undefined) globalFields.zip = data.zip;
    if (data.website !== undefined) globalFields.website = data.website;
    if (data.license_number !== undefined)
      globalFields.license_number = data.license_number;
    if (data.business_phone !== undefined)
      globalFields.contact_phone = data.business_phone;

    if (Object.keys(globalFields).length > 0) {
      // Get the company_id first
      const { data: pc } = await this.supabase
        .from("project_companies")
        .select("company_id")
        .eq("id", companyId)
        .single();

      if (pc) {
        const { error } = await this.supabase
          .from("companies")
          .update(globalFields)
          .eq("id", pc.company_id);

        if (error) throw error;
      }
    }

    // Update project-specific fields
    const projectFields: Record<string, unknown> = {};
    if (data.email_address !== undefined)
      projectFields.email_address = data.email_address;
    if (data.primary_contact_id !== undefined)
      projectFields.primary_contact_id = data.primary_contact_id;
    if (data.erp_vendor_id !== undefined)
      projectFields.erp_vendor_id = data.erp_vendor_id;
    if (data.company_type !== undefined)
      projectFields.company_type = data.company_type;
    if (data.status !== undefined) projectFields.status = data.status;
    if (data.logo_url !== undefined) projectFields.logo_url = data.logo_url;

    if (Object.keys(projectFields).length > 0) {
      const { error } = await this.supabase
        .from("project_companies")
        .update(projectFields)
        .eq("id", companyId)
        .eq("project_id", projectIdNum);

      if (error) throw error;
    }

    // Return updated company
    return this.getCompany(projectId, companyId);
  }

  /**
   * Get users for a company within a project
   */
  async getCompanyUsers(
    projectId: string,
    companyId: string,
  ): Promise<Person[]> {
    const projectIdNum = Number.parseInt(projectId, 10);

    const { data, error } = await this.supabase
      .from("people")
      .select(
        `
        *,
        project_directory_memberships!inner(*)
      `,
      )
      .eq("company_id", companyId)
      .eq("project_directory_memberships.project_id", projectIdNum)
      .eq("project_directory_memberships.status", "active");

    if (error) throw error;
    return data || [];
  }

  /**
   * Get count of users for a company within a project
   */
  private async getCompanyUserCount(
    projectId: number,
    companyId: string,
  ): Promise<number> {
    const { count, error } = await this.supabase
      .from("people")
      .select(
        `
        id,
        project_directory_memberships!inner(id)
      `,
        { count: "exact", head: true },
      )
      .eq("company_id", companyId)
      .eq("project_directory_memberships.project_id", projectId)
      .eq("project_directory_memberships.status", "active");

    if (error) {
      throw error;
    }
    return count || 0;
  }

  /**
   * Check if a company can be deleted (no users assigned)
   */
  async canDeleteCompany(
    projectId: string,
    companyId: string,
  ): Promise<{ canDelete: boolean; reason?: string }> {
    const userCount = await this.getCompanyUserCount(
      Number.parseInt(projectId, 10),
      companyId,
    );

    if (userCount > 0) {
      return {
        canDelete: false,
        reason: `Cannot delete company: ${userCount} users are still assigned to this company.`,
      };
    }

    return { canDelete: true };
  }

  /**
   * Check if a contact can be removed (not primary contact of their company)
   */
  async canRemoveContact(
    projectId: string,
    companyId: string,
    personId: string,
  ): Promise<{ canRemove: boolean; reason?: string }> {
    const projectIdNum = Number.parseInt(projectId, 10);

    const { data } = await this.supabase
      .from("project_companies")
      .select("primary_contact_id")
      .eq("project_id", projectIdNum)
      .eq("company_id", companyId)
      .single();

    if (data?.primary_contact_id === personId) {
      return {
        canRemove: false,
        reason: "Cannot remove the primary contact of a company.",
      };
    }

    return { canRemove: true };
  }

  /**
   * Set the primary contact for a company
   */
  async setPrimaryContact(
    projectId: string,
    companyId: string,
    personId: string,
  ): Promise<void> {
    const projectIdNum = Number.parseInt(projectId, 10);

    // Verify the person belongs to this company
    const { data: person } = await this.supabase
      .from("people")
      .select("company_id")
      .eq("id", personId)
      .single();

    // Get the project company to find the global company_id
    const { data: pc } = await this.supabase
      .from("project_companies")
      .select("company_id")
      .eq("id", companyId)
      .single();

    if (person?.company_id !== pc?.company_id) {
      throw new Error("Person does not belong to this company");
    }

    // Update primary contact
    const { error } = await this.supabase
      .from("project_companies")
      .update({ primary_contact_id: personId })
      .eq("id", companyId)
      .eq("project_id", projectIdNum);

    if (error) throw error;
  }
}
