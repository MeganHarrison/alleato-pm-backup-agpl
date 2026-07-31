import { tool } from "ai";
import { z } from "zod";
import { type ToolTracePayload, asNumber, resolveProject, withTrace as _withTrace } from "./tool-utils";
import { createToolContext, type ToolContext } from "./tool-context";

import { type AnyRow } from "./types";

type CreateScheduleToolsOptions = {
  onTrace?: (trace: ToolTracePayload) => void;
  pinnedProjectId?: number;
  // Injected data seam; defaults to building a real context when omitted.
  ctx?: ToolContext;
};

function withTrace<TInput extends Record<string, unknown>, TResult>(
  name: string,
  options: CreateScheduleToolsOptions,
  execute: (input: TInput) => Promise<TResult>,
) {
  return _withTrace(
    name,
    options,
    execute,
    "This operational knowledge source failed during retrieval. Explain the gap plainly and use other available sources before asking for more detail.",
  );
}

export function createScheduleTools(
  userId: string,
  options: CreateScheduleToolsOptions = {},
) {
  const ctx = options.ctx ?? createToolContext({ userId, pinnedProjectId: options.pinnedProjectId });
  const supabase = ctx.db;
  const guardrails = ctx.guardrails;

  return {
    getScheduleAnalysis: tool({
      description:
        "Analyze the project schedule: overdue tasks, milestones at risk, " +
        "critical path items, completion percentage, and task dependencies. " +
        "Use when asked about schedule, timeline, delays, milestones, " +
        "or task progress for a project.",
      inputSchema: z.object({
        projectId: z.number().optional().describe("Project ID if known"),
        projectName: z
          .string()
          .optional()
          .describe("Project name to search for"),
      }),
      execute: withTrace(
        "getScheduleAnalysis",
        options,
        async ({ projectId, projectName }) => {
          const resolved = await resolveProject(
            supabase,
            guardrails,
            projectId,
            projectName,
          );
          if ("error" in resolved) return resolved;

          const tasksRes = await supabase
            .from("schedule_tasks")
            .select("*")
            .eq("project_id", resolved.id)
            .order("start_date", { ascending: true })
            .limit(200);

          if (tasksRes.error) return { error: tasksRes.error.message };
          const tasks = (tasksRes.data ?? []) as AnyRow[];

          // schedule_dependencies has no project_id column, so
          // fetch deps scoped to the task IDs we already loaded
          const taskIds = tasks.map((t) => t.id as string);
          let deps: AnyRow[] = [];
          if (taskIds.length > 0) {
            const depsRes = await supabase
              .from("schedule_dependencies")
              .select("*")
              .in("task_id", taskIds)
              .limit(1000);
            if (depsRes.error) {
              // Non-fatal: proceed without dependency data rather than failing the whole tool
              console.error("[getScheduleAnalysis] deps query failed:", depsRes.error.message);
            } else {
              deps = (depsRes.data ?? []) as AnyRow[];
            }
          }
          const now = new Date().toISOString().split("T")[0];

          // Analytics
          const totalTasks = tasks.length;
          const completedTasks = tasks.filter(
            (t) =>
              t.status === "completed" || asNumber(t.percent_complete) >= 100,
          );
          const overdueTasks = tasks.filter(
            (t) =>
              t.finish_date &&
              (t.finish_date as string) < now &&
              t.status !== "completed" &&
              asNumber(t.percent_complete) < 100,
          );
          const milestones = tasks.filter((t) => t.is_milestone);
          const milestonesAtRisk = milestones.filter(
            (t) =>
              t.finish_date &&
              (t.finish_date as string) < now &&
              t.status !== "completed",
          );
          const upcomingMilestones = milestones
            .filter(
              (t) =>
                t.finish_date &&
                (t.finish_date as string) >= now &&
                t.status !== "completed",
            )
            .slice(0, 10);

          // Average completion
          const avgCompletion =
            totalTasks > 0
              ? Math.round(
                  tasks.reduce(
                    (sum, t) => sum + asNumber(t.percent_complete),
                    0,
                  ) / totalTasks,
                )
              : 0;

          // Tasks starting soon (next 14 days)
          const twoWeeksOut = new Date();
          twoWeeksOut.setDate(twoWeeksOut.getDate() + 14);
          const twoWeeksStr = twoWeeksOut.toISOString().split("T")[0];
          const upcomingTasks = tasks.filter(
            (t) =>
              t.start_date &&
              (t.start_date as string) >= now &&
              (t.start_date as string) <= twoWeeksStr &&
              t.status !== "completed",
          );

          // Dependency count per task (most dependencies = most critical)
          const depCountMap = new Map<number, number>();
          deps.forEach((d) => {
            const taskId = d.task_id as number;
            depCountMap.set(taskId, (depCountMap.get(taskId) ?? 0) + 1);
          });
          const criticalTasks = tasks
            .filter((t) => (depCountMap.get(t.id as number) ?? 0) > 0)
            .sort(
              (a, b) =>
                (depCountMap.get(b.id as number) ?? 0) -
                (depCountMap.get(a.id as number) ?? 0),
            )
            .slice(0, 10);

          return {
            project: { id: resolved.id, name: resolved.name },
            summary: {
              totalTasks,
              completedTasks: completedTasks.length,
              overdueTasks: overdueTasks.length,
              totalMilestones: milestones.length,
              milestonesAtRisk: milestonesAtRisk.length,
              avgCompletionPct: avgCompletion,
              totalDependencies: deps.length,
              upcomingTasksNext14Days: upcomingTasks.length,
            },
            overdueTasks: overdueTasks.slice(0, 15).map((t) => ({
              name: t.name,
              finishDate: t.finish_date,
              percentComplete: t.percent_complete,
              status: t.status,
              isMilestone: t.is_milestone,
              wbsCode: t.wbs_code,
            })),
            milestonesAtRisk: milestonesAtRisk.map((t) => ({
              name: t.name,
              finishDate: t.finish_date,
              percentComplete: t.percent_complete,
            })),
            upcomingMilestones: upcomingMilestones.map((t) => ({
              name: t.name,
              finishDate: t.finish_date,
              percentComplete: t.percent_complete,
            })),
            criticalPathItems: criticalTasks.map((t) => ({
              name: t.name,
              startDate: t.start_date,
              finishDate: t.finish_date,
              percentComplete: t.percent_complete,
              dependencyCount: depCountMap.get(t.id as number) ?? 0,
              status: t.status,
            })),
          };
        },
      ),
    }),
  };
}
