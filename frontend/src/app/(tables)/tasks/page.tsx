"use client";

import { PageShell } from "@/components/layout";
import { TasksInbox } from "@/features/tasks/tasks-inbox";

export default function TasksPage() {
  return (
    <PageShell
      variant="table"
      title="Tasks"
      showHeader={false}
      contentClassName="space-y-0 pt-0 pb-0"
      fillHeight
    >
      <TasksInbox />
    </PageShell>
  );
}
