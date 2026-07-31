export const dynamic = "force-dynamic";

import { PageShell } from "@/components/layout";
import { TaskTrainingClient } from "./TaskTrainingClient";
import { getAllTaskFeedback } from "@/lib/ai/services/task-training-service";
import { requireAdmin } from "@/app/api/admin/_shared";

export default async function TaskTrainingPage() {
  await requireAdmin("task-training-page");

  const [goodFeedback, badFeedback] = await Promise.all([
    getAllTaskFeedback({ signal: "good", limit: 100 }),
    getAllTaskFeedback({ signal: "bad", limit: 100 }),
  ]);

  return (
    <PageShell variant="content" title="Task Training">
      <TaskTrainingClient goodFeedback={goodFeedback} badFeedback={badFeedback} />
    </PageShell>
  );
}
