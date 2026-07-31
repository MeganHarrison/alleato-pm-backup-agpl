import type { TasksRow } from "@/features/tasks/task-utils";
import { apiFetch } from "@/lib/api-client";
import type {
  PlaneHomeDailyLog,
  PlaneHomeMeeting,
  PlaneHomeProject,
} from "./plane-home-model";

interface HomeTabResponse<TKind extends string, TData> {
  kind: TKind;
  data: TData[];
}

export function loadPlaneHomeProject(
  projectId: string,
): Promise<PlaneHomeProject> {
  return apiFetch<PlaneHomeProject>(`/api/projects/${projectId}`);
}

export async function loadPlaneHomeTasks(
  projectId: string,
): Promise<TasksRow[]> {
  const response = await apiFetch<{ data?: TasksRow[] }>(
    `/api/tasks?project_id=${projectId}&scope=all`,
  );
  return response.data ?? [];
}

export async function loadPlaneHomeMeetings(
  projectId: string,
): Promise<PlaneHomeMeeting[]> {
  const response = await apiFetch<
    HomeTabResponse<"meetings", PlaneHomeMeeting>
  >(`/api/projects/${projectId}/home/tab-data?kind=meetings`);
  return response.data;
}

export async function loadPlaneHomeDailyLogs(
  projectId: string,
): Promise<PlaneHomeDailyLog[]> {
  const response = await apiFetch<
    HomeTabResponse<"daily-logs", PlaneHomeDailyLog>
  >(`/api/projects/${projectId}/home/tab-data?kind=daily-logs`);
  return response.data;
}

