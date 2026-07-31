import type { createClient } from "@supabase/supabase-js";
import type { Database } from "../types/database.types";

type Tables = Database["public"]["Tables"];
type PermissionTemplate = Tables["permission_templates"]["Row"];

export type Permission = "read" | "write" | "admin";
export type Module =
  | "directory"
  | "budget"
  | "contracts"
  | "documents"
  | "schedule"
  | "submittals"
  | "rfis"
  | "change_orders";

export interface PermissionRules {
  [module: string]: Permission[];
}

export interface UserPermissions {
  userId: string;
  projectId: string;
  template?: PermissionTemplate;
  rules: PermissionRules;
}

export class PermissionService {
  private cache: Map<string, UserPermissions> = new Map();
  private adminCache: Map<string, boolean> = new Map();

  constructor(private supabase: ReturnType<typeof createClient<Database>>) {}

  /**
   * Check if the user is an app-level admin (bypasses all permission checks).
   * Reads from user_profiles.is_admin.
   */
  async isAppAdmin(userId: string): Promise<boolean> {
    if (this.adminCache.has(userId)) {
      return this.adminCache.get(userId)!;
    }

    try {
      const { data } = await this.supabase
        .from("user_profiles")
        .select("is_admin")
        .eq("id", userId)
        .single();

      const isAdmin = data?.is_admin === true;
      this.adminCache.set(userId, isAdmin);
      setTimeout(() => this.adminCache.delete(userId), 5 * 60 * 1000);
      return isAdmin;
    } catch {
      return false;
    }
  }

  async getUserPermissions(
    userId: string,
    projectId: string,
  ): Promise<UserPermissions> {
    const projectIdNum = Number.parseInt(projectId, 10);
    const cacheKey = `${userId}:${projectId}`;

    // Check cache
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    try {
      // Get user's membership and permission template
      const { data: membership, error } = await this.supabase
        .from("project_directory_memberships")
        .select(
          `
          *,
          person:people!inner(
            *,
            users_auth!inner(auth_user_id)
          ),
          permission_template:permission_templates(*)
        `,
        )
        .eq("project_id", projectIdNum)
        .eq("person.users_auth.auth_user_id", userId)
        .eq("status", "active")
        .single();

      if (error || !membership) {
        // No permissions if not a member
        return {
          userId,
          projectId,
          rules: {},
        };
      }

      const template = membership.permission_template ?? undefined;
      const rules = (template?.rules_json as PermissionRules) || {};

      const permissions: UserPermissions = {
        userId,
        projectId,
        template,
        rules,
      };

      // Cache for 5 minutes
      this.cache.set(cacheKey, permissions);
      setTimeout(() => this.cache.delete(cacheKey), 5 * 60 * 1000);

      return permissions;
    } catch (error) {
      return {
        userId,
        projectId,
        rules: {},
      };
    }
  }

  async hasPermission(
    userId: string,
    projectId: string,
    module: Module,
    permission: Permission,
  ): Promise<boolean> {
    // App admins bypass all permission checks
    if (await this.isAppAdmin(userId)) {
      return true;
    }

    const userPermissions = await this.getUserPermissions(userId, projectId);
    const modulePermissions = userPermissions.rules[module] || [];

    // Admin permission includes all others
    if (modulePermissions.includes("admin")) {
      return true;
    }

    // Write permission includes read
    if (permission === "read" && modulePermissions.includes("write")) {
      return true;
    }

    return modulePermissions.includes(permission);
  }

  async requirePermission(
    userId: string,
    projectId: string,
    module: Module,
    permission: Permission,
  ): Promise<void> {
    const hasAccess = await this.hasPermission(
      userId,
      projectId,
      module,
      permission,
    );
    if (!hasAccess) {
      throw new Error(`Insufficient permissions: ${module}:${permission}`);
    }
  }

  async getPermissionTemplates(
    scope?: "project" | "company" | "global",
  ): Promise<PermissionTemplate[]> {
    let query = this.supabase
      .from("permission_templates")
      .select("*")
      .order("name");

    if (scope) {
      query = query.eq("scope", scope);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  }

  async createPermissionTemplate(
    name: string,
    description: string,
    rules: PermissionRules,
    scope: "project" | "company" | "global" = "project",
  ): Promise<PermissionTemplate> {
    const { data, error } = await this.supabase
      .from("permission_templates")
      .insert({
        name,
        description,
        scope,
        rules_json: rules,
        is_system: false,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updatePermissionTemplate(
    templateId: string,
    updates: {
      name?: string;
      description?: string;
      rules?: PermissionRules;
    },
  ): Promise<PermissionTemplate> {
    const updateData: Record<string, unknown> = {};
    if (updates.name) updateData.name = updates.name;
    if (updates.description) updateData.description = updates.description;
    if (updates.rules) updateData.rules_json = updates.rules;

    const { data, error } = await this.supabase
      .from("permission_templates")
      .update(updateData)
      .eq("id", templateId)
      .eq("is_system", false) // Prevent updating system templates
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async deletePermissionTemplate(templateId: string): Promise<void> {
    const { error } = await this.supabase
      .from("permission_templates")
      .delete()
      .eq("id", templateId)
      .eq("is_system", false); // Prevent deleting system templates

    if (error) throw error;
  }

  async assignPermissionTemplate(
    projectId: string,
    personId: string,
    templateId: string,
  ): Promise<void> {
    const projectIdNum = Number.parseInt(projectId, 10);

    const { error } = await this.supabase
      .from("project_directory_memberships")
      .update({ permission_template_id: templateId })
      .eq("project_id", projectIdNum)
      .eq("person_id", personId);

    if (error) throw error;

    // Clear cache for affected user
    this.clearUserCache(personId, projectId);
  }

  clearCache(): void {
    this.cache.clear();
  }

  clearUserCache(personId: string, projectId: string): void {
    // We need to find the auth user ID for this person
    // In production, you might want to maintain a reverse mapping
    for (const key of this.cache.keys()) {
      if (key.includes(`:${projectId}`)) {
        this.cache.delete(key);
      }
    }
  }

  // Helper method to check multiple permissions at once
  async hasAnyPermission(
    userId: string,
    projectId: string,
    checks: Array<{ module: Module; permission: Permission }>,
  ): Promise<boolean> {
    for (const check of checks) {
      if (
        await this.hasPermission(
          userId,
          projectId,
          check.module,
          check.permission,
        )
      ) {
        return true;
      }
    }
    return false;
  }

  // Helper method to get all user permissions for a project
  async getAllPermissions(
    userId: string,
    projectId: string,
  ): Promise<Map<Module, Permission[]>> {
    const userPermissions = await this.getUserPermissions(userId, projectId);
    const result = new Map<Module, Permission[]>();

    for (const [module, permissions] of Object.entries(userPermissions.rules)) {
      result.set(module as Module, permissions);
    }

    return result;
  }
}
