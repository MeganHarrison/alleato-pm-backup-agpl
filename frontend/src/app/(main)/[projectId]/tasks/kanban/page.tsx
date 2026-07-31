export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { PageShell } from "@/components/layout";
import { TasksKanbanPage } from "@/features/tasks/tasks-kanban-page";

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
      variant="dashboard"
      title="Task Kanban"
      description="Drag cards between statuses. Moves save immediately."
      actions={
        <Button asChild variant="outline" size="sm">
          <Link href={`/${projectId}/tasks`}>Task inbox</Link>
        </Button>
      }
      contentClassName="space-y-4"
    >
      <TasksKanbanPage projectId={projectId} />
    </PageShell>
  );
}
