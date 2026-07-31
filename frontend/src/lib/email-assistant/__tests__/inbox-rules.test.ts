import {
  applyInboxRules,
  describeInboxRule,
  emailMatchesRule,
  type InboxRule,
} from "@/lib/email-assistant/inbox-rules";

function rule(overrides: Partial<InboxRule> = {}): InboxRule {
  return {
    id: "r1",
    field: "sender",
    operator: "contains",
    value: "acme.com",
    action: "always_important",
    actionValue: null,
    enabled: true,
    ...overrides,
  };
}

const email = {
  fromEmail: "jane@acme.com",
  subject: "Invoice #42 overdue",
  body: "Please remit payment for the attached invoice.",
};

describe("emailMatchesRule", () => {
  it("matches on sender substring, case-insensitively", () => {
    expect(emailMatchesRule(email, rule({ value: "ACME.com" }))).toBe(true);
  });

  it("matches the sender domain via sender_domain", () => {
    expect(
      emailMatchesRule(email, {
        ...rule(),
        field: "sender_domain",
        operator: "equals",
        value: "acme.com",
      }),
    ).toBe(true);
  });

  it("does not match a different domain", () => {
    expect(
      emailMatchesRule(
        { ...email, fromEmail: "bob@other.com" },
        { ...rule(), field: "sender_domain", operator: "equals", value: "acme.com" },
      ),
    ).toBe(false);
  });

  it("matches subject and body via the field selector", () => {
    expect(
      emailMatchesRule(email, { ...rule(), field: "subject", value: "overdue" }),
    ).toBe(true);
    expect(
      emailMatchesRule(email, { ...rule(), field: "body", value: "payment" }),
    ).toBe(true);
  });

  it("`any` searches across sender, subject and body", () => {
    expect(
      emailMatchesRule(email, { ...rule(), field: "any", value: "invoice" }),
    ).toBe(true);
  });

  it("supports starts_with / ends_with / equals operators", () => {
    expect(
      emailMatchesRule(email, { ...rule(), field: "subject", operator: "starts_with", value: "Invoice" }),
    ).toBe(true);
    expect(
      emailMatchesRule(email, { ...rule(), field: "subject", operator: "ends_with", value: "overdue" }),
    ).toBe(true);
    expect(
      emailMatchesRule(email, { ...rule(), field: "sender", operator: "equals", value: "jane@acme.com" }),
    ).toBe(true);
  });

  it("never matches a disabled rule", () => {
    expect(emailMatchesRule(email, rule({ enabled: false }))).toBe(false);
  });

  it("never matches on an empty value", () => {
    expect(emailMatchesRule(email, rule({ value: "  " }))).toBe(false);
  });

  it("handles missing email fields without throwing", () => {
    expect(
      emailMatchesRule(
        { fromEmail: null, subject: undefined, body: null },
        rule({ field: "any", value: "anything" }),
      ),
    ).toBe(false);
  });
});

describe("applyInboxRules", () => {
  it("returns an empty (no-op) effect when nothing matches", () => {
    const effect = applyInboxRules(email, [rule({ value: "nomatch.com" })]);
    expect(effect).toEqual({
      important: false,
      skipInbox: false,
      priority: null,
      category: null,
      matchedRuleIds: [],
    });
  });

  it("marks important and records the matched rule id", () => {
    const effect = applyInboxRules(email, [rule({ id: "imp" })]);
    expect(effect.important).toBe(true);
    expect(effect.matchedRuleIds).toEqual(["imp"]);
  });

  it("flags skipInbox for a never_inbox rule", () => {
    const effect = applyInboxRules(email, [
      rule({ id: "skip", action: "never_inbox" }),
    ]);
    expect(effect.skipInbox).toBe(true);
  });

  it("applies set_priority / set_category action values, later match wins", () => {
    const effect = applyInboxRules(email, [
      rule({ id: "p1", action: "set_priority", actionValue: "low" }),
      rule({ id: "p2", action: "set_priority", actionValue: "urgent" }),
      rule({ id: "c1", action: "set_category", actionValue: "Accounting" }),
    ]);
    expect(effect.priority).toBe("urgent");
    expect(effect.category).toBe("Accounting");
    expect(effect.matchedRuleIds).toEqual(["p1", "p2", "c1"]);
  });

  it("ignores an invalid priority action value", () => {
    const effect = applyInboxRules(email, [
      rule({ action: "set_priority", actionValue: "sizzling" }),
    ]);
    expect(effect.priority).toBeNull();
  });

  it("combines important + skipInbox across multiple matching rules", () => {
    const effect = applyInboxRules(email, [
      rule({ id: "a", action: "always_important" }),
      rule({ id: "b", field: "subject", value: "invoice", action: "never_inbox" }),
    ]);
    expect(effect.important).toBe(true);
    expect(effect.skipInbox).toBe(true);
    expect(effect.matchedRuleIds).toEqual(["a", "b"]);
  });
});

describe("describeInboxRule", () => {
  it("renders a readable summary for a simple action", () => {
    expect(describeInboxRule(rule({ field: "sender_domain", operator: "equals", value: "acme.com" }))).toBe(
      'When Sender domain is exactly "acme.com" → Always mark important',
    );
  });

  it("includes the action value for set_priority", () => {
    expect(
      describeInboxRule(rule({ action: "set_priority", actionValue: "urgent" })),
    ).toBe('When Sender email contains "acme.com" → Set priority to urgent');
  });
});
