import { NextResponse } from "next/server";
import { z } from "zod";
import { withApiGuardrails, parseJsonBody, validateResponseContract } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { isAuthError, verifyProjectAccess } from "@/lib/supabase/auth-guard";
import { getApiRouteUser } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/permissions-guard";

const ParamsSchema = z.object({
  projectId: z.string().regex(/^\d+$/, "Project ID must be numeric"),
  commitmentId: z.string().min(1),
});

const PcoStatusSchema = z.enum(["open", "pending", "approved", "rejected", "void"]);
type PcoStatus = z.infer<typeof PcoStatusSchema>;

const PcoCreateSchema = z.object({
  number: z.string().trim().min(1, "PCO number is required"),
  title: z.string().trim().min(1, "PCO title is required"),
  amount: z.number().optional(),
  description: z.string().optional(),
  change_reason: z.string().optional(),
  status: PcoStatusSchema.optional(),
  revision: z.number().int().optional(),
  is_private: z.boolean().optional(),
  executed: z.boolean().optional(),
  signed_co_received_date: z.string().nullable().optional(),
  requested_by: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  schedule_impact: z.number().int().nullable().optional(),
  field_change: z.boolean().optional(),
  reference: z.string().nullable().optional(),
  paid_in_full: z.boolean().optional(),
  due_date: z.string().nullable().optional(),
});

const API_TO_DB_STATUS: Record<PcoStatus, "draft" | "pending" | "approved" | "void"> = {
  open: "draft",
  pending: "pending",
  approved: "approved",
  rejected: "void",
  void: "void",
};

function toApiStatus(status: string | null | undefined): PcoStatus {
  switch (status) {
    case "draft":
      return "open";
    case "pending":
      return "pending";
    case "approved":
      return "approved";
    case "void":
      return "void";
    default:
      return "open";
  }
}

function normalizePcoRow(row: Record<string, unknown>) {
  return {
    ...row,
    number: row.pco_number ?? null,
    amount: row.total_amount ?? null,
    cco_id: row.promoted_to_co_id ?? null,
    status: toApiStatus(typeof row.status === "string" ? row.status : null),
  };
}

const PcoListResponseSchema = z.object({
  data: z.array(z.record(z.string(), z.unknown())),
});

const PcoSingleResponseSchema = z.object({
  data: z.record(z.string(), z.unknown()),
});

export const GET = withApiGuardrails<Promise<{ projectId: string; commitmentId: string }>>(
  "/api/projects/[projectId]/commitments/[commitmentId]/pcos#GET",
  async ({ params }) => {
    const parsedParams = ParamsSchema.safeParse(await params);
    if (!parsedParams.success) {
      throw new GuardrailError({
        code: "INVALID_PAYLOAD",
        where: "/api/projects/[projectId]/commitments/[commitmentId]/pcos#GET",
        message: "Invalid path parameters.",
        details: parsedParams.error.issues.map((issue) => issue.message),
      });
    }

    const { projectId, commitmentId } = parsedParams.data;
    const numericProjectId = Number.parseInt(projectId, 10);

    const authResult = await verifyProjectAccess(numericProjectId);
    if (isAuthError(authResult)) {
      return authResult;
    }
    const { serviceClient: supabase } = authResult;

    const { data, error } = await supabase
      .from("commitment_pcos")
      .select("*")
      .eq("commitment_id", commitmentId)
      .eq("project_id", numericProjectId)
      .order("created_at", { ascending: false });

    if (error) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where: "/api/projects/[projectId]/commitments/[commitmentId]/pcos#GET",
        message: "Failed to list commitment PCOs.",
        details: { reason: error.message, projectId: numericProjectId, commitmentId },
        cause: error,
      });
    }

    const payload = {
      data: (data ?? []).map((row: Record<string, unknown>) => normalizePcoRow(row)),
    };
    validateResponseContract(
      PcoListResponseSchema,
      payload,
      "/api/projects/[projectId]/commitments/[commitmentId]/pcos#GET",
    );

    return NextResponse.json(payload);
  },
);

export const POST = withApiGuardrails<Promise<{ projectId: string; commitmentId: string }>>(
  "/api/projects/[projectId]/commitments/[commitmentId]/pcos#POST",
  async ({ request, params }) => {
    const parsedParams = ParamsSchema.safeParse(await params);
    if (!parsedParams.success) {
      throw new GuardrailError({
        code: "INVALID_PAYLOAD",
        where: "/api/projects/[projectId]/commitments/[commitmentId]/pcos#POST",
        message: "Invalid path parameters.",
        details: parsedParams.error.issues.map((issue) => issue.message),
      });
    }

    const { projectId, commitmentId } = parsedParams.data;
    const numericProjectId = Number.parseInt(projectId, 10);
    const authResult = await verifyProjectAccess(numericProjectId);
    if (isAuthError(authResult)) {
      return authResult;
    }
    const { serviceClient: supabase } = authResult;

    const guard = await requirePermission(numericProjectId, "contracts", "write");
    if (guard.denied) {
      return guard.response;
    }

    const body = await parseJsonBody(
      request,
      PcoCreateSchema,
      "/api/projects/[projectId]/commitments/[commitmentId]/pcos#POST",
    );

    const { data: commitment, error: commitmentError } = await supabase
      .from("commitments_unified")
      .select("commitment_type")
      .eq("id", commitmentId)
      .eq("project_id", numericProjectId)
      .single();

    if (commitmentError || !commitment?.commitment_type) {
      throw new GuardrailError({
        code: "ROUTE_BINDING_MISSING",
        where: "/api/projects/[projectId]/commitments/[commitmentId]/pcos#POST",
        message: "Commitment not found.",
        status: 404,
        severity: "low",
      });
    }

    const user = await getApiRouteUser();

    const { data, error } = await supabase
      .from("commitment_pcos")
      .insert({
        project_id: numericProjectId,
        commitment_id: commitmentId,
        commitment_type: commitment.commitment_type,
        pco_number: body.number.trim(),
        title: body.title.trim(),
        total_amount: body.amount ?? 0,
        description: body.description ?? null,
        change_reason: body.change_reason ?? null,
        status: API_TO_DB_STATUS[body.status ?? "open"],
        revision: body.revision ?? 0,
        is_private: body.is_private ?? false,
        executed: body.executed ?? false,
        signed_co_received_date: body.signed_co_received_date ?? null,
        requested_by: body.requested_by ?? null,
        location: body.location ?? null,
        schedule_impact: body.schedule_impact ?? null,
        field_change: body.field_change ?? false,
        reference: body.reference ?? null,
        paid_in_full: body.paid_in_full ?? false,
        due_date: body.due_date ?? null,
        created_by: user?.id ?? null,
      })
      .select("*")
      .single();

    if (error) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where: "/api/projects/[projectId]/commitments/[commitmentId]/pcos#POST",
        message: "Failed to create commitment PCO.",
        details: { reason: error.message, projectId: numericProjectId, commitmentId },
        cause: error,
      });
    }

    const payload = { data: normalizePcoRow(data as Record<string, unknown>) };
    validateResponseContract(
      PcoSingleResponseSchema,
      payload,
      "/api/projects/[projectId]/commitments/[commitmentId]/pcos#POST",
    );

    return NextResponse.json(payload, { status: 201 });
  },
);
