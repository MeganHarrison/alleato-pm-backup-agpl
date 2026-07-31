export type BrandonAssistantAction = "reply" | "delegate" | "watch" | "ignore";
export type BrandonAssistantPriority = "urgent" | "high" | "normal" | "low";

export interface BrandonEmailTriageInput {
  subject: string | null;
  bodyText: string | null;
  fromEmail: string | null;
  fromName: string | null;
  toList: string[] | null;
  ccList: string[] | null;
  mailboxUserId: string | null;
  hasAttachments: boolean | null;
  receivedAt: string | null;
}

export interface BrandonEmailAssistantDecision {
  action: BrandonAssistantAction;
  priority: BrandonAssistantPriority;
  score: number;
  reason: string;
  owner: string;
  risk: string;
  evidence: string;
  rulesApplied: string[];
}

const BRANDON_EMAIL = "bclymer@alleatogroup.com";

const NOISE_TOKENS = [
  "noreply",
  "no-reply",
  "do not reply",
  "donotreply",
  "notification",
  "newsletter",
  "digest",
  "daily summary",
  "message center",
  "security alert",
  "sign-in",
  "signin",
];

const REQUEST_TOKENS = [
  "?",
  "please",
  "can you",
  "could you",
  "would you",
  "let me know",
  "confirm",
  "advise",
  "review",
  "approve",
  "approval",
  "send me",
  "need your",
  "what works",
  "does this work",
  "are you available",
  "your thoughts",
];

const DEADLINE_TOKENS = [
  "today",
  "tomorrow",
  "eod",
  "end of day",
  "this afternoon",
  "this morning",
  "before noon",
  "asap",
  "urgent",
  "deadline",
  "by ",
  "due ",
];

const RISK_TOKENS = [
  "payment",
  "pay application",
  "invoice",
  "wire",
  "ach",
  "lien",
  "legal",
  "claim",
  "contract",
  "change order",
  "schedule",
  "delay",
  "safety",
  "insurance",
  "certificate",
  "permit",
  "appeal",
];

function includesAny(text: string, tokens: string[]): boolean {
  return tokens.some((token) => text.includes(token));
}

function cleanEvidenceText(text: string): string {
  const withoutHeaderLines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => {
      if (!line) return false;
      return !/^(subject|date|from|to|cc|bcc|sent|received):\s/i.test(line);
    })
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  return withoutHeaderLines
    .replace(/\s(?:Subject|Date|From|To|Cc|Bcc|Sent|Received):\s.+$/, "")
    .trim();
}

function excerpt(text: string): string {
  const normalized = cleanEvidenceText(text);
  if (!normalized) return "Subject and sender metadata only.";
  return normalized.length > 140 ? `${normalized.slice(0, 137)}...` : normalized;
}

function normalizeEmail(value: string | null): string {
  return (value ?? "").trim().toLowerCase();
}

function isInternalEmail(value: string | null): boolean {
  return normalizeEmail(value).endsWith("@alleatogroup.com");
}

function isRecipient(list: string[] | null, target: string): boolean {
  return (list ?? []).some((entry) => normalizeEmail(entry).includes(target));
}

function buildRulesApplied({
  internalSender,
  sentDirectlyToBrandon,
  copiedToBrandon,
  automated,
  asksForAction,
  timeSensitive,
  businessRisk,
  hasAttachment,
}: {
  internalSender: boolean;
  sentDirectlyToBrandon: boolean;
  copiedToBrandon: boolean;
  automated: boolean;
  asksForAction: boolean;
  timeSensitive: boolean;
  businessRisk: boolean;
  hasAttachment: boolean;
}): string[] {
  const rules: string[] = [];
  rules.push(internalSender ? "Internal sender" : "External sender");
  if (sentDirectlyToBrandon) rules.push("Sent to Brandon");
  if (copiedToBrandon) rules.push("Brandon copied");
  if (asksForAction) rules.push("Action language");
  if (timeSensitive) rules.push("Deadline language");
  if (businessRisk) rules.push("Project/risk terms");
  if (hasAttachment) rules.push("Attachment present");
  if (automated) rules.push("Automated/no-reply pattern");
  return rules;
}

