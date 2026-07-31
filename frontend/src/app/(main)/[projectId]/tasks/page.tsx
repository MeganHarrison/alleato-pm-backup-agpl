export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { PageShell } from "@/components/layout";
import { serviceDb } from "@/lib/supabase/service-db";
import { TasksInboxClient } from "@/features/tasks/tasks-inbox-client";
import { PlaneSurfaceDispatcher } from "@/features/plane-work-items/plane-surface-dispatcher";
import { parsePlaneProjectId } from "@/features/plane-work-items/plane-surface-access";

export default async function ProjectTasksPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{
    planeSurface?: string | string[];
  }>;
}) {
  const { projectId } = await params;
  const { planeSurface: planeSurfaceParam } = await searchParams;
  const planeSurface =
    typeof planeSurfaceParam === "string" ? planeSurfaceParam : null;
  const numericProjectId = planeSurface
    ? parsePlaneProjectId(projectId)
    : Number.parseInt(projectId, 10);

  if (numericProjectId === null || Number.isNaN(numericProjectId)) {
    notFound();
  }

  const { data: project, error } = await serviceDb
    .from("projects")
    .select("id, name")
    .eq("id", numericProjectId)
    .single();

  if (error || !project) {
    notFound();
  }

  if (planeSurface) {
    return (
      <PlaneSurfaceDispatcher
        projectId={projectId}
        projectName={project.name}
        planeSurface={planeSurface}
      />
    );
  }

  return (
    <PageShell
      variant="table"
      title="Tasks"
      showHeader={false}
      contentClassName="space-y-0 pt-0 pb-0"
      fillHeight
    >
      <TasksInboxClient projectId={projectId} projectName={project.name} />
    </PageShell>
  );
}
