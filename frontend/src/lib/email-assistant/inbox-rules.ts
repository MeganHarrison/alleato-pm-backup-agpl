/**
 * Inbox rules — Gmail/Outlook-style filters that train the assistant on how to
 * treat mail from a given sender / subject / body pattern.
 *
 * A rule is a single condition (`field` + `operator` + `value`) plus an
 * `action`. Rules are authored on the Outlook Draft Feedback surface and applied
 * deterministically when the inbox is served, so "always important" / "never
 * inbox" take effect immediately and also become a durable training signal for
 * the classifier.
 *
 * This module is pure (no I/O) so it can be unit-tested and shared between the
 * API layer (applying rules on read) and the rule-builder UI (preview).
 */

export const INBOX_RULE_FIELDS = [
  "sender",
  "sender_domain",
  "subject",
  "body",
  "any",
] as const;
export type InboxRuleField = (typeof INBOX_RULE_FIELDS)[number];

export const INBOX_RULE_OPERATORS = [
  "contains",
  "equals",
  "starts_with",
  "ends_with",
] as const;
export type InboxRuleOperator = (typeof INBOX_RULE_OPERATORS)[number];

export const INBOX_RULE_ACTIONS = [
  "always_important",
  "never_inbox",
  "set_priority",
  "set_category",
] as const;
export type InboxRuleAction = (typeof INBOX_RULE_ACTIONS)[number];

export const INBOX_RULE_PRIORITIES = [
  "urgent",
  "high",
  "normal",
  "low",
] as const;
export type InboxRulePriority = (typeof INBOX_RULE_PRIORITIES)[number];

export interface InboxRule {
  id: string;
  field: InboxRuleField;
  operator: InboxRuleOperator;
  value: string;
  action: InboxRuleAction;
  /** For set_priority / set_category — the priority level or category name. */
  actionValue: string | null;
  enabled: boolean;
}

/** The minimal email shape a rule is matched against. */
export interface InboxRuleEmailInput {
  fromEmail: string | null | undefined;
  subject: string | null | undefined;
  body: string | null | undefined;
}

export const INBOX_RULE_FIELD_LABELS: Record<InboxRuleField, string> = {
  sender: "Sender email",
  sender_domain: "Sender domain",
  subject: "Subject",
  body: "Body",
  any: "Anywhere",
};

export const INBOX_RULE_OPERATOR_LABELS: Record<InboxRuleOperator, string> = {
  contains: "contains",
  equals: "is exactly",
  starts_with: "starts with",
  ends_with: "ends with",
};

export const INBOX_RULE_ACTION_LABELS: Record<InboxRuleAction, string> = {
  always_important: "Always mark important",
  never_inbox: "Never let it reach the inbox",
  set_priority: "Set priority to",
  set_category: "Set category to",
};

function domainOf(email: string): string {
  const at = email.lastIndexOf("@");
  return at >= 0 ? email.slice(at + 1) : email;
}

/**
 * The text a rule's condition is tested against for a given field. `any` joins
 * sender + subject + body so a single value can match across all of them.
 */
function fieldText(email: InboxRuleEmailInput, field: InboxRuleField): string {
  const from = (email.fromEmail ?? "").trim();
  const subject = (email.subject ?? "").trim();
  const body = (email.body ?? "").trim();
  switch (field) {
    case "sender":
      return from;
    case "sender_domain":
      return from ? domainOf(from) : "";
    case "subject":
      return subject;
    case "body":
      return body;
    case "any":
      return [from, subject, body].join("\n");
    default:
      return "";
  }
}

function operatorMatches(
  haystack: string,
  operator: InboxRuleOperator,
  needle: string,
): boolean {
  const hay = haystack.toLowerCase();
  const need = needle.trim().toLowerCase();
  if (!need) return false;
  switch (operator) {
    case "contains":
      return hay.includes(need);
    case "equals":
      return hay === need;
    case "starts_with":
      return hay.startsWith(need);
    case "ends_with":
      return hay.endsWith(need);
    default:
      return false;
  }
}

/** Does a single (enabled) rule match this email? Disabled rules never match. */
export function emailMatchesRule(
  email: InboxRuleEmailInput,
  rule: InboxRule,
): boolean {
  if (!rule.enabled) return false;
  return operatorMatches(
    fieldText(email, rule.field),
    rule.operator,
    rule.value,
  );
}

export interface InboxRuleEffect {
  /** A rule forced this important (always_important). */
  important: boolean;
  /** A rule said this should never reach the inbox (never_inbox). */
  skipInbox: boolean;
  /** A rule overrode the priority. */
  priority: InboxRulePriority | null;
  /** A rule overrode the category. */
  category: string | null;
  /** Ids of every rule that matched, for attribution / display. */
  matchedRuleIds: string[];
}

const EMPTY_EFFECT: InboxRuleEffect = {
  important: false,
  skipInbox: false,
  priority: null,
  category: null,
  matchedRuleIds: [],
};

function isRulePriority(value: string | null): value is InboxRulePriority {
  return (
    value !== null &&
    (INBOX_RULE_PRIORITIES as readonly string[]).includes(value)
  );
}

/**
 * Reduce every matching rule into a single deterministic effect. Later matching
 * rules win for the priority/category overrides; `important` and `skipInbox` are
 * sticky (any matching rule can set them). Returns an empty effect when nothing
 * matches so callers can treat "no rules" as a no-op.
 */
export function applyInboxRules(
  email: InboxRuleEmailInput,
  rules: readonly InboxRule[],
): InboxRuleEffect {
  const matched = rules.filter((rule) => emailMatchesRule(email, rule));
  if (matched.length === 0) return { ...EMPTY_EFFECT };

  return matched.reduce<InboxRuleEffect>(
    (effect, rule) => {
      effect.matchedRuleIds.push(rule.id);
      switch (rule.action) {
        case "always_important":
          effect.important = true;
          break;
        case "never_inbox":
          effect.skipInbox = true;
          break;
        case "set_priority":
          if (isRulePriority(rule.actionValue)) {
            effect.priority = rule.actionValue;
          }
          break;
        case "set_category":
          if (rule.actionValue && rule.actionValue.trim()) {
            effect.category = rule.actionValue.trim();
          }
          break;
        default:
          break;
      }
      return effect;
    },
    { ...EMPTY_EFFECT, matchedRuleIds: [] },
  );
}

/** Human-readable one-line summary of a rule, for tables and confirmations. */
export function describeInboxRule(rule: InboxRule): string {
  const condition = `${INBOX_RULE_FIELD_LABELS[rule.field]} ${INBOX_RULE_OPERATOR_LABELS[rule.operator]} "${rule.value}"`;
  const action =
    rule.action === "set_priority" || rule.action === "set_category"
      ? `${INBOX_RULE_ACTION_LABELS[rule.action]} ${rule.actionValue ?? ""}`.trim()
      : INBOX_RULE_ACTION_LABELS[rule.action];
  return `When ${condition} → ${action}`;
}
