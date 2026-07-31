export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { withApiGuardrails, parseJsonBody } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { serviceDb } from "@/lib/supabase/service-db";
import {
  INBOX_RULES_MAILBOX,
  requireRulesAccess,
  rowToDto,
  updateInboxRuleSchema,
  type InboxRuleRow,
} from "../_shared";

const WHERE_PATCH = "api/outlook-inbox-rules/[ruleId]#PATCH";
const WHERE_DELETE = "api/outlook-inbox-rules/[ruleId]#DELETE";

export const PATCH = withApiGuardrails<{ ruleId: string }>(
  WHERE_PATCH,
  async ({ request, params }) => {
    await requireRulesAccess(WHERE_PATCH);
    const { ruleId } = await params;
    const input = await parseJsonBody(request, updateInboxRuleSchema, WHERE_PATCH);

    const patch: Record<string, unknown> = {};
    if (input.name !== undefined) {
      patch.name = input.name?.trim() ? input.name.trim() : null;
    }
    if (input.field !== undefined) patch.match_field = input.field;
    if (input.operator !== undefined) patch.match_operator = input.operator;
    if (input.value !== undefined) patch.match_value = input.value;
    if (input.action !== undefined) patch.action = input.action;
    if (input.actionValue !== undefined) {
      patch.action_value = input.actionValue?.trim()
        ? input.actionValue.trim()
        : null;
    }
    if (input.enabled !== undefined) patch.enabled = input.enabled;

    if (Object.keys(patch).length === 0) {
      throw new GuardrailError({
        code: "VALIDATION_ERROR",
        where: WHERE_PATCH,
        message: "No fields to update.",
        status: 400,
      });
    }

    const { data, error } = await serviceDb.from("outlook_inbox_rules")
      .update(patch)
      .eq("id", ruleId)
      .eq("mailbox_user_id", INBOX_RULES_MAILBOX)
      .select("*")
      .maybeSingle();

    if (error) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where: WHERE_PATCH,
        message: error.message,
      });
    }
    if (!data) {
      throw new GuardrailError({
        code: "NOT_FOUND",
        where: WHERE_PATCH,
        message: "Rule not found.",
        status: 404,
      });
    }

    return NextResponse.json(rowToDto(data as InboxRuleRow));
  },
);

export const DELETE = withApiGuardrails<{ ruleId: string }>(
  WHERE_DELETE,
  async ({ params }) => {
    await requireRulesAccess(WHERE_DELETE);
    const { ruleId } = await params;

    const { data, error } = await serviceDb.from("outlook_inbox_rules")
      .delete()
      .eq("id", ruleId)
      .eq("mailbox_user_id", INBOX_RULES_MAILBOX)
      .select("id")
      .maybeSingle();

    if (error) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where: WHERE_DELETE,
        message: error.message,
      });
    }
    if (!data) {
      throw new GuardrailError({
        code: "NOT_FOUND",
        where: WHERE_DELETE,
        message: "Rule not found.",
        status: 404,
      });
    }

    return NextResponse.json({ id: data.id, deleted: true });
  },
);
