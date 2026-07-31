import type { ScheduleTask, ScheduleTaskWithHierarchy } from "@/types/scheduling";

function findScheduleTask(
  tasks: ScheduleTaskWithHierarchy[],
  taskId: string,
): ScheduleTask | null {
  for (const task of tasks) {
    if (task.id === taskId) return task;
    const nestedTask = findScheduleTask(task.children ?? [], taskId);
    if (nestedTask) return nestedTask;
  }

  return null;
}

/**
 * Keeps an open editor aligned with a refetched schedule hierarchy after a
 * relationship mutation. If the task disappeared, preserve the snapshot so
 * the editor can report the next server response rather than silently closing.
 */
export function reconcileEditingTask(
  currentTask: ScheduleTask,
  refreshedTasks: ScheduleTaskWithHierarchy[],
): ScheduleTask {
  return findScheduleTask(refreshedTasks, currentTask.id) ?? currentTask;
}
