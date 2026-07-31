export const TASK_STATUS_VALUES = [
  "open",
  "in_progress",
  "blocked",
  "done",
  "cancelled",
] as const;

export const TASK_PRIORITY_VALUES = ["low", "medium", "high", "urgent"] as const;

export type TaskStatusValue = (typeof TASK_STATUS_VALUES)[number];
export type TaskPriorityValue = (typeof TASK_PRIORITY_VALUES)[number];
