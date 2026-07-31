import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

import { apiErrorResponse } from "@/lib/api-error";
import { listLinkedPatternCDocuments } from "@/lib/documents/pattern-c-attachments";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

interface RouteParams {
  params: Promise<{ projectId: string; submittalId: string }>;
}

const updateSubmittalSchema = z.object({
  title: z.string().min(1).optional(),
  submittal_number: z.string().min(1).optional(),
  revision: z.number().int().min(0).optional(),
  status: z.enum(["Draft", "Open", "Distributed", "Closed"]).optional(),
  specification_section: z.string().nullable().optional(),
  submittal_type: z.string().nullable().optional(),
  submittal_type_id: z.string().uuid().nullable().optional(),
  division: z.string().nullable().optional(),
  submittal_package_id: z.string().uuid().nullable().optional(),
  responsible_contractor_id: z.string().uuid().nullable().optional(),
  received_from_id: z.string().uuid().nullable().optional(),
  submittal_manager_id: z.string().uuid().nullable().optional(),
  final_due_date: z.string().nullable().optional(),
  lead_time: z.number().int().nullable().optional(),
  required_on_site_date: z.string().nullable().optional(),
  cost_code_id: z.number().int().nullable().optional(),
  location_id: z.number().int().nullable().optional(),
  is_private: z.boolean().optional(),
  description: z.string().nullable().optional(),
  priority: z.string().nullable().optional(),
  ball_in_court: z.string().nullable().optional(),
  required_approval_date: z.string().nullable().optional(),
  submission_date: z.string().nullable().optional(),
  initial_workflow_steps: z
    .array(
      z.object({
        user_id: z.string().uuid(),
        step_type: z.string().min(1),
      }),
    )
    .optional(),
});

/**
 * GET /api/projects/[projectId]/submittals/[submittalId]
 * Returns a single submittal with all related data.
 */
export const GET = withApiGuardrails(
  "projects/[projectId]/submittals/[submittalId]#GET",
  async ({ request, params }) => {
  
    const { projectId, submittalId } = await params;
    const supabase = await createClient();
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/[projectId]/submittals/[submittalId]#GET",
        message: "Authentication required.",
      });
    }
    const serviceClient = createServiceClient();

    const { data, error } = await supabase
      .from("submittals")
      .select(
        `*,
         submittal_type:submittal_types(id, name),
         submittal_package:submittal_packages(id, name),
         submittal_workflow_steps(
           id,
           step_order,
           step_type,
           submittal_responses(
             id,
             responder_id,
             response_status,
             comments,
             responded_at
           )
         ),
         submittal_distributions(
           id,
           from_id,
           message,
           distributed_at,
           submittal_distribution_recipients(id, recipient_id)
         ),
         submittal_linked_drawings(
           id,
           drawing_id
         ),
         submittal_history(
           id,
           action,
           actor_id,
           new_status,
           changes,
           metadata,
           occurred_at
         )`,
      )
      .eq("project_id", parseInt(projectId, 10))
      .eq("id", submittalId)
      .maybeSingle();

    if (error) {
      return apiErrorResponse(error);
    }

    if (!data) {
      return NextResponse.json({ error: "Submittal not found" }, { status: 404 });
    }

    const attachments = await listLinkedPatternCDocuments({
      supabase,
      serviceClient,
      entityType: "submittal",
      entityId: submittalId,
    });

    // Resolve responsible_contractor name via secondary lookup (no FK exists)
    let responsible_contractor: { id: string; name: string } | null = null;
    if (data.responsible_contractor_id) {
      const { data: company } = await supabase
        .from("companies")
        .select("id, name")
        .eq("id", data.responsible_contractor_id)
        .single();
      if (company) {
        responsible_contractor = company;
      }
    }

    let received_from: string | null = null;
    if (data.received_from_id) {
      const { data: person, error: receivedFromError } = await supabase
        .from("people")
        .select("id, first_name, last_name, email")
        .eq("id", data.received_from_id)
        .maybeSingle();

      if (receivedFromError) {
        return apiErrorResponse(receivedFromError);
      }

      if (person) {
        received_from =
          [person.first_name, person.last_name].filter(Boolean).join(" ").trim() ||
          person.email ||
          null;
      }
    }

    // Fetch linked RFIs via the junction table
    const { data: rfiLinks } = await supabase
      .from("rfis_submittals_links")
      .select(`
        id,
        link_type,
        note,
        created_at,
        created_by,
        rfi:rfis(
          id,
          number,
          subject,
          question,
          status,
          rfi_stage,
          date_initiated,
          due_date,
          ball_in_court,
          created_by,
          created_at
        )
      `)
      .eq("submittal_id", submittalId)
      .eq("project_id", parseInt(projectId, 10));

    return NextResponse.json({
      ...data,
      responsible_contractor,
      received_from,
      linked_rfis: (rfiLinks ?? []).map((link) => ({
        link_id: link.id,
        link_type: link.link_type,
        note: link.note,
        linked_at: link.created_at,
        linked_by: link.created_by,
        ...(link.rfi as object),
      })),
      attachments: attachments.map((attachment) => ({
        id: attachment.document_metadata_id,
        file_name: attachment.file_name ?? attachment.title ?? "Attachment",
        file_url: attachment.download_url,
        file_size: attachment.source_size,
        content_type: attachment.mime_type,
        is_current: true,
        uploaded_by: null,
        created_at: attachment.attached_at,
      })),
    });
    },
);

