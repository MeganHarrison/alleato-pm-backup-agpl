import { NextResponse } from "next/server";
// Dispatched by the consolidated CRM catch-all route.
import { z } from "zod";

import { apiErrorResponse } from "@/lib/api-error";
import { assertCrmOwnerOrAdmin, requireCrmAccess } from "@/lib/crm/server";
import { GuardrailError } from "@/lib/guardrails/errors";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { assertNonNilUuid } from "@/lib/guardrails/path-params";

type Params = { dealId: string };
const BodySchema = z
  .object({
    idempotency_key: z.string().trim().min(8).max(200),
  })
  .strict();

export const POST = withApiGuardrails<Params>(
  "crm/deals/[dealId]/conversion#POST",
  async ({ request, params }) => {
    assertNonNilUuid(params.dealId, "dealId", "crm/deals/conversion");
    const { db, personId, isAdmin } = await requireCrmAccess("write");
    const parsed = BodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new GuardrailError({
        code: "VALIDATION_ERROR",
        where: "crm/deals/[dealId]/conversion#POST",
        message: "A stable idempotency key is required.",
        status: 400,
      });
    }
    const { data: existing, error: existingError } = await db
      .from("crm_conversion_attempts")
      .select("*")
      .eq("idempotency_key", parsed.data.idempotency_key)
      .maybeSingle();
    if (existingError) return apiErrorResponse(existingError);
    if (existing && existing.deal_id !== params.dealId) {
      throw new GuardrailError({
        code: "PRECONDITION_FAILED",
        where: "crm/deals/[dealId]/conversion#POST",
        message: "This idempotency key belongs to a different deal.",
        status: 409,
      });
    }
    const pendingLeaseExpired =
      existing?.status === "pending" &&
      Date.now() - new Date(existing.updated_at).getTime() >= 5 * 60 * 1000;
    if (
      existing &&
      existing.status !== "failed_recoverable" &&
      !pendingLeaseExpired
    ) {
      return NextResponse.json({ data: existing, replayed: true });
    }

    const { data: deal, error: dealError } = await db
      .from("crm_deals")
      .select("*")
      .eq("id", params.dealId)
      .maybeSingle();
    if (dealError) return apiErrorResponse(dealError);
    if (!deal) {
      throw new GuardrailError({
        code: "NOT_FOUND",
        where: "crm/deals/conversion",
        message: "Deal not found.",
        status: 404,
      });
    }
    assertCrmOwnerOrAdmin({
      ownerPersonId: deal.owner_person_id,
      personId,
      isAdmin,
      action: "crm/deals/[dealId]/conversion#POST",
    });
    if (!deal.company_id) {
      throw new GuardrailError({
        code: "PRECONDITION_FAILED",
        where: "crm/deals/[dealId]/conversion#POST",
        message:
          "Link this lead to an approved company before converting the deal to a project.",
        status: 409,
      });
    }
    if (deal.status !== "won") {
      throw new GuardrailError({
        code: "PRECONDITION_FAILED",
        where: "crm/deals/[dealId]/conversion#POST",
        message: "Only a won deal can be converted.",
        status: 409,
      });
    }
    if (existing?.project_id) {
      if (deal.project_id !== null && deal.project_id !== existing.project_id) {
        throw new GuardrailError({
          code: "PRECONDITION_FAILED",
          where: "crm/deals/[dealId]/conversion#POST",
          message: "This deal is already linked to a different project.",
          status: 409,
        });
      }
      if (deal.project_id === null) {
        const { error: relinkError } = await db
          .from("crm_deals")
          .update({
            project_id: existing.project_id,
            project_sync_status: "linked",
          })
          .eq("id", params.dealId)
          .is("project_id", null);
        if (relinkError) return apiErrorResponse(relinkError);
      }
      const { data: retried, error: retryError } = await db
        .from("crm_conversion_attempts")
        .update({
          status: "erp_pending",
          attempt_count: existing.attempt_count + 1,
          last_error_code: null,
          last_error_message: null,
        })
        .eq("id", existing.id)
        .select()
        .single();
      if (retryError) return apiErrorResponse(retryError);
      return NextResponse.json(
        {
          data: retried,
          replayed: true,
          message:
            "The existing project link was recovered. Acumatica synchronization remains pending.",
        },
        { status: 202 },
      );
    }
    if (!existing && deal.project_id !== null) {
      throw new GuardrailError({
        code: "PRECONDITION_FAILED",
        where: "crm/deals/[dealId]/conversion#POST",
        message: "This deal is already linked to a project.",
        status: 409,
      });
    }

    let attempt = existing;
    if (attempt) {
      const leaseTimestamp = new Date().toISOString();
      const { data: leasedAttempt, error: leaseError } = await db
        .from("crm_conversion_attempts")
        .update({
          status: "pending",
          last_error_code: null,
          last_error_message: null,
          updated_at: leaseTimestamp,
        })
        .eq("id", attempt.id)
        .eq("status", attempt.status)
        .eq("updated_at", attempt.updated_at)
        .select()
        .maybeSingle();
      if (leaseError) return apiErrorResponse(leaseError);
      if (!leasedAttempt) {
        return NextResponse.json({ data: attempt, replayed: true });
      }
      attempt = leasedAttempt;
    }
    if (!attempt) {
      const { data: insertedAttempt, error: attemptError } = await db
        .from("crm_conversion_attempts")
        .insert({
          deal_id: params.dealId,
          idempotency_key: parsed.data.idempotency_key,
          status: "pending",
          requested_by_person_id: personId,
        })
        .select()
        .single();
      if (attemptError) return apiErrorResponse(attemptError);
      attempt = insertedAttempt;
    }
    if (!attempt) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where: "crm/deals/[dealId]/conversion#POST",
        message: "The conversion attempt could not be initialized.",
      });
    }

    const projectResponse = await fetch(new URL("/api/projects", request.url), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: request.headers.get("cookie") ?? "",
      },
      body: JSON.stringify({
        name: deal.name,
        company_id: deal.company_id,
        crm_conversion_attempt_id: attempt.id,
      }),
    });
    if (!projectResponse.ok) {
      const message = `Project creation failed with HTTP ${projectResponse.status}.`;
      const { data } = await db
        .from("crm_conversion_attempts")
        .update({
          status: "failed_recoverable",
          attempt_count: attempt.attempt_count + 1,
          last_error_code: "PROJECT_CREATE_FAILED",
          last_error_message: message,
        })
        .eq("id", attempt.id)
        .select()
        .single();
      return NextResponse.json({ data, recoverable: true }, { status: 502 });
    }
    const project = (await projectResponse.json()) as { id?: number };
    if (!Number.isFinite(project.id)) {
      throw new GuardrailError({
        code: "SCHEMA_MISMATCH",
        where: "crm/deals/[dealId]/conversion#POST",
        message:
          "Project creation succeeded without a readable project identifier.",
        severity: "high",
      });
    }
    const { data: linkedDeal, error: linkError } = await db
      .from("crm_deals")
      .update({ project_id: project.id, project_sync_status: "linked" })
      .eq("id", params.dealId)
      .is("project_id", null)
      .select("id")
      .maybeSingle();
    if (linkError) return apiErrorResponse(linkError);
    if (!linkedDeal) {
      const { data } = await db
        .from("crm_conversion_attempts")
        .update({
          status: "failed_recoverable",
          project_id: project.id,
          attempt_count: attempt.attempt_count + 1,
          last_error_code: "PROJECT_LINK_CONFLICT",
          last_error_message:
            "The project was created, but the deal changed before the link was saved.",
        })
        .eq("id", attempt.id)
        .select()
        .single();
      return NextResponse.json({ data, recoverable: true }, { status: 409 });
    }
    const { data, error } = await db
      .from("crm_conversion_attempts")
      .update({
        status: "erp_pending",
        project_id: project.id,
        attempt_count: attempt.attempt_count + 1,
        last_error_code: null,
        last_error_message: null,
      })
      .eq("id", attempt.id)
      .select()
      .single();
    if (error) return apiErrorResponse(error);
    return NextResponse.json(
      {
        data,
        message:
          "Project created. Acumatica synchronization remains pending and must be reconciled before completion.",
      },
      { status: 202 },
    );
  },
);
