"use server";

import { serviceDb } from "@/lib/supabase/service-db";
import type { Database } from "@/types/database.types";

type MembershipInsert =
  Database["public"]["Tables"]["project_directory_memberships"]["Insert"];
type MembershipUpdate =
  Database["public"]["Tables"]["project_directory_memberships"]["Update"];

export async function addToProjectDirectory(entry: MembershipInsert) {

  const { data, error } = await serviceDb.from("project_directory_memberships")
    .insert(entry)
    .select(
      `
      *,
      person:people(*),
      project:projects(*)
    `,
    )
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function updateProjectDirectoryEntry(
  id: string,
  updates: MembershipUpdate,
) {

  const { data, error } = await serviceDb.from("project_directory_memberships")
    .update(updates)
    .eq("id", id)
    .select(
      `
      *,
      person:people(*),
      project:projects(*)
    `,
    )
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function deleteProjectDirectoryEntry(id: string) {

  const { error } = await serviceDb.from("project_directory_memberships")
    .delete()
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  return { success: true };
}

export async function getProjectDirectory(projectId: number) {

  const { data, error } = await serviceDb.from("project_directory_memberships")
    .select(
      `
      *,
      person:people(*),
      project:projects(*)
    `,
    )
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return data;
}