/**
 * PUT /api/projects/[projectId]/submittals/[submittalId]
 * Updates a submittal.
 */
export const PUT = withApiGuardrails(
  "projects/[projectId]/submittals/[submittalId]#PUT",
  async ({ request, params }) => {
  
    const { projectId, submittalId } = await params;
    const supabase = await createClient();

    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/submittals/[submittalId]#PUT", message: "Authentication required." });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new GuardrailError({ code: "BAD_REQUEST", where: "projects/[projectId]/submittals/[submittalId]#PUT", message: "Request body must be valid JSON." });
    }

    const { initial_workflow_steps: newWorkflowSteps, ...validatedData } = updateSubmittalSchema.parse(body);

    const { data, error } = await supabase
      .from("submittals")
      .update({
        ...validatedData,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq("project_id", parseInt(projectId, 10))
      .eq("id", submittalId)
      .select(
        `*,
         submittal_type:submittal_types(id, name),
         submittal_package:submittal_packages(id, name)`,
      )
      .single();

    if (error) {
      return apiErrorResponse(error);
    }

    // Append new workflow steps (edit mode: append-only, never replace)
    if (newWorkflowSteps && newWorkflowSteps.length > 0) {
      const { data: existingSteps } = await supabase
        .from("submittal_workflow_steps")
        .select("step_order")
        .eq("submittal_id", submittalId)
        .order("step_order", { ascending: false })
        .limit(1);
      const baseOrder = existingSteps?.[0]?.step_order ?? 0;

      const stepRows = newWorkflowSteps.map((step, index) => ({
        submittal_id: submittalId,
        step_order: baseOrder + index + 1,
        step_type: step.step_type,
      }));

      const { data: insertedSteps, error: stepsError } = await supabase
        .from("submittal_workflow_steps")
        .insert(stepRows)
        .select("id, step_order");

      if (!stepsError && insertedSteps) {
        const responseRows = insertedSteps.map((step) => {
          const idx = step.step_order - baseOrder - 1;
          const source = newWorkflowSteps[idx];
          return {
            submittal_id: submittalId,
            workflow_step_id: step.id,
            responder_id: source.user_id,
            response_status: "Pending",
          };
        });
        await supabase.from("submittal_responses").insert(responseRows);
      }
    }

    return NextResponse.json(data);
    },
);

/**
 * DELETE /api/projects/[projectId]/submittals/[submittalId]
 * Soft-deletes a submittal (moves to Recycle Bin).
 */
export const DELETE = withApiGuardrails(
  "projects/[projectId]/submittals/[submittalId]#DELETE",
  async ({ request, params }) => {
  
    const { projectId, submittalId } = await params;
    const supabase = await createClient();

    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/submittals/[submittalId]#DELETE", message: "Authentication required." });
    }

    const { error } = await supabase
      .from("submittals")
      .update({
        deleted_at: new Date().toISOString(),
        updated_by: user.id,
      })
      .eq("project_id", parseInt(projectId, 10))
      .eq("id", submittalId);

    if (error) {
      return apiErrorResponse(error);
    }

    return NextResponse.json({ success: true });
    },
);
