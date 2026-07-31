export const dynamic = "force-dynamic";

import { notFound, redirect } from "next/navigation";

import { PageShell } from "@/components/layout";

export default async function ProjectTasksKanbanPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const numericProjectId = Number.parseInt(projectId, 10);

  if (Number.isNaN(numericProjectId)) {
    notFound();
  }

  return (
    <PageShell
      variant="table"
      title="Tasks"
      description="Opening the canonical task board."
    >
      {redirect(`/${projectId}/tasks?view=board`)}
    </PageShell>
  );
}
