import type { DependencyType, ScheduleDeadline, ScheduleDependency } from "@/types/scheduling";

type DependencyInput = {
  predecessor_task_id: string;
  dependency_type: DependencyType;
  lag_days: number;
};

type DependencyUpdateInput = Partial<DependencyInput>;

async function readApiError(response: Response, fallback: string): Promise<never> {
  const body = await response.json().catch(() => null) as { error?: string; error_message?: string } | null;
  throw new Error(body?.error ?? body?.error_message ?? fallback);
}

export async function createScheduleDependency(
  projectId: string,
  taskId: string,
  input: DependencyInput,
): Promise<ScheduleDependency> {
  const response = await fetch(`/api/projects/${projectId}/scheduling/tasks/${taskId}/dependencies`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) return readApiError(response, "Unable to add dependency.");
  const body = await response.json() as { data: ScheduleDependency };
  return body.data;
}

export async function removeScheduleDependency(
  projectId: string,
  taskId: string,
  dependencyId: string,
): Promise<void> {
  const response = await fetch(
    `/api/projects/${projectId}/scheduling/tasks/${taskId}/dependencies?dependencyId=${encodeURIComponent(dependencyId)}`,
    { method: "DELETE", credentials: "include" },
  );
  if (!response.ok) return readApiError(response, "Unable to remove dependency.");
}

export async function updateScheduleDependency(
  projectId: string,
  taskId: string,
  dependencyId: string,
  input: DependencyUpdateInput,
): Promise<ScheduleDependency> {
  const response = await fetch(
    `/api/projects/${projectId}/scheduling/tasks/${taskId}/dependencies?dependencyId=${encodeURIComponent(dependencyId)}`,
    {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );
  if (!response.ok) return readApiError(response, "Unable to update dependency.");
  const body = await response.json() as { data: ScheduleDependency };
  return body.data;
}

export async function saveScheduleDeadline(
  projectId: string,
  taskId: string,
  deadlineDate: string,
): Promise<ScheduleDeadline> {
  const response = await fetch(`/api/projects/${projectId}/scheduling/tasks/${taskId}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ intent: "deadline", deadline_date: deadlineDate }),
  });
  if (!response.ok) return readApiError(response, "Unable to update the schedule deadline.");
  const body = await response.json() as { data: ScheduleDeadline };
  return body.data;
}

export async function removeScheduleDeadline(
  projectId: string,
  taskId: string,
): Promise<void> {
  const response = await fetch(
    `/api/projects/${projectId}/scheduling/tasks/${taskId}`,
    {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ intent: "deadline", deadline_date: null }),
    },
  );
  if (!response.ok) return readApiError(response, "Unable to remove the schedule deadline.");
}
