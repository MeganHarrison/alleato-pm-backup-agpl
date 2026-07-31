import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

import { apiErrorResponse } from "@/lib/api-error";
import { getNormalizedSubmittalTypeCatalog } from "@/lib/submittals/submittal-type-catalog";
import {
  buildSubmittalWorkflowResponseRows,
  buildSubmittalWorkflowStepRows,
} from "@/lib/submittals/create-workflow";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";

interface RouteParams {
  params: Promise<{ projectId: string }>;
}

const createSubmittalSchema = z.object({
  title: z.string().min(1),
  submittal_number: z.string().min(1),
  revision: z.number().int().min(0).default(0),
  status: z.enum(["Draft", "Open", "Distributed", "Closed"]).default("Draft"),
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
  is_private: z.boolean().default(false),
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
    .max(20, "A submittal workflow can include at most 20 steps.")
    .optional()
    .default([]),
});

/**
 * GET /api/projects/[projectId]/submittals
 * Returns all submittals for the project with type join.
 */
export const GET = withApiGuardrails(
  "projects/[projectId]/submittals#GET",
  async ({ request, params }) => {
  
    const { projectId } = await params;
    const supabase = await createClient();
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/[projectId]/submittals#GET",
        message: "Authentication required.",
      });
    }
    const { searchParams } = new URL(request.url);

    const status = searchParams.get("status");
    const search = searchParams.get("search");
    const tab = searchParams.get("tab"); // "recycle-bin" => deleted_at IS NOT NULL

    let query = supabase
      .from("submittals")
      .select(
        `*,
         submittal_type:submittal_types(id, name),
         submittal_package:submittal_packages(id, name),
         submittal_workflow_steps(
           id, step_order, step_type,
           submittal_responses(id, responder_id, response_status)
         )`,
      )
      .eq("project_id", parseInt(projectId, 10))
      .order("created_at", { ascending: false });

    if (tab === "recycle-bin") {
      query = query.not("deleted_at", "is", null);
    } else {
      query = query.is("deleted_at", null);
    }

    if (status) {
      query = query.eq("status", status);
    }

    if (search) {
      query = query.or(
        `title.ilike.%${search}%,submittal_number.ilike.%${search}%,specification_section.ilike.%${search}%`,
      );
    }

    const { data, error } = await query;

    if (error) {
      return apiErrorResponse(error);
    }

    // Batch-resolve responsible_contractor names (no FK exists in DB)
    const contractorIds = [
      ...new Set(
        (data ?? [])
          .map((s: Record<string, unknown>) => s.responsible_contractor_id as string | null)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    let companyMap: Record<string, string> = {};
    if (contractorIds.length > 0) {
      const { data: companies } = await supabase
        .from("companies")
        .select("id, name")
        .in("id", contractorIds);
      if (companies) {
        companyMap = Object.fromEntries(companies.map((c) => [c.id, c.name]));
      }
    }

    // Batch-resolve ball_in_court UUIDs to display names from user_profiles
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const bicIds = [
      ...new Set(
        (data ?? [])
          .map((s: Record<string, unknown>) => s.ball_in_court as string | null)
          .filter((v): v is string => Boolean(v) && UUID_RE.test(v ?? "")),
      ),
    ];
    let bicMap: Record<string, string> = {};
    if (bicIds.length > 0) {
      const { data: profiles } = await supabase
        .from("user_profiles")
        .select("id, full_name")
        .in("id", bicIds);
      if (profiles) {
        bicMap = Object.fromEntries(
          profiles.map((p: { id: string; full_name: string | null }) => [p.id, p.full_name ?? p.id]),
        );
      }
    }

    // Batch-resolve received_from names from the people table
    const receivedFromIds = [
      ...new Set(
        (data ?? [])
          .map((s: Record<string, unknown>) => s.received_from_id)
          .filter(Boolean)
          .map(String),
      ),
    ];
    let receivedFromMap: Record<string, string> = {};
    if (receivedFromIds.length > 0) {
      const { data: people } = await supabase
        .from("people")
        .select("id, first_name, last_name")
        .in("id", receivedFromIds);
      if (people) {
        receivedFromMap = Object.fromEntries(
          people.map((p: { id: string; first_name: string | null; last_name: string | null }) => [
            p.id,
            `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || p.id,
          ]),
        );
      }
    }

    const enriched = (data ?? []).map((s: Record<string, unknown>) => ({
      ...s,
      responsible_contractor: s.responsible_contractor_id
        ? { id: s.responsible_contractor_id as string, name: companyMap[s.responsible_contractor_id as string] ?? null }
        : null,
      received_from: s.received_from_id
        ? receivedFromMap[String(s.received_from_id)] ?? null
        : null,
      ball_in_court: s.ball_in_court && UUID_RE.test(s.ball_in_court as string)
        ? (bicMap[s.ball_in_court as string] ?? s.ball_in_court)
        : s.ball_in_court,
    }));

    return NextResponse.json(enriched);
    },
);

/**
 * POST /api/projects/[projectId]/submittals
 * Creates a new submittal.
 */
export const POST = withApiGuardrails(
  "projects/[projectId]/submittals#POST",
  async ({ request, params }) => {
  
    const { projectId } = await params;
    const supabase = await createClient();

    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/submittals#POST", message: "Authentication required." });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new GuardrailError({ code: "BAD_REQUEST", where: "projects/[projectId]/submittals#POST", message: "Request body must be valid JSON." });
    }

    let validatedData: z.infer<typeof createSubmittalSchema>;
    try {
      validatedData = createSubmittalSchema.parse(body);
    } catch (error) {
      if (error instanceof ZodError) {
        throw new GuardrailError({
          code: "BAD_REQUEST",
          where: "projects/[projectId]/submittals#POST",
          message: "Submittal create request is invalid.",
          details: error.issues,
        });
      }
      throw error;
    }
    const submittalTypes = await getNormalizedSubmittalTypeCatalog(supabase as unknown as Parameters<typeof getNormalizedSubmittalTypeCatalog>[0]);
    const fallbackType =
      submittalTypes.find((type) => type.name === "Other") ?? submittalTypes[0] ?? null;
    const resolvedSubmittalTypeId =
      validatedData.submittal_type_id ?? fallbackType?.id ?? null;

    if (!resolvedSubmittalTypeId) {
      return NextResponse.json(
        { error: "Unable to resolve a submittal type. Please refresh and try again." },
        { status: 422 },
      );
    }

    // Check unique submittal_number within project
    const { data: existing } = await supabase
      .from("submittals")
      .select("id")
      .eq("project_id", parseInt(projectId, 10))
      .eq("submittal_number", validatedData.submittal_number)
      .eq("revision", validatedData.revision)
      .is("deleted_at", null)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: "Submittal number + revision already exists for this project" },
        { status: 409 },
      );
    }

    // ── Server-side smart defaults ────────────────────────────────────────────

    // submittal_manager_id: default to current user if not provided
    const resolvedManagerId = validatedData.submittal_manager_id ?? user.id;

    // ball_in_court: when Draft and not provided, default to the submittal manager
    const resolvedBallInCourt =
      validatedData.ball_in_court ??
      (validatedData.status === "Draft" ? resolvedManagerId : null);

    // final_due_date: auto-compute from required_on_site_date − lead_time if not provided
    let resolvedFinalDueDate = validatedData.final_due_date ?? null;
    if (!resolvedFinalDueDate && validatedData.required_on_site_date && validatedData.lead_time != null) {
      try {
        const onSite = new Date(validatedData.required_on_site_date);
        onSite.setUTCDate(onSite.getUTCDate() - validatedData.lead_time);
        resolvedFinalDueDate = onSite.toISOString().split("T")[0];
      } catch {
        resolvedFinalDueDate = null;
      }
    }

    const { initial_workflow_steps: initialWorkflowSteps, ...submittalData } = validatedData;

    const { data, error } = await supabase
      .from("submittals")
      .insert({
        ...submittalData,
        project_id: parseInt(projectId, 10),
        submitted_by: user.id,
        created_by: user.id,
        submittal_type_id: resolvedSubmittalTypeId,
        submittal_manager_id: resolvedManagerId,
        ball_in_court: resolvedBallInCourt,
        final_due_date: resolvedFinalDueDate,
      })
      .select(
        `*,
         submittal_type:submittal_types(id, name),
         submittal_package:submittal_packages(id, name)`,
      )
      .single();

    if (error) {
      return apiErrorResponse(error);
    }

    if (initialWorkflowSteps.length > 0) {
      const workflowRows = buildSubmittalWorkflowStepRows(data.id, initialWorkflowSteps);

      const { data: steps, error: stepsError } = await supabase
        .from("submittal_workflow_steps")
        .insert(workflowRows)
        .select("id, step_order");

      if (stepsError || !steps || steps.length !== initialWorkflowSteps.length) {
        await supabase.from("submittals").delete().eq("id", data.id);
        if (stepsError) {
          return apiErrorResponse(stepsError);
        }
        return NextResponse.json(
          {
            error:
              "Submittal workflow could not be saved. No submittal was created.",
          },
          { status: 500 },
        );
      }

      let responseRows: ReturnType<typeof buildSubmittalWorkflowResponseRows>;
      try {
        responseRows = buildSubmittalWorkflowResponseRows(
          data.id,
          initialWorkflowSteps,
          steps,
        );
      } catch {
        await supabase.from("submittal_workflow_steps").delete().eq("submittal_id", data.id);
        await supabase.from("submittals").delete().eq("id", data.id);
        return NextResponse.json(
          {
            error:
              "Submittal workflow could not be saved. No submittal was created.",
          },
          { status: 500 },
        );
      }

      const { error: responsesError } = await supabase
        .from("submittal_responses")
        .insert(responseRows);

      if (responsesError) {
        await supabase.from("submittal_responses").delete().eq("submittal_id", data.id);
        await supabase.from("submittal_workflow_steps").delete().eq("submittal_id", data.id);
        await supabase.from("submittals").delete().eq("id", data.id);
        return apiErrorResponse(responsesError);
      }
    }

    return NextResponse.json(data, { status: 201 });
    },
);
