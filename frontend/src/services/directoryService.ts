import { createClient } from "@supabase/supabase-js";
import type { Database } from "../types/database.types";

type Tables = Database["public"]["Tables"];
type Person = Tables["people"]["Row"];
type ProjectDirectoryMembership =
  Tables["project_directory_memberships"]["Row"];
type PermissionTemplate = Tables["permission_templates"]["Row"];
type Company = Tables["companies"]["Row"];
type PermissionAuditLog = Tables["permission_audit_log"]["Row"];

export interface UserActivityLog {
  id: string;
  project_id: number;
  person_id: string;
  action: string;
  action_description?: string | null;
  changes?: Record<string, unknown>;
  performed_by?: string | null;
  performed_at: string;
}


export interface DirectoryFilters {
  search?: string;
  type?: "user" | "contact" | "all";
  status?: "active" | "inactive" | "all";
  companyId?: string;
  permissionTemplateId?: string;
  groupBy?: "company" | "none";
  sortBy?: string[];
  page?: number;
  perPage?: number;
}

export interface PersonWithDetails extends Omit<Person, "company"> {
  company?: Company;
  membership?: ProjectDirectoryMembership;
  permission_template?: PermissionTemplate;
}

export interface DirectoryGroup {
  key: string;
  label: string;
  items: PersonWithDetails[];
}

export interface DirectoryResponse {
  data: PersonWithDetails[];
  groups?: DirectoryGroup[];
  meta: {
    total: number;
    page: number;
    perPage: number;
    totalPages: number;
  };
}

export interface PersonCreateDTO {
  first_name: string;
  last_name: string;
  email?: string;
  phone_mobile?: string;
  phone_business?: string;
  job_title?: string;
  company_id?: string;
  person_type: "user" | "contact";
  permission_template_id?: string;
}

export interface PersonUpdateDTO extends Partial<PersonCreateDTO> {
  status?: "active" | "inactive";
}

export class DirectoryService {
  constructor(private supabase: ReturnType<typeof createClient<Database>>) {}

  async getGlobalPeople(filters: {
    search?: string;
    type?: "user" | "contact" | "all";
    status?: "active" | "inactive" | "all";
    perPage?: number;
    page?: number;
  }): Promise<{
    data: Array<
      Pick<
        Person,
        | "id"
        | "first_name"
        | "last_name"
        | "email"
        | "job_title"
        | "phone_mobile"
        | "phone_business"
        | "person_type"
        | "status"
      > & { company: Pick<Company, "id" | "name"> | null }
    >;
    meta: {
      total: number;
      page: number;
      perPage: number;
      totalPages: number;
    };
  }> {
    const {
      search,
      type = "all",
      status = "active",
      perPage = 200,
      page = 1,
    } = filters;

    let query = this.supabase
      .from("people")
      .select(
        `
          id,
          first_name,
          last_name,
          email,
          job_title,
          phone_mobile,
          phone_business,
          person_type,
          status,
          company:companies!people_company_id_fkey(id, name)
        `,
        { count: "exact" },
      )
      .order("last_name", { ascending: true })
      .order("first_name", { ascending: true });

    if (type !== "all") {
      query = query.eq("person_type", type);
    }

    if (status !== "all") {
      query = query.eq("status", status);
    }

    if (search) {
      query = query.or(
        `first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`,
      );
    }

    const offset = (page - 1) * perPage;
    const { data, error, count } = await query.range(offset, offset + perPage - 1);

    if (error) throw error;

    return {
      data: data || [],
      meta: {
        total: count || 0,
        page,
        perPage,
        totalPages: Math.ceil((count || 0) / perPage),
      },
    };
  }

