import { NextResponse } from "next/server";
import { z } from "zod";
import { parseJsonBody, validateResponseContract, withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { requirePermission } from "@/lib/permissions-guard";
import { isAuthError, verifyProjectAccess } from "@/lib/supabase/auth-guard";

const ParamsSchema = z.object({
  projectId: z.string().regex(/^\d+$/, "Project ID must be numeric"),
  commitmentId: z.string().min(1),
  pcoId: z.string().min(1),
});

const PcoStatusSchema = z.enum(["open", "pending", "approved", "rejected", "void"]);
type PcoStatus = z.infer<typeof PcoStatusSchema>;

const PcoUpdateSchema = z.object({
  title: z.string().trim().optional(),
  amount: z.number().optional(),
  description: z.string().nullable().optional(),
  change_reason: z.string().nullable().optional(),
  status: PcoStatusSchema.optional(),
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

const PcoSingleResponseSchema = z.object({
  data: z.record(z.string(), z.unknown()),
});

export const GET = withApiGuardrails<
  Promise<{ projectId: string; commitmentId: string; pcoId: string }>
>("/api/projects/[projectId]/commitments/[commitmentId]/pcos/[pcoId]#GET", async ({ params }) => {
  const parsedParams = ParamsSchema.safeParse(await params);
  if (!parsedParams.success) {
    throw new GuardrailError({
      code: "INVALID_PAYLOAD",
      where: "/api/projects/[projectId]/commitments/[commitmentId]/pcos/[pcoId]#GET",
      message: "Invalid path parameters.",
      details: parsedParams.error.issues.map((issue) => issue.message),
    });
  }

  const { projectId, commitmentId, pcoId } = parsedParams.data;
  const numericProjectId = Number.parseInt(projectId, 10);
  const authResult = await verifyProjectAccess(numericProjectId);
  if (isAuthError(authResult)) {
    return authResult;
  }
  const { serviceClient: supabase } = authResult;

  const { data, error } = await supabase
    .from("commitment_pcos")
    .select("*")
    .eq("id", pcoId)
    .eq("commitment_id", commitmentId)
    .eq("project_id", numericProjectId)
    .single();

  if (error || !data) {
    throw new GuardrailError({
      code: "ROUTE_BINDING_MISSING",
      where: "/api/projects/[projectId]/commitments/[commitmentId]/pcos/[pcoId]#GET",
      message: "PCO not found.",
      status: 404,
      severity: "low",
      details: error ? { reason: error.message } : undefined,
      cause: error ?? undefined,
    });
  }

  const payload = { data: normalizePcoRow(data as Record<string, unknown>) };
  validateResponseContract(
    PcoSingleResponseSchema,
    payload,
    "/api/projects/[projectId]/commitments/[commitmentId]/pcos/[pcoId]#GET",
  );

  return NextResponse.json(payload);
});

export const PUT = withApiGuardrails<
  Promise<{ projectId: string; commitmentId: string; pcoId: string }>
>("/api/projects/[projectId]/commitments/[commitmentId]/pcos/[pcoId]#PUT", async ({ request, params }) => {
  const parsedParams = ParamsSchema.safeParse(await params);
  if (!parsedParams.success) {
    throw new GuardrailError({
      code: "INVALID_PAYLOAD",
      where: "/api/projects/[projectId]/commitments/[commitmentId]/pcos/[pcoId]#PUT",
      message: "Invalid path parameters.",
      details: parsedParams.error.issues.map((issue) => issue.message),
    });
  }

  const { projectId, commitmentId, pcoId } = parsedParams.data;
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
    PcoUpdateSchema,
    "/api/projects/[projectId]/commitments/[commitmentId]/pcos/[pcoId]#PUT",
  );

  const updatePayload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (body.title !== undefined) {
    updatePayload.title = body.title.trim();
  }
  if (body.amount !== undefined) {
    updatePayload.total_amount = body.amount;
  }
  if (body.description !== undefined) {
    updatePayload.description = body.description;
  }
  if (body.status !== undefined) {
    updatePayload.status = API_TO_DB_STATUS[body.status];
  }

  const { data, error } = await supabase
    .from("commitment_pcos")
    .update(updatePayload)
    .eq("id", pcoId)
    .eq("commitment_id", commitmentId)
    .eq("project_id", numericProjectId)
    .select("*")
    .single();

  if (error || !data) {
    throw new GuardrailError({
      code: "ROUTE_BINDING_MISSING",
      where: "/api/projects/[projectId]/commitments/[commitmentId]/pcos/[pcoId]#PUT",
      message: "PCO not found.",
      status: 404,
      severity: "low",
      details: error ? { reason: error.message } : undefined,
      cause: error ?? undefined,
    });
  }

  const payload = { data: normalizePcoRow(data as Record<string, unknown>) };
  validateResponseContract(
    PcoSingleResponseSchema,
    payload,
    "/api/projects/[projectId]/commitments/[commitmentId]/pcos/[pcoId]#PUT",
  );

  return NextResponse.json(payload);
});

export const DELETE = withApiGuardrails<
  Promise<{ projectId: string; commitmentId: string; pcoId: string }>
>("/api/projects/[projectId]/commitments/[commitmentId]/pcos/[pcoId]#DELETE", async ({ params }) => {
  const parsedParams = ParamsSchema.safeParse(await params);
  if (!parsedParams.success) {
    throw new GuardrailError({
      code: "INVALID_PAYLOAD",
      where: "/api/projects/[projectId]/commitments/[commitmentId]/pcos/[pcoId]#DELETE",
      message: "Invalid path parameters.",
      details: parsedParams.error.issues.map((issue) => issue.message),
    });
  }

  const { projectId, commitmentId, pcoId } = parsedParams.data;
  const numericProjectId = Number.parseInt(projectId, 10);
  const authResult = await verifyProjectAccess(numericProjectId);
  if (isAuthError(authResult)) {
    return authResult;
  }
  const { serviceClient: supabase } = authResult;

  const guard = await requirePermission(numericProjectId, "contracts", "admin");
  if (guard.denied) {
    return guard.response;
  }

  const { error } = await supabase
    .from("commitment_pcos")
    .delete()
    .eq("id", pcoId)
    .eq("commitment_id", commitmentId)
    .eq("project_id", numericProjectId);

  if (error) {
    throw new GuardrailError({
      code: "INTERNAL_ERROR",
      where: "/api/projects/[projectId]/commitments/[commitmentId]/pcos/[pcoId]#DELETE",
      message: "Failed to delete commitment PCO.",
      details: { reason: error.message, projectId: numericProjectId, commitmentId, pcoId },
      cause: error,
    });
  }

  return NextResponse.json({ success: true });
});
