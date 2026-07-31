export type TasksInboxContext = "crm" | undefined;
export type TasksInboxScope = "mine" | "all";

export function buildTasksListUrl(input: {
  scope: TasksInboxScope;
  projectId?: string | null;
  context?: TasksInboxContext;
}): string {
  const params = new URLSearchParams({ scope: input.scope });
  if (input.projectId) params.set("project_id", input.projectId);
  if (input.context) params.set("context", input.context);
  return `/api/tasks?${params.toString()}`;
}

export function taskMatchesContext(
  task: { company_id: string | null; crm_lead_id: string | null } | null,
  context?: TasksInboxContext,
): boolean {
  return context !== "crm" || Boolean(task?.company_id || task?.crm_lead_id);
}
