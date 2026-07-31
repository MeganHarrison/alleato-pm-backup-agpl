import { tool } from "ai";
import {
  createSubmittalDescription,
  createSubmittalInputSchema,
} from "@/lib/ai/tool-descriptors";
import { type ActionToolInternals, withWriteTrace } from "./action-tool-internals";

export function createSubmittalWriteTools(internals: ActionToolInternals) {
  const {
    userId,
    options,
    supabase,
    resolveIdempotencyKey,
    getReplayResponse,
    recordWriteAudit,
    enforceProjectWriteAccess,
  } = internals;

  return {
    createSubmittal: tool({
      description: createSubmittalDescription,
      inputSchema: createSubmittalInputSchema,
      execute: withWriteTrace("createSubmittal", options, async (input) => {
        const { projectId, title, specSection, dueDate, submittedBy, status, confirmed } = input;
        const access = await enforceProjectWriteAccess(projectId);
        if (!access.ok) return { success: false, error: access.error };

        if (!confirmed) {
          return {
            action: "preview",
            message: "Here's the submittal I'll create. Reply **confirm** to proceed.",
            preview: {
              table: "submittals",
              fields: { project_id: projectId, title, specification_section: specSection ?? null, final_due_date: dueDate ?? null, submitter_company: submittedBy, status },
            },
          };
        }

        const idempotencyKey = resolveIdempotencyKey("createSubmittal", input);
        const replay = await getReplayResponse("createSubmittal", idempotencyKey);
        if (replay) return replay;

        // Get next submittal number for this project
        const { data: existing } = await supabase
          .from("submittals")
          .select("submittal_number")
          .eq("project_id", projectId)
          .order("created_at", { ascending: false })
          .limit(1);

        const lastNum = existing?.[0]?.submittal_number ?? "000";
        const nextNumber = String(parseInt(String(lastNum).replace(/\D/g, "") || "0") + 1).padStart(3, "0");

        const { data, error } = await supabase
          .from("submittals")
          .insert({
            project_id: projectId,
            title,
            specification_section: specSection ?? null,
            final_due_date: dueDate ?? null,
            // submitted_by is a NOT NULL uuid FK to the authenticated user.
            // The free-text "submittedBy" (subcontractor / party submitting)
            // belongs in submitter_company, not this column.
            submitted_by: userId,
            submitter_company:
              submittedBy && submittedBy.trim() && submittedBy.trim().toUpperCase() !== "TBD"
                ? submittedBy.trim()
                : null,
            created_by: userId,
            status,
            submittal_number: nextNumber,
            revision: 0,
            is_private: false,
            updated_at: new Date().toISOString(),
          })
          .select("id, title, submittal_number, status")
          .single();

        if (error) {
          const failure = { success: false, error: error.message };
          await recordWriteAudit({
            toolName: "createSubmittal",
            idempotencyKey,
            projectId: access.projectId,
            input,
            status: "error",
            response: failure,
          });
          return failure;
        }

        const responseOut = {
          success: true,
          message: `Submittal #${data.submittal_number} — **"${title}"** created.`,
          record: data,
        };
        await recordWriteAudit({
          toolName: "createSubmittal",
          idempotencyKey,
          projectId: access.projectId,
          input,
          status: "success",
          response: responseOut,
        });
        return responseOut;
      }),
    }),
  };
}
