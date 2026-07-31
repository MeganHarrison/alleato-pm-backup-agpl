export const dynamic = "force-dynamic";

import { notFound, redirect } from "next/navigation";
import { serviceDb } from "@/lib/supabase/service-db";
import { PlaneSurfaceDispatcher } from "@/features/plane-work-items/plane-surface-dispatcher";
import { parsePlaneProjectId } from "@/features/plane-work-items/plane-surface-access";
import { buildPlaneWorkItemsHrefFromLegacyTasks } from "@/features/plane-work-items-contracts/work-items-query";

type RouteSearchParams = Record<string, string | string[] | undefined>;

function toUrlSearchParams(searchParams: RouteSearchParams): URLSearchParams {
  const params = new URLSearchParams();

  for (const [key, rawValue] of Object.entries(searchParams)) {
    const values = Array.isArray(rawValue) ? rawValue : [rawValue];
    for (const value of values) {
      if (value !== undefined) params.append(key, value);
    }
  }

  return params;
}

export default async function ProjectTasksPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<RouteSearchParams>;
}) {
  const { projectId } = await params;
  const resolvedSearchParams = await searchParams;
  const planeSurfaceParam = resolvedSearchParams.planeSurface;
  const planeSurface =
    typeof planeSurfaceParam === "string" ? planeSurfaceParam : null;
  const numericProjectId = parsePlaneProjectId(projectId);

  if (numericProjectId === null) {
    notFound();
  }

  if (!planeSurface) {
    redirect(
      buildPlaneWorkItemsHrefFromLegacyTasks(
        projectId,
        toUrlSearchParams(resolvedSearchParams),
      ),
    );
  }

  const { data: project, error } = await serviceDb
    .from("projects")
    .select("id, name")
    .eq("id", numericProjectId)
    .single();

  if (error || !project) {
    notFound();
  }

  return (
    <PlaneSurfaceDispatcher
      projectId={projectId}
      projectName={project.name}
      planeSurface={planeSurface}
    />
  );
}
