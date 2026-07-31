import "server-only";
import { z } from "zod";

import { GuardrailError } from "@/lib/guardrails/errors";
import { getApiRouteUser } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { serviceDb } from "@/lib/supabase/service-db";
import { isOwnerEmail } from "@/lib/auth/owner";
import {
  INBOX_RULE_ACTIONS,
  INBOX_RULE_FIELDS,
  INBOX_RULE_OPERATORS,
  INBOX_RULE_PRIORITIES,
  type InboxRule,
} from "@/lib/email-assistant/inbox-rules";
import type { Database } from "@/types/database.types";

/**
 * The Outlook Draft Feedback surface tunes the assistant for Brandon's mailbox,
 * so his account is allowed alongside the workspace owner (and any app admin).
 */
export const INBOX_RULES_MAILBOX = "bclymer@alleatogroup.com";
const ALLOWED_EMAILS = [INBOX_RULES_MAILBOX];

export type InboxRuleRow =
  Database["public"]["Tables"]["outlook_inbox_rules"]["Row"];

/** Full DTO returned to clients — the pure-rule shape plus display metadata. */
export interface InboxRuleDto extends InboxRule {
  mailboxUserId: string;
  name: string | null;
  createdByEmail: string | null;
  createdAt: string;
  updatedAt: string;
}

export function rowToDto(row: InboxRuleRow): InboxRuleDto {
  return {
    id: row.id,
    field: row.match_field as InboxRule["field"],
    operator: row.match_operator as InboxRule["operator"],
    value: row.match_value,
    action: row.action as InboxRule["action"],
    actionValue: row.action_value,
    enabled: row.enabled,
    mailboxUserId: row.mailbox_user_id,
    name: row.name,
    createdByEmail: row.created_by_email,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const actionValueRefinement = (
  data: { action: string; actionValue?: string | null },
  ctx: z.RefinementCtx,
) => {
  if (data.action === "set_priority") {
    if (
      !data.actionValue ||
      !(INBOX_RULE_PRIORITIES as readonly string[]).includes(data.actionValue)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["actionValue"],
        message: "Choose a priority (urgent, high, normal, or low).",
      });
    }
  }
  if (data.action === "set_category" && !data.actionValue?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["actionValue"],
      message: "Choose a category.",
    });
  }
};

export const createInboxRuleSchema = z
  .object({
    name: z.string().trim().max(120).nullish(),
    field: z.enum(INBOX_RULE_FIELDS),
    operator: z.enum(INBOX_RULE_OPERATORS),
    value: z.string().trim().min(1, "Enter a value to match.").max(500),
    action: z.enum(INBOX_RULE_ACTIONS),
    actionValue: z.string().trim().max(120).nullish(),
    enabled: z.boolean().optional(),
  })
  .superRefine(actionValueRefinement);

export const updateInboxRuleSchema = z
  .object({
    name: z.string().trim().max(120).nullish(),
    field: z.enum(INBOX_RULE_FIELDS).optional(),
    operator: z.enum(INBOX_RULE_OPERATORS).optional(),
    value: z.string().trim().min(1).max(500).optional(),
    action: z.enum(INBOX_RULE_ACTIONS).optional(),
    actionValue: z.string().trim().max(120).nullish(),
    enabled: z.boolean().optional(),
  })
  // Only cross-validate action/value when the action itself is being changed.
  .superRefine((data, ctx) => {
    if (data.action) actionValueRefinement({ ...data, action: data.action }, ctx);
  });

export type CreateInboxRuleInput = z.infer<typeof createInboxRuleSchema>;
export type UpdateInboxRuleInput = z.infer<typeof updateInboxRuleSchema>;

export interface RulesRequestContext {
  userId: string;
  userEmail: string | null;
}

/**
 * Gate the rules API to the workspace owner, an app admin, or the mailbox owner
 * (Brandon). Mirrors the assistant-review route's posture: the routes use the
 * service client (bypassing RLS) and enforce access here.
 */
export async function requireRulesAccess(
  where: string,
): Promise<RulesRequestContext> {
  const user = await getApiRouteUser();
  if (!user) {
    throw new GuardrailError({
      code: "AUTH_EXPIRED",
      where,
      message: "Authentication required.",
      status: 401,
    });
  }

  const email = user.email?.trim().toLowerCase() ?? "";
  if (isOwnerEmail(user.email) || ALLOWED_EMAILS.includes(email)) {
    return { userId: user.id, userEmail: user.email ?? null };
  }

  const service = createServiceClient();
  const { data: profile } = await serviceDb.from("user_profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.is_admin === true) {
    return { userId: user.id, userEmail: user.email ?? null };
  }

  throw new GuardrailError({
    code: "FORBIDDEN",
    where,
    message: "Not authorized to manage inbox rules.",
    status: 403,
  });
}
