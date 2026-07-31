import { EstimatesClient } from "./estimates-client";
import { ErrorState } from "@/components/ds";
import { getProjectInfo } from "@/lib/supabase/project-fetcher";

export default async function ProjectEstimatesPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const { project, numericProjectId, supabase } = await getProjectInfo(projectId);

  const { data: estimates, error } = await supabase
    .from("estimates")
    .select("*")
    .eq("project_id", numericProjectId)
    .eq("is_deleted", false)
    .order("updated_at", { ascending: false });

  if (error) {
    return (
      <ErrorState error="Error loading estimates. Please try again later." />
    );
  }

  return (
    <EstimatesClient
      projectId={projectId}
      estimates={estimates || []}
      projectName={project.name ?? `Project ${projectId}`}
    />
  );
}
