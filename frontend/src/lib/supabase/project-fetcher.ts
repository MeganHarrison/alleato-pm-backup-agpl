import { createServiceClient } from "./service";
import { notFound } from "next/navigation";
import type { Database } from "@/types/database.types";

type Project = Database["public"]["Tables"]["projects"]["Row"];

/**
 * Fetches a project by ID from the URL params.
 *
 * This utility:
 * - Converts string projectId to number (required for the projects table)
 * - Uses the service client to bypass RLS (safe for server components)
 * - Calls notFound() if the project doesn't exist or ID is invalid
 *
 * @param projectId - The project ID from URL params (string)
 * @returns Object with project data, numeric projectId, and supabase client
 *
 * @example
 * ```tsx
 * export default async function ProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
 *   const { projectId } = await params
 *   const { project, numericProjectId, supabase } = await getProjectById(projectId)
 *
 *   // Now use numericProjectId for related queries
 *   const { data: tasks } = await supabase
 *     .from('tasks')
 *     .select('*')
 *     .contains('project_ids', [numericProjectId])
 * }
 * ```
 */
export async function getProjectById(projectId: string): Promise<{
  project: Project;
  numericProjectId: number;
  supabase: ReturnType<typeof createServiceClient>;
}> {
  const numericProjectId = parseInt(projectId, 10);

  if (isNaN(numericProjectId)) {
    notFound();
  }

  const supabase = createServiceClient();

  const { data: project, error } = await supabase
    .from("projects")
    .select("*")
    .eq("id", numericProjectId)
    .single();

  if (error || !project) {
    notFound();
  }

  return { project, numericProjectId, supabase };
}

/**
 * Fetches basic project info (name, client) for page headers.
 * Use this when you only need minimal project data.
 *
 * @param projectId - The project ID from URL params (string)
 * @returns Object with project info, numeric projectId, and supabase client
 */
export async function getProjectInfo(projectId: string): Promise<{
  project: Pick<Project, "id" | "name">;
  numericProjectId: number;
  supabase: ReturnType<typeof createServiceClient>;
}> {
  const numericProjectId = parseInt(projectId, 10);

  if (isNaN(numericProjectId)) {
    notFound();
  }

  const supabase = createServiceClient();

  const { data: project, error } = await supabase
    .from("projects")
    .select("id, name")
    .eq("id", numericProjectId)
    .single();

  if (error || !project) {
    notFound();
  }

  return { project, numericProjectId, supabase };
}

/**
 * Validates and converts a projectId string to a number.
 * Calls notFound() if invalid. Use this when you already have a supabase client.
 *
 * @param projectId - The project ID from URL params (string)
 * @returns The numeric project ID
 */
export function parseProjectId(projectId: string): number {
  const numericProjectId = parseInt(projectId, 10);

  if (isNaN(numericProjectId)) {
    notFound();
  }

  return numericProjectId;
}
