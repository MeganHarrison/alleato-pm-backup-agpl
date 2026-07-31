// Deprecated for write/delivery gating: outbound write confirmation and output redaction now belong to tools/outbound-action-policy.ts. Keep this module limited to inbox triage semantics.
export type EmailOperatorAction = "alert" | "reply" | "delegate" | "watch" | "suppress";

export type EmailOperatorTriage = {
  action: EmailOperatorAction;
  reason: string;
  suppressed: boolean;
  matchedRules: string[];
};

export type EmailOperatorInput = {
  subject?: string | null;
  fromName?: string | null;
  fromEmail?: string | null;
  preview?: string | null;
  bodyText?: string | null;
  hasAttachments?: boolean | null;
};

const OPERATOR_SIGNAL_TERMS = [
  "change order",
  "pco",
  "potential change order",
  "contract",
  "ln tp",
  "lntp",
  "limited notice to proceed",
  "proposal",
  "pay app",
  "payment application",
  "invoice",
  "billing",
  "retainage",
  "schedule",
  "deadline",
  "confirm",
  "approval",
  "approve",
  "signoff",
  "sign-off",
  "submittal",
  "rfi",
  "permit",
  "inspection",
  "pricing",
  "estimate",
  "scope",
  "client",
  "owner",
  "vendor decision",
];

const REPLY_SIGNAL_TERMS = [
  "can you",
  "please confirm",
  "confirm by",
  "need confirmation",
  "needs confirmation",
  "please review",
  "need your review",
  "approval needed",
  "action needed",
  "please advise",
  "let me know",
  "thoughts",
];

const SUPPRESS_RULES: Array<{
  id: string;
  pattern: RegExp;
  reason: string;
}> = [
  {
    id: "microsoft-quarantine-alert",
    pattern: /\b(microsoft\s*365|quarantine|quarantinemessaging|security alert|messages in quarantine)\b/i,
    reason: "Microsoft/security notification; suppress unless the user explicitly asks for security alerts.",
  },
  {
    id: "auth-sign-in-code",
    pattern: /\b(sign in|verification code|one-time code|password reset|mfa|multi-factor|2fa)\b/i,
    reason: "Authentication/admin notification; not an operator priority unless requested.",
  },
  {
    id: "generic-card-bank-alert",
    pattern: /\b(capital one|spend limit|approaching spend limit|credit card|card alert|payment is due)\b/i,
    reason: "Generic bank/card alert; suppress unless tied to a project payment decision.",
  },
  {
    id: "wealth-marketing-compliance",
    pattern: /\b(innovative private wealth|private wealth|compliance|welcome to|share-transfer|investor portal)\b/i,
    reason: "Investor/wealth/compliance marketing/admin item; suppress from Brandon project-operator triage.",
  },
  {
    id: "automated-newsletter",
    pattern: /\b(newsletter|unsubscribe|digest|daily summary|do not reply|no-reply|noreply)\b/i,
    reason: "Automated notification/newsletter; not a user-owned action by default.",
  },
];

function normalizeText(input: EmailOperatorInput): string {
  return [
    input.subject,
    input.fromName,
    input.fromEmail,
    input.preview,
    input.bodyText,
  ]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasAnyTerm(text: string, terms: string[]) {
  const lower = text.toLowerCase();
  return terms.some((term) => lower.includes(term));
}

export function triageEmailForOperator(input: EmailOperatorInput): EmailOperatorTriage {
  const text = normalizeText(input);
  const matchedSuppressionRules = SUPPRESS_RULES.filter((rule) => rule.pattern.test(text));
  const hasOperatorSignal = hasAnyTerm(text, OPERATOR_SIGNAL_TERMS);
  const hasReplySignal = hasAnyTerm(text, REPLY_SIGNAL_TERMS);

  if (matchedSuppressionRules.length > 0 && !hasOperatorSignal) {
    return {
      action: "suppress",
      reason: matchedSuppressionRules[0]?.reason ?? "Inbox noise suppressed by operator policy.",
      suppressed: true,
      matchedRules: matchedSuppressionRules.map((rule) => rule.id),
    };
  }

  if (hasReplySignal) {
    return {
      action: "reply",
      reason: "Contains a direct ask or confirmation request.",
      suppressed: false,
      matchedRules: [],
    };
  }

  if (hasOperatorSignal) {
    return {
      action: input.hasAttachments ? "delegate" : "watch",
      reason: input.hasAttachments
        ? "Project, money, scope, or contract signal with attachment/context to review."
        : "Project, money, scope, or contract signal worth watching.",
      suppressed: false,
      matchedRules: [],
    };
  }

  return {
    action: "watch",
    reason: "No suppression rule matched, but no direct owner action was detected.",
    suppressed: false,
    matchedRules: [],
  };
}

export const EMAIL_OPERATOR_RESPONSE_POLICY = [
  "For Brandon/operator inbox monitor prompts, important means a decision, project/client issue, money movement, contract/scope action, staffing/accountability item, deadline, or reputation risk.",
  "Do not elevate Microsoft quarantine/security notices, auth/sign-in codes, generic bank/card spend alerts, wealth/investor/compliance marketing, newsletters, or automated digests unless the user explicitly asks for those categories.",
  "Use clean spacing and short action lines. Do not crowd every item with labels like 'Why it matters' or 'Action'.",
  "Default sections are Alert now, Reply, Delegate, Watch, and Ignore/noise. Omit empty sections except say 'No Teams alert now' when nothing deserves escalation.",
  "Each surfaced item must include the thread/project cue, sender when useful, and one plain reason. If nothing deserves attention, say that plainly.",
].join("\n");
