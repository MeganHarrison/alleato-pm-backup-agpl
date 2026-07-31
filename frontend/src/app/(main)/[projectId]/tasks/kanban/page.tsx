export const dynamic = "force-dynamic";

import { notFound, redirect } from "next/navigation";

import { buildPlaneWorkItemsHref } from "@/features/plane-work-items-contracts/work-items-query";
import { parsePlaneProjectId } from "@/features/plane-work-items/plane-surface-access";

export default async function ProjectTasksKanbanPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const numericProjectId = parsePlaneProjectId(projectId);

  if (numericProjectId === null) {
    notFound();
  }

  redirect(buildPlaneWorkItemsHref(projectId, { view: "board" }));
}
