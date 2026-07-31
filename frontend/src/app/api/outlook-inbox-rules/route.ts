export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { withApiGuardrails, parseJsonBody } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { serviceDb } from "@/lib/supabase/service-db";
import {
  INBOX_RULES_MAILBOX,
  createInboxRuleSchema,
  requireRulesAccess,
  rowToDto,
  type InboxRuleRow,
} from "./_shared";

const WHERE_GET = "api/outlook-inbox-rules#GET";
const WHERE_POST = "api/outlook-inbox-rules#POST";

export const GET = withApiGuardrails(WHERE_GET, async () => {
  await requireRulesAccess(WHERE_GET);

  const { data, error } = await serviceDb.from("outlook_inbox_rules")
    .select("*")
    .eq("mailbox_user_id", INBOX_RULES_MAILBOX)
    .order("created_at", { ascending: false });

  if (error) {
    throw new GuardrailError({
      code: "INTERNAL_ERROR",
      where: WHERE_GET,
      message: error.message,
    });
  }

  return NextResponse.json({
    rules: (data ?? []).map((row) => rowToDto(row as InboxRuleRow)),
  });
});

export const POST = withApiGuardrails(WHERE_POST, async ({ request }) => {
  const { userId, userEmail } = await requireRulesAccess(WHERE_POST);
  const input = await parseJsonBody(request, createInboxRuleSchema, WHERE_POST);

  const { data, error } = await serviceDb.from("outlook_inbox_rules")
    .insert({
      mailbox_user_id: INBOX_RULES_MAILBOX,
      name: input.name?.trim() ? input.name.trim() : null,
      match_field: input.field,
      match_operator: input.operator,
      match_value: input.value,
      action: input.action,
      action_value: input.actionValue?.trim() ? input.actionValue.trim() : null,
      enabled: input.enabled ?? true,
      created_by: userId,
      created_by_email: userEmail,
    })
    .select("*")
    .single();

  if (error) {
    throw new GuardrailError({
      code: "INTERNAL_ERROR",
      where: WHERE_POST,
      message: error.message,
    });
  }

  return NextResponse.json(rowToDto(data as InboxRuleRow), { status: 201 });
});
