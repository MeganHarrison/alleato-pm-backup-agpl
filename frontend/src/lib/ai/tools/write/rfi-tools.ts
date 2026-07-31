import { tool } from "ai";
import {
  createRFIDescription,
  createRFIInputSchema,
  updateRFIStatusDescription,
  updateRFIStatusInputSchema,
} from "@/lib/ai/tool-descriptors";
import { type ActionToolInternals, withWriteTrace } from "./action-tool-internals";

export function createRfiWriteTools(internals: ActionToolInternals) {
  const {
    userId,
    options,
    supabase,
    resolveIdempotencyKey,
    getReplayResponse,
    recordWriteAudit,
    finalizeWriteAudit,
    failWriteAudit,
    enforceProjectWriteAccess,
  } = internals;

  return {
    createRFI: tool({
      description: createRFIDescription,
      inputSchema: createRFIInputSchema,
      execute: withWriteTrace("createRFI", options, async (input) => {
        const { projectId, subject, question, ballInCourt, dueDate, costImpact, scheduleImpact, confirmed } = input;
        const access = await enforceProjectWriteAccess(projectId);
        if (!access.ok) return { success: false, error: access.error };

        if (!confirmed) {
          return {
            action: "preview",
            message: "Here's the RFI I'll create. Reply **confirm** to proceed.",
            preview: {
              table: "rfis",
              fields: { project_id: projectId, subject, question, ball_in_court: ballInCourt, due_date: dueDate, cost_impact: costImpact, schedule_impact: scheduleImpact, status: "open", is_private: false },
            },
          };
        }

        const idempotencyKey = resolveIdempotencyKey("createRFI", input);
        const replay = await getReplayResponse("createRFI", idempotencyKey);
        if (replay) return replay;

        const pendingResponse = {
          success: false,
          status: "pending",
          message:
            "This approved RFI creation is already being processed.",
          idempotencyKey,
        };
        try {
          // Reserve the unique user/tool/idempotency tuple before touching
          // the RFI table. A replay or a worker restart can therefore return
          // the recorded state without issuing a second insert.
          await recordWriteAudit({
            toolName: "createRFI",
            idempotencyKey,
            projectId: access.projectId,
            input,
            status: "pending",
            response: pendingResponse,
          });
        } catch {
          const concurrentReplay = await getReplayResponse(
            "createRFI",
            idempotencyKey,
          );
          if (concurrentReplay) return concurrentReplay;
          throw new Error(
            "The approved RFI action could not reserve its idempotency receipt.",
          );
        }

        // Get next RFI number for this project
        const { data: existing } = await supabase
          .from("rfis")
          .select("number")
          .eq("project_id", projectId)
          .order("number", { ascending: false })
          .limit(1);
        const nextNumber = (existing?.[0]?.number ?? 0) + 1;

        const { data, error } = await supabase
          .from("rfis")
          .insert({
            project_id: projectId,
            created_by: userId,
            subject,
            question,
            ball_in_court: ballInCourt ?? null,
            due_date: dueDate ?? null,
            cost_impact: costImpact ?? "tbd",
            schedule_impact: scheduleImpact ?? "tbd",
            status: "open",
            is_private: false,
            number: nextNumber,
            updated_at: new Date().toISOString(),
          })
          .select("id, number, subject, status")
          .single();

        if (error) {
          const failure = { success: false, error: error.message };
          await failWriteAudit({
            toolName: "createRFI",
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
          message: `RFI #${data.number} — **"${subject}"** created.`,
          record: data,
        };
        await finalizeWriteAudit({
          toolName: "createRFI",
          idempotencyKey,
          response,
        });
        return response;
      }),
    }),

    updateRFIStatus: tool({
      description: updateRFIStatusDescription,
      inputSchema: updateRFIStatusInputSchema,
      execute: withWriteTrace("updateRFIStatus", options, async (input) => {
        const { rfiId, rfiNumber, projectId, newStatus, response, confirmed } = input;
        const access = await enforceProjectWriteAccess(projectId);
        if (!access.ok) return { success: false, error: access.error };

        if (!confirmed) {
          return {
            action: "preview",
            message: "I'll update this RFI status. Reply **confirm** to proceed.",
            preview: {
              table: "rfis",
              fields: { rfiId: rfiId ?? null, rfiNumber: rfiNumber ?? null, projectId, status: newStatus },
            },
          };
        }

        const idempotencyKey = resolveIdempotencyKey("updateRFIStatus", input);
        const replay = await getReplayResponse("updateRFIStatus", idempotencyKey);
        if (replay) return replay;

        let targetId = rfiId;
        if (!targetId && rfiNumber) {
          const { data } = await supabase
            .from("rfis")
            .select("id")
            .eq("project_id", projectId)
            .eq("number", rfiNumber)
            .single();
          targetId = data?.id;
        }

        if (!targetId) return { error: "Could not find RFI — provide rfiId or rfiNumber + projectId" };

        const updates: Record<string, unknown> = {
          status: newStatus,
          updated_at: new Date().toISOString(),
        };
        if (newStatus === "closed" || newStatus === "answered") {
          updates.closed_date = new Date().toISOString().split("T")[0];
        }

        const { data, error } = await supabase
          .from("rfis")
          .update(updates as never)
          .eq("id", targetId)
          .select("id, number, subject, status")
          .single();

        if (error) {
          const failure = { success: false, error: error.message };
          await recordWriteAudit({
            toolName: "updateRFIStatus",
            idempotencyKey,
            projectId: access.projectId,
            input,
            status: "error",
            response: failure,
          });
          return failure;
        }

        const successResponse = {
          success: true,
          message: `RFI #${data.number} — **"${data.subject}"** marked as ${newStatus}.`,
          record: data,
        };
        await recordWriteAudit({
          toolName: "updateRFIStatus",
          idempotencyKey,
          projectId: access.projectId,
          input,
          status: "success",
          response: successResponse,
        });
        return successResponse;
      }),
    }),
  };
}