export function deriveBrandonEmailAssistantDecision(
  input: BrandonEmailTriageInput,
): BrandonEmailAssistantDecision {
  const subject = input.subject ?? "";
  const bodyText = input.bodyText ?? "";
  const text = `${subject}\n${bodyText}`.toLowerCase();
  const sender = normalizeEmail(input.fromEmail);
  const internalSender = isInternalEmail(sender);
  const sentDirectlyToBrandon =
    isRecipient(input.toList, BRANDON_EMAIL) ||
    normalizeEmail(input.mailboxUserId) === BRANDON_EMAIL;
  const copiedToBrandon = isRecipient(input.ccList, BRANDON_EMAIL);
  const automated = includesAny(`${sender} ${text}`, NOISE_TOKENS);
  const asksForAction = includesAny(text, REQUEST_TOKENS);
  const timeSensitive = includesAny(text, DEADLINE_TOKENS);
  const businessRisk = includesAny(text, RISK_TOKENS);
  const hasAttachment = input.hasAttachments === true;
  const rulesApplied = buildRulesApplied({
    internalSender,
    sentDirectlyToBrandon,
    copiedToBrandon,
    automated,
    asksForAction,
    timeSensitive,
    businessRisk,
    hasAttachment,
  });

  let score = 0;
  if (sentDirectlyToBrandon) score += 25;
  if (copiedToBrandon) score += 8;
  if (!internalSender) score += 18;
  if (asksForAction) score += 28;
  if (timeSensitive) score += 24;
  if (businessRisk) score += 20;
  if (hasAttachment) score += 8;
  if (automated) score -= 45;

  if (automated && !businessRisk) {
    return {
      action: "ignore",
      priority: "low",
      score: Math.max(0, score),
      reason: "Automated or broadcast message with no clear Brandon action.",
      owner: "No action",
      risk: "Low",
      evidence: excerpt(`${subject}\n${bodyText}`),
      rulesApplied,
    };
  }

  const priority: BrandonAssistantPriority =
    score >= 82 ? "urgent" : score >= 60 ? "high" : score >= 32 ? "normal" : "low";

  if (!internalSender && sentDirectlyToBrandon && (asksForAction || timeSensitive)) {
    return {
      action: "reply",
      priority,
      score,
      reason: timeSensitive
        ? "External sender needs a time-sensitive Brandon response."
        : "External sender is asking Brandon for a response.",
      owner: "Brandon",
      risk: businessRisk ? "Business decision or project risk in thread." : "Relationship follow-up.",
      evidence: excerpt(`${subject}\n${bodyText}`),
      rulesApplied,
    };
  }

  if (internalSender && (asksForAction || timeSensitive || businessRisk)) {
    return {
      action: "delegate",
      priority,
      score,
      reason: "Internal message needs routing, approval, or a clear owner.",
      owner: "Alleato team",
      risk: businessRisk ? "Operational or financial item can stall if unowned." : "Internal follow-up can stall.",
      evidence: excerpt(`${subject}\n${bodyText}`),
      rulesApplied,
    };
  }

  if (businessRisk || timeSensitive || hasAttachment) {
    return {
      action: "watch",
      priority,
      score,
      reason: businessRisk
        ? "Contains project, legal, schedule, or payment language worth tracking."
        : "Worth monitoring but not enough evidence for a Brandon reply.",
      owner: "Assistant review",
      risk: businessRisk ? "Potential missed commitment." : "Context may matter later.",
      evidence: excerpt(`${subject}\n${bodyText}`),
      rulesApplied,
    };
  }

  return {
    action: "ignore",
    priority,
    score: Math.max(0, score),
    reason: "No clear ask, risk, or next action detected.",
    owner: "No action",
    risk: "Low",
    evidence: excerpt(`${subject}\n${bodyText}`),
    rulesApplied,
  };
}