  async getPeople(
    projectId: string,
    filters: DirectoryFilters,
  ): Promise<DirectoryResponse> {
    const {
      search,
      type = "all",
      status = "active",
      companyId,
      permissionTemplateId,
      groupBy = "none",
      sortBy = ["company.name", "last_name", "first_name"],
      page = 1,
      perPage = 50,
    } = filters;

    const projectIdNum = Number.parseInt(projectId, 10);

    // Base query
    let query = this.supabase
      .from("people")
      .select(
        `
        *,
        company:companies!people_company_id_fkey(*),
        project_directory_memberships!inner(
          *,
          permission_template:permission_templates(*)
        )
      `,
        { count: "exact" },
      )
      .eq("project_directory_memberships.project_id", projectIdNum);

    // Apply filters
    if (type !== "all") {
      query = query.eq("person_type", type);
    }

    if (status !== "all") {
      query = query.eq("project_directory_memberships.status", status);
    }

    if (companyId) {
      query = query.eq("company_id", companyId);
    }

    if (permissionTemplateId) {
      query = query.eq(
        "project_directory_memberships.permission_template_id",
        permissionTemplateId,
      );
    }

    // Apply search
    if (search) {
      query = query.or(`
        first_name.ilike.%${search}%,
        last_name.ilike.%${search}%,
        email.ilike.%${search}%,
        phone_mobile.ilike.%${search}%,
        phone_business.ilike.%${search}%,
        company.name.ilike.%${search}%
      `);
    }

    // Apply sorting (excluding nested relations which can't be sorted directly)
    for (const sort of sortBy) {
      const [field, direction = "asc"] = sort.split(":");
      // Skip nested fields like 'company.name' - sort these client-side instead
      if (!field.includes(".")) {
        query = query.order(field, { ascending: direction === "asc" });
      }
    }

    // Apply pagination
    const offset = (page - 1) * perPage;
    query = query.range(offset, offset + perPage - 1);

    const { data, error, count } = await query;

    if (error) throw error;

    // Transform data
    const transformedData: PersonWithDetails[] = (data || []).map((person: any) => ({
      ...person,
      membership: person.project_directory_memberships?.[0],
      permission_template:
        person.project_directory_memberships?.[0]?.permission_template,
    }));

    // Apply client-side sorting for nested fields
    const nestedSorts = sortBy.filter((s) => s.includes("."));
    if (nestedSorts.length > 0) {
      transformedData.sort((a, b) => {
        for (const sort of nestedSorts) {
          const [field, direction = "asc"] = sort.split(":");
          const asc = direction === "asc" ? 1 : -1;

          // Handle company.name sorting
          if (field === "company.name") {
            const aName = a.company?.name || "";
            const bName = b.company?.name || "";
            const cmp = aName.localeCompare(bName);
            if (cmp !== 0) return cmp * asc;
          }
        }
        return 0;
      });
    }

    // Group if needed
    let groups: DirectoryGroup[] | undefined;
    if (groupBy === "company") {
      const groupMap = new Map<string, PersonWithDetails[]>();

      transformedData.forEach((person) => {
        const companyId = person.company?.id || "no-company";
        const companyName = person.company?.name || "No Company";

        if (!groupMap.has(companyId)) {
          groupMap.set(companyId, []);
        }
        groupMap.get(companyId)!.push(person);
      });

      groups = Array.from(groupMap.entries())
        .map(([key, items]) => ({
          key,
          label: items[0]?.company?.name || "No Company",
          items,
        }))
        .sort((a, b) => a.label.localeCompare(b.label));
    }

    return {
      data: transformedData,
      groups,
      meta: {
        total: count || 0,
        page,
        perPage,
        totalPages: Math.ceil((count || 0) / perPage),
      },
    };
  }

