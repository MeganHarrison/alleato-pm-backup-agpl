"use client";

import { useMutation } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api-client";
import type {
  TaskPriorityValue,
  TaskStatusValue,
} from "@/features/tasks/task-values";

export interface CreateTaskInput {
  /** Required. The task body. */
  description: string;
  /** Optional short heading. Server derives one from `description` when blank. */
  title?: string;
  /** projects.id (INTEGER). null / omitted → unassigned to a project. */
  project_id?: number | null;
  /** people.id of the assignee. Server resolves name/email from this. */
  assignee_person_id?: string | null;
  /** YYYY-MM-DD or null. */
  due_date?: string | null;
  priority?: TaskPriorityValue | null;
  status?: TaskStatusValue;
}

export interface CreatedTask {
  id: string;
  [key: string]: unknown;
}

/**
 * Creates a manual (ad-hoc) task via POST /api/tasks.
 *
 * The list on the Tasks page is held in local state, so the caller is
 * responsible for refreshing it in `onSuccess` (e.g. re-fetch). This hook only
 * owns the write + its pending/error state.
 */
export function useCreateTask() {
  return useMutation({
    mutationFn: (input: CreateTaskInput) =>
      apiFetch<{ task: CreatedTask }>("/api/tasks", {
        method: "POST",
        body: JSON.stringify(input),
      }),
  });
}
