import { tool } from "ai";
import { randomUUID } from "crypto";
import {
  createTaskDescription,
  createTaskInputSchema,
  createGeneratedTaskDescription,
  createGeneratedTaskInputSchema,
  updateGeneratedTaskDescription,
  updateGeneratedTaskInputSchema,
  deleteGeneratedTaskDescription,
  deleteGeneratedTaskInputSchema,
} from "@/lib/ai/tool-descriptors";
import { buildTaskFewShotBlock } from "@/lib/ai/services/task-training-service";
import {
  normalizeGeneratedTaskPriority,
  normalizeGeneratedTaskStatus,
} from "../action-tools";
import { type ActionToolInternals, withWriteTrace } from "./action-tool-internals";

export function createTaskWriteTools(internals: ActionToolInternals) {
  const {
    userId,
    options,
    supabase,
    resolveIdempotencyKey,
    getReplayResponse,
    recordWriteAudit,
    enforceProjectWriteAccess,
    resolveScheduleTaskAssignee,
    resolveGeneratedTaskAssignee,
    loadGeneratedTaskForWrite,
  } = internals;

  return {
    createTask: tool({
      description: createTaskDescription,
      inputSchema: createTaskInputSchema,
      execute: withWriteTrace("createTask", options, async (input) => {
        const { projectId, name, assignee, dueDate, notes, priority, confirmed } = input;
        const access = await enforceProjectWriteAccess(projectId);
        if (!access.ok) return { success: false, error: access.error };
        const resolvedAssignee = await resolveScheduleTaskAssignee(assignee);

        if (!confirmed) {
          let fewShotBlock = "";
          try {
            fewShotBlock = await buildTaskFewShotBlock(projectId);
          } catch (error) {
            options.onTrace?.({
              tool: "createTask",
              input: { projectId, name, confirmed: false },
              output: {
                warning: "Task training examples could not be loaded.",
                error: error instanceof Error ? error.message : String(error),
              },
              timestamp: new Date().toISOString(),
            });
          }

          return {
            action: "preview",
            message: `Here's the task I'll create. Reply **confirm** to proceed.${fewShotBlock}`,
            preview: {
              table: "schedule_tasks",
              fields: {
                project_id: projectId,
                name: notes ? `${name} — ${notes}` : name,
                status: "not_started",
                finish_date: dueDate ?? null,
                assignee: resolvedAssignee.assignee,
                assignee_person_id: resolvedAssignee.assigneePersonId,
                priority,
              },
            },
          };
        }

        const idempotencyKey = resolveIdempotencyKey("createTask", input);
        const replay = await getReplayResponse("createTask", idempotencyKey);
        if (replay) return replay;

        const { data, error } = await supabase
          .from("schedule_tasks")
          .insert({
            project_id: projectId,
            name: notes ? `${name} — ${notes}` : name,
            status: "not_started",
            percent_complete: 0,
            finish_date: dueDate ?? null,
            assignee: resolvedAssignee.assignee,
            assignee_person_id: resolvedAssignee.assigneePersonId,
            priority,
            updated_at: new Date().toISOString(),
          })
          .select("id, name, status")
          .single();

        if (error) {
          const failure = { success: false, error: error.message };
          await recordWriteAudit({
            toolName: "createTask",
            idempotencyKey,
            projectId: access.projectId,
            input,
            status: "error",
            response: failure,
          });
          return failure;
        }

        const response = {
          success: true,
          message: `Task **"${name}"** created${assignee ? ` — assigned to ${assignee}` : ""}.`,
          record: data,
        };
        await recordWriteAudit({
          toolName: "createTask",
          idempotencyKey,
          projectId: access.projectId,
          input,
          status: "success",
          response,
        });
        return response;
      }),
    }),

    createGeneratedTask: tool({
      description: createGeneratedTaskDescription,
      inputSchema: createGeneratedTaskInputSchema,
      execute: withWriteTrace("createGeneratedTask", options, async (input) => {
        const {
          projectId,
          scheduleTaskId,
          title,
          description,
          assignee,
          dueDate,
          priority,
          status,
          confirmed,
        } = input;
        const access = await enforceProjectWriteAccess(projectId);
        if (!access.ok) return { success: false, error: access.error };
        const effectiveProjectId = access.projectId;
        const resolvedAssignee = await resolveGeneratedTaskAssignee(assignee);
        const taskDescription = description?.trim() || title;
        const normalizedPriority = normalizeGeneratedTaskPriority(priority);
        const normalizedStatus = normalizeGeneratedTaskStatus(status);
        const shouldWriteTask =
          confirmed || options.generatedTaskWriteMode === "direct";

        if (!shouldWriteTask) {
          return {
            action: "preview",
            message:
              "Here's the task I'll add to the Tasks page. Reply **confirm** to proceed.",
            preview: {
              table: "tasks",
              fields: {
                project_id: effectiveProjectId,
                schedule_task_id: scheduleTaskId ?? null,
                title,
                description: taskDescription,
                status: normalizedStatus,
                due_date: dueDate ?? null,
                priority: normalizedPriority,
                assignee_name: resolvedAssignee.assigneeName,
                assignee_email: resolvedAssignee.assigneeEmail,
                assignee_person_id: resolvedAssignee.assigneePersonId,
                source_system: "ai_assistant",
              },
            },
          };
        }

        const auditInput =
          shouldWriteTask && !confirmed
            ? {
                ...input,
                confirmed: true,
                autoConfirmedBy: "teams_task_write_direct",
              }
            : input;
        const idempotencyKey = resolveIdempotencyKey(
          "createGeneratedTask",
          auditInput,
        );
        const replay = await getReplayResponse("createGeneratedTask", idempotencyKey);
        if (replay) return replay;

        const metadataId = randomUUID();
        const { data, error } = await supabase
          .rpc("create_ai_generated_task", {
            p_metadata_id: metadataId,
            p_title: title,
            p_description: taskDescription,
            p_status: normalizedStatus,
            p_due_date: dueDate,
            p_priority: normalizedPriority,
            p_project_id: effectiveProjectId ?? undefined,
            p_assignee_name: resolvedAssignee.assigneeName ?? undefined,
            p_assignee_email: resolvedAssignee.assigneeEmail ?? undefined,
            p_assignee_person_id: resolvedAssignee.assigneePersonId ?? undefined,
            p_user_id: userId,
            p_idempotency_key: idempotencyKey,
            p_schedule_task_id: scheduleTaskId ?? undefined,
          });

        if (error) {
          const failure = {
            success: false,
            error: error.message,
          };
          await recordWriteAudit({
            toolName: "createGeneratedTask",
            idempotencyKey,
            projectId: effectiveProjectId,
            input: auditInput,
            status: "error",
            response: failure,
          });
          return failure;
        }

        const response = {
          success: true,
          message: `Task **"${title}"** was added to the Tasks page.`,
          record: data,
          links: {
            tasksPage: effectiveProjectId ? `/${effectiveProjectId}/tasks?task=${data.id}` : `/tasks?task=${data.id}`,
          },
        };
	      await recordWriteAudit({
	        toolName: "createGeneratedTask",
	        idempotencyKey,
	        projectId: effectiveProjectId,
	        input: auditInput,
	        status: "success",
	        response,
	      });
        return response;
      }),
    }),

    updateGeneratedTask: tool({
      description: updateGeneratedTaskDescription,
      inputSchema: updateGeneratedTaskInputSchema,
      execute: withWriteTrace("updateGeneratedTask", options, async (input) => {
        const current = await loadGeneratedTaskForWrite(input.taskId);
        if (!current) return { success: false, error: "Task was not found in the Tasks table." };
        const access = await enforceProjectWriteAccess(current.project_id ?? undefined);
        if (!access.ok) return { success: false, error: access.error };

        const resolvedAssignee =
          input.assignee !== undefined
            ? await resolveGeneratedTaskAssignee(input.assignee)
            : null;
        const updates: Record<string, unknown> = {
          updated_at: new Date().toISOString(),
        };
        if (input.title !== undefined) updates.title = input.title;
        if (input.description !== undefined) updates.description = input.description;
        if (input.status !== undefined) updates.status = normalizeGeneratedTaskStatus(input.status);
        if (input.priority !== undefined) updates.priority = normalizeGeneratedTaskPriority(input.priority);
        if (input.dueDate !== undefined) updates.due_date = input.dueDate || null;
        if (resolvedAssignee) {
          updates.assignee_name = resolvedAssignee.assigneeName;
          updates.assignee_email = resolvedAssignee.assigneeEmail;
          updates.assignee_person_id = resolvedAssignee.assigneePersonId;
        }

        if (Object.keys(updates).length === 1) {
          return { success: false, error: "No task fields were provided to update." };
        }

        if (!input.confirmed) {
          return {
            action: "preview",
            message:
              "Here's the Tasks page item I'll update. Reply **confirm** to proceed.",
            preview: {
              table: "tasks",
              id: input.taskId,
              current,
              updates,
            },
          };
        }

        const idempotencyKey = resolveIdempotencyKey("updateGeneratedTask", input);
        const replay = await getReplayResponse("updateGeneratedTask", idempotencyKey);
        if (replay) return replay;

        const { data, error } = await supabase
          .from("tasks")
          .update(updates as never)
          .eq("id", input.taskId)
          .select("id,title,description,status,priority,due_date,project_id,assignee_name,assignee_email,updated_at")
          .single();

        if (error) {
          const failure = { success: false, error: error.message };
          await recordWriteAudit({
            toolName: "updateGeneratedTask",
            idempotencyKey,
            projectId: access.projectId,
            input,
            status: "error",
            response: failure,
          });
          return failure;
        }

        const response = {
          success: true,
          message: `Task **"${data.title ?? data.description}"** was updated.`,
          record: data,
        };
        await recordWriteAudit({
          toolName: "updateGeneratedTask",
          idempotencyKey,
          projectId: access.projectId,
          input,
          status: "success",
          response,
        });
        return response;
      }),
    }),

    deleteGeneratedTask: tool({
      description: deleteGeneratedTaskDescription,
      inputSchema: deleteGeneratedTaskInputSchema,
      execute: withWriteTrace("deleteGeneratedTask", options, async (input) => {
        const current = await loadGeneratedTaskForWrite(input.taskId);
        if (!current) return { success: false, error: "Task was not found in the Tasks table." };
        const access = await enforceProjectWriteAccess(current.project_id ?? undefined);
        if (!access.ok) return { success: false, error: access.error };

        if (!input.confirmed) {
          return {
            action: "preview",
            message:
              "Here's the Tasks page item I'll delete. Reply **confirm** to proceed.",
            preview: {
              table: "tasks",
              id: input.taskId,
              current,
              reason: input.reason ?? null,
            },
          };
        }

        const idempotencyKey = resolveIdempotencyKey("deleteGeneratedTask", input);
        const replay = await getReplayResponse("deleteGeneratedTask", idempotencyKey);
        if (replay) return replay;

        const { error } = await supabase.from("tasks").delete().eq("id", input.taskId);

        if (error) {
          const failure = { success: false, error: error.message };
          await recordWriteAudit({
            toolName: "deleteGeneratedTask",
            idempotencyKey,
            projectId: access.projectId,
            input,
            status: "error",
            response: failure,
          });
          return failure;
        }

        const response = {
          success: true,
          message: `Task **"${current.title ?? current.description}"** was deleted from the Tasks page.`,
          deletedTask: current,
          reason: input.reason ?? null,
        };
        await recordWriteAudit({
          toolName: "deleteGeneratedTask",
          idempotencyKey,
          projectId: access.projectId,
          input,
          status: "success",
          response,
        });
        return response;
      }),
    }),
  };
}
