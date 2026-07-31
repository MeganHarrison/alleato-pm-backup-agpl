export const EXECUTIVE_BRIEF_MIN_BULLETS = 2;
export const EXECUTIVE_BRIEF_MAX_BULLETS = 4;

// Decimal points and dotted abbreviations must not be treated as sentence
// endings, or "7.7 feet" gets split into "7." and "7 feet". We temporarily
// swap the dot in number.number (and a few common abbreviations) for a private
// sentinel before any sentence splitting, then restore it.
const DECIMAL_SENTINEL = String.fromCharCode(1);

function protectInlineDots(value: string): string {
  return value
    .replace(/(\d)\.(\d)/g, `$1${DECIMAL_SENTINEL}$2`)
    .replace(/\b(No|Inc|Ltd|Co|St|Ave|Rd|Mr|Mrs|Ms|Dr|Jr|Sr|vs|approx|Ph)\.(\s)/gi, `$1${DECIMAL_SENTINEL}$2`);
}

function restoreInlineDots(value: string): string {
  return value.replace(new RegExp(DECIMAL_SENTINEL, "g"), ".");
}

export type ExecutiveBriefBulletInput = {
  summary?: string | null;
  bullets?: readonly (string | null | undefined)[];
  evidenceFacts?: readonly (string | null | undefined)[];
  recommendedAction?: string | null;
  whyItMatters?: string | null;
  status?: string | null;
  citations?: readonly { evidence?: string | null }[];
};

function normalizeText(value: unknown): string {
  return String(value ?? "")
    .replace(/[\n\r\t ]+/g, " ")
    .trim();
}

function compactCompleteText(value: string, maxLength = 220): string {
  const text = normalizeText(value)
    .replace(/^\s*(?:[-*]|\d+[.)])\s+/, "")
    .trim();
  if (text.length <= maxLength) return text;

  // Protect inline dots so we don't clip in the middle of "7.7" or "$1.5M".
  const protectedText = protectInlineDots(text);
  const clipped = protectedText.slice(0, maxLength);
  const sentenceEnd = Math.max(
    clipped.lastIndexOf("."),
    clipped.lastIndexOf("?"),
    clipped.lastIndexOf("!"),
  );
  if (sentenceEnd >= Math.min(80, maxLength - 1)) {
    return restoreInlineDots(clipped.slice(0, sentenceEnd + 1)).trim();
  }

  const lastSpace = clipped.lastIndexOf(" ");
  return restoreInlineDots(
    clipped.slice(0, lastSpace > 0 ? lastSpace : maxLength),
  ).trim();
}

function capitalize(value: string): string {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

function splitSentences(value: string): string[] {
  const protectedText = protectInlineDots(normalizeText(value));
  const parts = protectedText.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [];
  return parts.map((part) => restoreInlineDots(part).trim()).filter(Boolean);
}

function normalizeDeadlineOpening(value: string): string {
  const normalized = normalizeText(value).replace(/^the\s+/i, "");
  const deadlineMatch = normalized.match(
    /^tight\s+(.+?)\s+deadline\s+of\s+(.+?)([.!?])?$/i,
  );
  if (!deadlineMatch) return capitalize(normalized);

  const subject = deadlineMatch[1].trim();
  const date = deadlineMatch[2].trim();
  if (/permit drawing/i.test(subject)) {
    return `Permit drawings are due ${date}.`;
  }

  return `${capitalize(subject)} deadline is ${date}.`;
}

function removeMeetingProseLead(value: string): string {
  return normalizeText(value)
    .replace(
      /^(?:the\s+)?meeting\s+(?:focused|centered|covered)\s+(?:on\s+)?(?:critical\s+areas\s+affecting\s+project\s+progress,\s*)?(?:particularly\s+)?/i,
      "",
    )
    .replace(/^the\s+meeting\s+(?:was|is)\s+about\s+/i, "")
    .trim();
}

function cleanSentence(value: string): string {
  const withoutLead = removeMeetingProseLead(value);
  return compactCompleteText(normalizeDeadlineOpening(withoutLead), 240);
}

function hasDeadlineOrDate(value: string): boolean {
  return /\b(?:due|deadline|targeted|approval|approvals|by|before|after|late|early|June|July|August|September|October|November|December|January|February|March|April|May)\b|\b\d{1,2}(?:st|nd|rd|th)?\b/i.test(
    value,
  );
}

function hasBlockerOrDecision(value: string): boolean {
  return /\b(?:block|blocked|blocker|decision|approval|approve|concern|delay|pause|rework|depends|waiting|risk|affect|financing)\b/i.test(
    value,
  );
}

function splitParagraphIntoBullets(value: string): string[] {
  const sentences = splitSentences(value).map(cleanSentence).filter(Boolean);
  if (sentences.length <= 1) return sentences;

  const bullets: string[] = [];
  for (let index = 0; index < sentences.length; index += 1) {
    const current = sentences[index];
    const next = sentences[index + 1];
    if (
      next &&
      bullets.length === 0 &&
      hasDeadlineOrDate(current) &&
      hasBlockerOrDecision(next)
    ) {
      bullets.push(`${current.replace(/[.!?]$/, "")}; ${next}`);
      index += 1;
      continue;
    }

    bullets.push(current);
  }

  return bullets;
}

function pushUnique(target: string[], values: readonly string[]) {
  for (const value of values) {
    const normalized = compactCompleteText(value, 240);
    if (!normalized) continue;

    const key = normalized.toLowerCase().replace(/[.!?]$/, "");
    const exists = target.some(
      (existing) => existing.toLowerCase().replace(/[.!?]$/, "") === key,
    );
    if (!exists) target.push(normalized);
    if (target.length >= EXECUTIVE_BRIEF_MAX_BULLETS) return;
  }
}

function expandCandidate(value: string): string[] {
  const normalized = normalizeText(value);
  if (!normalized) return [];
  const sentences = splitSentences(normalized);
  if (sentences.length > 1 || normalized.length > 260) {
    return splitParagraphIntoBullets(normalized);
  }
  return [cleanSentence(normalized)];
}

export function getExecutiveBriefBullets(
  input: ExecutiveBriefBulletInput,
): string[] {
  // Trust the model's bullets. They are already written as clean, plain,
  // complete sentences by the synthesis prompt. We dedupe and cap them, but we
  // do NOT pad the list with the summary, recommended action, or "why it
  // matters" — that padding is what produced the repetitive trailing bullet
  // that restated the first one. The insight line is rendered separately from
  // whyItMatters, so it must never be folded back in as a bullet here.
  const bullets: string[] = [];

  pushUnique(
    bullets,
    (input.bullets ?? []).flatMap((value) =>
      value ? expandCandidate(value) : [],
    ),
  );

  // Only when the model returned no usable bullets at all, fall back to a
  // single summary-derived bullet so the item is never empty.
  if (bullets.length === 0 && input.summary) {
    pushUnique(bullets, expandCandidate(input.summary));
  }

  return bullets.slice(0, EXECUTIVE_BRIEF_MAX_BULLETS);
}
