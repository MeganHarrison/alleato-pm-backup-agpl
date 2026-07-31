"use client";

import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database.types";

export type ProjectPage = Database["public"]["Tables"]["notes"]["Row"];

export type ProjectPageUpdate = Pick<ProjectPage, "title" | "body"> & {
  archived?: boolean;
};

function pageError(action: string, message: string): Error {
  return new Error(`Could not ${action} page: ${message}`);
}

export async function listProjectPages(projectId: number): Promise<ProjectPage[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("notes")
    .select("*")
    .eq("project_id", projectId)
    .order("updated_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false, nullsFirst: false });

  if (error) {
    throw pageError("load", error.message);
  }

  return data ?? [];
}

export async function createProjectPage(projectId: number): Promise<ProjectPage> {
  const supabase = createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    throw pageError("create", userError.message);
  }

  if (!user) {
    throw pageError("create", "your session has expired. Sign in and try again.");
  }

  const { data, error } = await supabase
    .from("notes")
    .insert({
      project_id: projectId,
      title: "Untitled",
      body: "",
      archived: false,
      created_by: user.id,
    })
    .select("*")
    .single();

  if (error) {
    throw pageError("create", error.message);
  }

  return data;
}

export async function updateProjectPage(
  projectId: number,
  pageId: number,
  values: Partial<ProjectPageUpdate>,
): Promise<ProjectPage> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("notes")
    .update({
      ...values,
      updated_at: new Date().toISOString(),
    })
    .eq("project_id", projectId)
    .eq("id", pageId)
    .select("*")
    .single();

  if (error) {
    throw pageError("save", error.message);
  }

  return data;
}