  async createPerson(
    projectId: string,
    data: PersonCreateDTO,
  ): Promise<PersonWithDetails> {
    const normalizedEmail = data.email?.trim().toLowerCase();
    if (normalizedEmail) {
      const { data: existingByEmail, error: existingError } = await this.supabase
        .from("people")
        .select("id")
        .ilike("email", normalizedEmail)
        .limit(1)
        .maybeSingle();

      if (existingError) throw existingError;

      if (existingByEmail?.id) {
        await this.addPersonToProject(projectId, {
          person_id: existingByEmail.id,
          permission_template_id: data.permission_template_id,
          person_type: data.person_type,
        });
        return this.getPerson(projectId, existingByEmail.id);
      }
    }

    const { data: person, error: personError } = await this.supabase
      .from("people")
      .insert({
        first_name: data.first_name,
        last_name: data.last_name,
        email: data.email,
        phone_mobile: data.phone_mobile,
        phone_business: data.phone_business,
        job_title: data.job_title,
        company_id: data.company_id,
        person_type: data.person_type,
      })
      .select()
      .single();

    if (personError) throw personError;

    const membership = await this.addPersonToProject(projectId, {
      person_id: person.id,
      permission_template_id: data.permission_template_id,
      person_type: data.person_type,
    });

    // Fetch company if exists
    let company = undefined;
    if (person.company_id) {
      const { data: companyData } = await this.supabase
        .from("companies")
        .select()
        .eq("id", person.company_id)
        .single();
      company = companyData ?? undefined;
    }

    return {
      ...person,
      company,
      membership,
      permission_template: membership.permission_template ?? undefined,
    };
  }

  async addPersonToProject(
    projectId: string,
    data: {
      person_id: string;
      permission_template_id?: string;
      person_type?: "user" | "contact";
    },
  ): Promise<
    ProjectDirectoryMembership & {
      permission_template?: PermissionTemplate | null;
    }
  > {
    const projectIdNum = Number.parseInt(projectId, 10);

    const { data: existing, error: existingError } = await this.supabase
      .from("project_directory_memberships")
      .select("*, permission_template:permission_templates(*)")
      .eq("project_id", projectIdNum)
      .eq("person_id", data.person_id)
      .maybeSingle();

    if (existingError) throw existingError;

    if (existing) {
      if (
        data.permission_template_id &&
        existing.permission_template_id !== data.permission_template_id
      ) {
        const { data: updated, error: updateError } = await this.supabase
          .from("project_directory_memberships")
          .update({
            permission_template_id: data.permission_template_id,
            status: "active",
          })
          .eq("id", existing.id)
          .select("*, permission_template:permission_templates(*)")
          .single();

        if (updateError) throw updateError;
        return updated;
      }

      if (existing.status !== "active") {
        const { data: reactivated, error: reactivateError } = await this.supabase
          .from("project_directory_memberships")
          .update({ status: "active" })
          .eq("id", existing.id)
          .select("*, permission_template:permission_templates(*)")
          .single();

        if (reactivateError) throw reactivateError;
        return reactivated;
      }

      return existing;
    }

    const { data: membership, error: membershipError } = await this.supabase
      .from("project_directory_memberships")
      .insert({
        project_id: projectIdNum,
        person_id: data.person_id,
        permission_template_id: data.permission_template_id,
        invite_status:
          data.person_type === "user" ? "not_invited" : "accepted",
      })
      .select("*, permission_template:permission_templates(*)")
      .single();

    if (membershipError) throw membershipError;
    return membership;
  }

  async updatePerson(
    projectId: string,
    personId: string,
    data: PersonUpdateDTO,
  ): Promise<PersonWithDetails> {
    const projectIdNum = Number.parseInt(projectId, 10);
    // Update person fields
    const personUpdate: any = {};
    const personFields = [
      "first_name",
      "last_name",
      "email",
      "phone_mobile",
      "phone_business",
      "job_title",
      "company_id",
    ];

    for (const field of personFields) {
      if (field in data) {
        personUpdate[field] = data[field as keyof PersonUpdateDTO];
      }
    }

    if (Object.keys(personUpdate).length > 0) {
      const { error } = await this.supabase
        .from("people")
        .update(personUpdate)
        .eq("id", personId);

      if (error) throw error;
    }

    // Update membership fields
    const membershipUpdate: any = {};
    if (data.permission_template_id !== undefined) {
      membershipUpdate.permission_template_id = data.permission_template_id;
    }
    if (data.status !== undefined) {
      membershipUpdate.status = data.status;
    }

    if (Object.keys(membershipUpdate).length > 0) {
      const { error } = await this.supabase
        .from("project_directory_memberships")
        .update(membershipUpdate)
        .eq("project_id", projectIdNum)
        .eq("person_id", personId);

      if (error) throw error;
    }

    // Return updated person
    return this.getPerson(projectId, personId);
  }

