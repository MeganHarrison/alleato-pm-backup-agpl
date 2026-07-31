import type { createClient } from "@supabase/supabase-js";
import type { Database } from "../types/database.types";

type Tables = Database["public"]["Tables"];
type DistributionGroup = Tables["distribution_groups"]["Row"];
type Person = Tables["people"]["Row"];

export interface DistributionGroupWithMembers extends DistributionGroup {
  members?: Person[];
  member_count?: number;
}

export interface GroupCreateDTO {
  name: string;
  description?: string;
  member_ids?: string[];
}

export interface GroupUpdateDTO {
  name?: string;
  description?: string;
  status?: "active" | "inactive";
}

export interface BulkMemberOperation {
  add?: string[];
  remove?: string[];
}

export class DistributionGroupService {
  constructor(private supabase: ReturnType<typeof createClient<Database>>) {}

  async getGroups(
    projectId: string,
    includeMembers = false,
    status: "active" | "inactive" | "all" = "active",
  ): Promise<DistributionGroupWithMembers[]> {
    const projectIdNum = Number.parseInt(projectId, 10);

    let query = this.supabase
      .from("distribution_groups")
      .select("*", { count: "exact" })
      .eq("project_id", projectIdNum)
      .order("name");

    if (status !== "all") {
      query = query.eq("status", status);
    }

    const { data, error } = await query;
    if (error) throw error;

    if (!includeMembers) {
      return (data || []).map((group) => ({
        ...group,
        member_count: 0,
      }));
    }

    // Fetch members for each group separately
    const groupsWithMembers = await Promise.all(
      (data || []).map(async (group) => {
        const members = await this.getGroupMembers(group.id);
        return {
          ...group,
          members,
          member_count: members.length,
        };
      }),
    );

    return groupsWithMembers;
  }

  async getGroup(
    groupId: string,
    includeMembers = true,
  ): Promise<DistributionGroupWithMembers> {
    const { data, error } = await this.supabase
      .from("distribution_groups")
      .select("*")
      .eq("id", groupId)
      .single();

    if (error) throw error;

    if (!includeMembers) {
      return {
        ...data,
        member_count: 0,
      };
    }

    const members = await this.getGroupMembers(groupId);

    return {
      ...data,
      members,
      member_count: members.length,
    };
  }

  async createGroup(
    projectId: string,
    data: GroupCreateDTO,
  ): Promise<DistributionGroupWithMembers> {
    // Create the group
    const { data: group, error: groupError } = await this.supabase
      .from("distribution_groups")
      .insert({
        project_id: Number.parseInt(projectId, 10),
        name: data.name,
        description: data.description,
      })
      .select()
      .single();

    if (groupError) throw groupError;

    // Add members if provided
    if (data.member_ids && data.member_ids.length > 0) {
      const memberInserts = data.member_ids.map((personId) => ({
        group_id: group.id,
        person_id: personId,
      }));

      const { error: memberError } = await this.supabase
        .from("distribution_group_members")
        .insert(memberInserts);

      if (memberError) throw memberError;
    }

    // Return the created group with members
    return this.getGroup(group.id, true);
  }

  async updateGroup(
    groupId: string,
    data: GroupUpdateDTO,
  ): Promise<DistributionGroupWithMembers> {
    const { error } = await this.supabase
      .from("distribution_groups")
      .update(data)
      .eq("id", groupId);

    if (error) throw error;

    return this.getGroup(groupId, true);
  }

  async deleteGroup(groupId: string): Promise<void> {
    // Members will be cascade deleted due to foreign key constraint
    const { error } = await this.supabase
      .from("distribution_groups")
      .delete()
      .eq("id", groupId);

    if (error) throw error;
  }

  async addMembers(groupId: string, personIds: string[]): Promise<void> {
    if (personIds.length === 0) return;

    const memberInserts = personIds.map((personId) => ({
      group_id: groupId,
      person_id: personId,
    }));

    // Use upsert to handle duplicates gracefully
    const { error } = await this.supabase
      .from("distribution_group_members")
      .upsert(memberInserts, { onConflict: "group_id,person_id" });

    if (error) throw error;
  }

  async removeMembers(groupId: string, personIds: string[]): Promise<void> {
    if (personIds.length === 0) return;

    const { error } = await this.supabase
      .from("distribution_group_members")
      .delete()
      .eq("group_id", groupId)
      .in("person_id", personIds);

    if (error) throw error;
  }

  async updateMembers(
    groupId: string,
    operation: BulkMemberOperation,
  ): Promise<void> {
    // Remove members first
    if (operation.remove && operation.remove.length > 0) {
      await this.removeMembers(groupId, operation.remove);
    }

    // Then add new members
    if (operation.add && operation.add.length > 0) {
      await this.addMembers(groupId, operation.add);
    }
  }

  async getGroupMembers(groupId: string): Promise<Person[]> {
    const { data, error } = await this.supabase
      .from("distribution_group_members")
      .select("person:people(*)")
      .eq("group_id", groupId);

    if (error) throw error;

    return (data || []).map((m) => m.person).filter(Boolean);
  }

  async getPersonGroups(
    projectId: string,
    personId: string,
  ): Promise<DistributionGroup[]> {
    const projectIdNum = Number.parseInt(projectId, 10);

    const { data, error } = await this.supabase
      .from("distribution_groups")
      .select(
        `
        *,
        distribution_group_members!inner(person_id)
      `,
      )
      .eq("project_id", projectIdNum)
      .eq("distribution_group_members.person_id", personId)
      .eq("status", "active");

    if (error) throw error;

    return data || [];
  }

  async searchNonMembers(
    projectId: string,
    groupId: string,
    search?: string,
  ): Promise<Person[]> {
    const projectIdNum = Number.parseInt(projectId, 10);

    // Get all active people in the project who are not in the group
    let query = this.supabase
      .from("people")
      .select(
        `
        *,
        project_directory_memberships!inner(project_id, status)
      `,
      )
      .eq("project_directory_memberships.project_id", projectIdNum)
      .eq("project_directory_memberships.status", "active")
      .not(
        "id",
        "in",
        this.supabase
          .from("distribution_group_members")
          .select("person_id")
          .eq("group_id", groupId),
      );

    if (search) {
      query = query.or(`
        first_name.ilike.%${search}%,
        last_name.ilike.%${search}%,
        email.ilike.%${search}%
      `);
    }

    const { data, error } = await query.order("last_name").order("first_name");

    if (error) throw error;
    return data || [];
  }

  async cloneGroup(
    groupId: string,
    newName: string,
    includeMembers = true,
  ): Promise<DistributionGroupWithMembers> {
    // Get the original group
    const originalGroup = await this.getGroup(groupId, includeMembers);

    // Create new group
    const newGroupData: GroupCreateDTO = {
      name: newName,
      description: originalGroup.description || undefined,
      member_ids:
        includeMembers && originalGroup.members
          ? originalGroup.members.map((m) => m.id)
          : undefined,
    };

    return this.createGroup(originalGroup.project_id.toString(), newGroupData);
  }
}
