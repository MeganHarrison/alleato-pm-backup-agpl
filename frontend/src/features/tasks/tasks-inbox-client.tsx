"use client";

import { TasksInbox } from "@/features/tasks/tasks-inbox";

interface TasksInboxClientProps {
  projectId: string;
  projectName: string | null;
}

export function TasksInboxClient({ projectId, projectName }: TasksInboxClientProps) {
  return <TasksInbox projectId={projectId} projectName={projectName} />;
}