  async getPerson(
    projectId: string,
    personId: string,
  ): Promise<PersonWithDetails> {
    const projectIdNum = Number.parseInt(projectId, 10);

    const { data, error } = await this.supabase
      .from("people")
      .select(
        `
        *,
        company:companies!people_company_id_fkey(*),
        project_directory_memberships!inner(
          *,
          permission_template:permission_templates(*)
        )
      `,
      )
      .eq("id", personId)
      .eq("project_directory_memberships.project_id", projectIdNum)
      .single();

    if (error) throw error;

    const { project_directory_memberships, ...personData } = data;
    return {
      ...personData,
      membership: project_directory_memberships?.[0] ?? undefined,
      permission_template:
        project_directory_memberships?.[0]?.permission_template ?? undefined,
    } as PersonWithDetails;
  }

  async deactivatePerson(projectId: string, personId: string): Promise<void> {
    const projectIdNum = Number.parseInt(projectId, 10);

    const { error } = await this.supabase
      .from("project_directory_memberships")
      .update({ status: "inactive" })
      .eq("project_id", projectIdNum)
      .eq("person_id", personId);

    if (error) throw error;
  }

  async reactivatePerson(projectId: string, personId: string): Promise<void> {
    const projectIdNum = Number.parseInt(projectId, 10);

    const { error } = await this.supabase
      .from("project_directory_memberships")
      .update({ status: "active" })
      .eq("project_id", projectIdNum)
      .eq("person_id", personId);

    if (error) throw error;
  }

  async getCompanies(projectId: string): Promise<Company[]> {
    const { data, error } = await this.supabase
      .from("companies")
      .select("*")
      .order("name");

    if (error) throw error;
    return data || [];
  }

  async getPermissionTemplates(): Promise<PermissionTemplate[]> {
    const { data, error } = await this.supabase
      .from("permission_templates")
      .select("*")
      .eq("scope", "project")
      .order("name");

    if (error) throw error;
    return data || [];
  }

  async bulkAddUsers(
    projectId: string,
    users: PersonCreateDTO[],
  ): Promise<{
    created_count: number;
    failed_count: number;
    results: Array<{
      email: string;
      status: "success" | "error";
      user_id?: string;
      message: string;
    }>;
  }> {
    const projectIdNum = Number.parseInt(projectId, 10);
    const results: Array<{
      email: string;
      status: "success" | "error";
      user_id?: string;
      message: string;
    }> = [];
    let created_count = 0;
    let failed_count = 0;

    for (const userData of users) {
      try {
        const person = await this.createPerson(projectId, userData);
        results.push({
          email: userData.email || "",
          status: "success",
          user_id: person.id,
          message: "User added successfully",
        });
        created_count++;
      } catch (error) {
        results.push({
          email: userData.email || "",
          status: "error",
          message: error instanceof Error ? error.message : "an unexpected error occurred",
        });
        failed_count++;
      }
    }

    return { created_count, failed_count, results };
  }

