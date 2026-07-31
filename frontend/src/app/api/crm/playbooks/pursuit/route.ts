import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { z } from "zod";

import { apiErrorResponse } from "@/lib/api-error";
import {
  CRM_PURSUIT_PLAYBOOK,
  planMissingPursuitSteps,
} from "@/lib/crm/playbooks";
import { crmDateOnly } from "@/lib/crm/rules";
import {
  assertCrmOwnerOrAdmin,
  requireActiveInternalOwner,
  requireCrmAccess,
} from "@/lib/crm/server";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";

const RequestSchema = z.object({ deal_id: z.string().uuid() }).strict();

function playbookTaskId(dealId: string, title: string): string {
  const hex = createHash("sha256")
    .update(`crm-pursuit-playbook:${dealId}:${title}`)
    .digest("hex")
    .slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20)}`;
}
export const POST = withApiGuardrails(
  "crm/playbooks/pursuit#POST",
  async ({ request }) => {
    const { db, user, personId, isAdmin } = await requireCrmAccess("write");
    const parsed = RequestSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) {
      throw new GuardrailError({
        code: "VALIDATION_ERROR",
        where: "crm/playbooks/pursuit#POST",
        message: "A valid CRM deal is required.",
        status: 400,
      });
    }

    const [dealResult, timezoneResult, existingResult] = await Promise.all([
      db
        .from("crm_deals")
        .select("id, company_id, owner_person_id, archived_at")
        .eq("id", parsed.data.deal_id)
        .maybeSingle(),
      db
        .from("crm_settings")
        .select("value")
        .eq("key", "default_reporting_timezone")
        .maybeSingle(),
      db
        .from("tasks")
        .select("title")
        .eq("crm_deal_id", parsed.data.deal_id)
        .in(
          "title",
          CRM_PURSUIT_PLAYBOOK.map((step) => step.title),
        ),
    ]);
    const firstError =
      dealResult.error ?? timezoneResult.error ?? existingResult.error;
    if (firstError) return apiErrorResponse(firstError);
    const deal = dealResult.data;
    if (!deal || deal.archived_at) {
      throw new GuardrailError({
        code: "NOT_FOUND",
        where: "crm/playbooks/pursuit#POST",
        message: "The active CRM deal was not found.",
        status: 404,
      });
    }
    assertCrmOwnerOrAdmin({
      ownerPersonId: deal.owner_person_id,
      personId,
      isAdmin,
      action: "crm/playbooks/pursuit#POST",
    });
    await requireActiveInternalOwner(
      deal.owner_person_id,
      "crm/playbooks/pursuit#POST",
    );

    const existingTitles = new Set(
      (existingResult.data ?? [])
        .map((task) => task.title)
        .filter((title): title is string => Boolean(title)),
    );
    const reportingTimezone =
      typeof timezoneResult.data?.value === "string"
        ? timezoneResult.data.value
        : "America/Indianapolis";
    const today = crmDateOnly(new Date(), reportingTimezone);
    const missingSteps = planMissingPursuitSteps(today, existingTitles);
    if (missingSteps.length === 0) {
      return NextResponse.json({ data: { created: 0, complete: true } });
    }
    const { data, error } = await db
      .from("tasks")
      .insert(
        missingSteps.map((step) => ({
          id: playbookTaskId(deal.id, step.title),
          metadata_id: null,
          source_system: "crm",
          source_type: "crm_pursuit_playbook",
          source_url: `/crm/deals/${deal.id}`,
          status: "open",
          title: step.title,
          description: step.title,
          due_date: step.dueDate,
          priority: "high",
          assignee_person_id: deal.owner_person_id,
          assigned_by: user.id,
          company_id: deal.company_id,
          crm_deal_id: deal.id,
          project_ids: [],
        })),
      )
      .select();
    if (error?.code === "23505") {
      const { data: concurrentTasks, error: concurrentError } = await db
        .from("tasks")
        .select("title")
        .eq("crm_deal_id", deal.id)
        .in(
          "title",
          CRM_PURSUIT_PLAYBOOK.map((step) => step.title),
        );
      if (concurrentError) return apiErrorResponse(concurrentError);
      const concurrentTitles = new Set(
        (concurrentTasks ?? []).map((task) => task.title),
      );
      if (
        CRM_PURSUIT_PLAYBOOK.every((step) =>
          concurrentTitles.has(step.title),
        )
      ) {
        return NextResponse.json({
          data: { created: 0, complete: true },
        });
      }
    }
    if (error) return apiErrorResponse(error);

    return NextResponse.json(
      { data: { created: data?.length ?? 0, complete: true } },
      { status: 201 },
    );
  },
);
