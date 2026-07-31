export type MeetingSignalRow = {
  action_items?: unknown;
  content?: string | null;
  decisions?: unknown;
  key_topics?: unknown;
  overview?: string | null;
  raw_text?: string | null;
  summary?: string | null;
  summary_bullets?: unknown;
  topics_discussed?: unknown;
};

export type MeetingSignalBuckets = {
  decisions: string[];
  promises: string[];
  risks: string[];
  unresolvedQuestions: string[];
};

function valuesFromUnknown(value: unknown): string[] {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      return valuesFromUnknown(JSON.parse(trimmed));
    } catch {
      return [trimmed];
    }
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => valuesFromUnknown(item));
  }

  if (value && typeof value === "object") {
    return Object.values(value).flatMap((item) => valuesFromUnknown(item));
  }

  return [];
}

export function meetingSignalText(row: MeetingSignalRow): string {
  return [
    row.content,
    row.summary,
    row.overview,
    row.raw_text,
    ...valuesFromUnknown(row.summary_bullets),
    ...valuesFromUnknown(row.decisions),
    ...valuesFromUnknown(row.action_items),
    ...valuesFromUnknown(row.key_topics),
    ...valuesFromUnknown(row.topics_discussed),
  ]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join("\n")
    .replace(/\s+/g, " ")
    .trim();
}

export function meetingSnippet(row: MeetingSignalRow, maxLength = 220): string | null {
  const normalized = meetingSignalText(row);
  if (!normalized) return null;
  const firstSentence = normalized.match(/^(.+?[.!?])\s/)?.[1] ?? normalized;
  return firstSentence.length > maxLength ? `${firstSentence.slice(0, maxLength).trim()}...` : firstSentence;
}

export function extractMeetingSignals(content: string, terms: RegExp, limit: number): string[] {
  if (!content) return [];
  const sentences = content
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  const matches = sentences.filter((sentence) => terms.test(sentence));
  return [...new Set(matches)].slice(0, limit);
}

export function buildMeetingSignalBuckets(rows: MeetingSignalRow[], limitPerRow = 3): MeetingSignalBuckets {
  const buckets: MeetingSignalBuckets = {
    decisions: [],
    promises: [],
    risks: [],
    unresolvedQuestions: [],
  };

  for (const row of rows) {
    const text = meetingSignalText(row);
    buckets.decisions.push(
      ...extractMeetingSignals(
        text,
        /\b(decided|decision|approved|rejected|agreed|confirmed|selected)\b/i,
        limitPerRow,
      ),
    );
    buckets.promises.push(
      ...extractMeetingSignals(
        text,
        /\b(action item|follow up|follow-up|needs to|must|assigned|due|by friday|by monday)\b/i,
        limitPerRow,
      ),
    );
    buckets.risks.push(
      ...extractMeetingSignals(
        text,
        /\b(risk|critical|blocked|delay|delayed|issue|concern|exposure|problem|missing|late|overdue)\b/i,
        limitPerRow,
      ),
    );
    buckets.unresolvedQuestions.push(
      ...extractMeetingSignals(
        text,
        /\b(question|unclear|unknown|confirm|verify|waiting|need answer|need clarification)\b/i,
        limitPerRow,
      ),
    );
  }

  return {
    decisions: [...new Set(buckets.decisions)],
    promises: [...new Set(buckets.promises)],
    risks: [...new Set(buckets.risks)],
    unresolvedQuestions: [...new Set(buckets.unresolvedQuestions)],
  };
}