  async resendInvite(
    projectId: string,
    personId: string,
  ): Promise<ProjectDirectoryMembership> {
    const projectIdNum = Number.parseInt(projectId, 10);

    // Generate new invite token (simple implementation - should use crypto.randomBytes in production)
    const invite_token = `invite_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const invite_expires_at = new Date();
    invite_expires_at.setDate(invite_expires_at.getDate() + 7); // 7 days expiry

    const { data, error } = await this.supabase
      .from("project_directory_memberships")
      .update({
        invite_token,
        invite_expires_at: invite_expires_at.toISOString(),
        invite_status: "invited",
        last_invited_at: new Date().toISOString(),
      })
      .eq("project_id", projectIdNum)
      .eq("person_id", personId)
      .select()
      .single();

    if (error) throw error;

    // Log activity
    await this.logActivity(
      projectId,
      personId,
      "invitation_resent",
      "User invitation resent",
      {},
      personId,
    );

    return data;
  }

  async logActivity(
    projectId: string,
    personId: string,
    action: string,
    description: string,
    changes: Record<string, unknown>,
    performedBy?: string,
  ): Promise<void> {
    const projectIdNum = Number.parseInt(projectId, 10);

    const { error } = await this.supabase
      .from("permission_audit_log")
      .insert({
        project_id: projectIdNum,
        person_id: personId,
        action,
        module:
          typeof changes.tool_name === "string"
            ? changes.tool_name
            : typeof changes.module === "string"
              ? changes.module
              : null,
        new_level:
          typeof changes.permission_type === "string"
            ? changes.permission_type
            : typeof changes.level === "string"
              ? changes.level
              : null,
        changed_by: performedBy || null,
      });

    if (error) {
      throw error;
    }
  }

  /**
   * Project-scoped permission read for a single person: their assigned
   * template's rules, any granular per-flag overrides on top of it, and the
   * merged "effective" result the app should actually enforce.
   */
  async getUserPermissions(
    projectId: string,
    personId: string,
  ): Promise<{
    override_permissions: Array<{ flag: string; effect: string }>;
    template_permissions: Record<string, unknown>;
    effective_permissions: Record<string, unknown>;
  }> {
    const projectIdNum = Number.parseInt(projectId, 10);

    const { data: membership } = await this.supabase
      .from("project_directory_memberships")
      .select("permission_template:permission_templates(rules_json)")
      .eq("project_id", projectIdNum)
      .eq("person_id", personId)
      .maybeSingle();

    const templatePermissions =
      (membership?.permission_template?.rules_json as Record<string, unknown> | null) ?? {};

    const { data: overrides, error } = await this.supabase
      .from("user_granular_permission_overrides")
      .select("flag, effect")
      .eq("person_id", personId)
      .eq("project_id", projectIdNum);

    if (error) throw error;

    const effectivePermissions: Record<string, unknown> = { ...templatePermissions };
    for (const override of overrides ?? []) {
      effectivePermissions[override.flag] = override.effect === "allow";
    }

    return {
      override_permissions: overrides ?? [],
      template_permissions: templatePermissions,
      effective_permissions: effectivePermissions,
    };
  }

  /**
   * Replaces a person's granular permission overrides for a project with the
   * given set. Template assignment is unaffected — this only manages the
   * per-flag exceptions layered on top of it.
   */
  async updateUserPermissions(
    projectId: string,
    personId: string,
    permissions: Array<{ flag: string; effect: string }>,
    updatedBy: string,
  ): Promise<void> {
    const projectIdNum = Number.parseInt(projectId, 10);

    const { error: deleteError } = await this.supabase
      .from("user_granular_permission_overrides")
      .delete()
      .eq("project_id", projectIdNum)
      .eq("person_id", personId);

    if (deleteError) throw deleteError;

    if (permissions.length === 0) return;

    const { error: insertError } = await this.supabase
      .from("user_granular_permission_overrides")
      .insert(
        permissions.map((permission) => ({
          project_id: projectIdNum,
          person_id: personId,
          flag: permission.flag,
          effect: permission.effect,
          updated_by: updatedBy,
        })),
      );

    if (insertError) throw insertError;
  }
}
