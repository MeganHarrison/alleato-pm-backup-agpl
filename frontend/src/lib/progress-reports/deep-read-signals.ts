/**
 * Pure mapping from a daily-deep-read `projectRecord` to the `IntelligenceSignal[]`
 * shape the progress-report prompt builder consumes.
 *
 * This module deliberately has NO runtime dependencies (no `ai`, no Supabase) so
 * it can be unit-tested in isolation and imported cheaply. `ai-generate.ts` owns
 * the DB access that loads the record; this file owns the transform.
 */

export type IntelligenceSignal = {
  title: string;
  summary: string;
  whyItMatters: string | null;
  nextAction: string | null;
  evidence: Array<{
    sourceType: string;
    sourceTitle: string | null;
    excerpt: string | null;
    summary: string | null;
  }>;
};

function compactWhitespace(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function trimForPrompt(value: string | null | undefined, limit: number): string {
  const text = compactWhitespace(value);
  if (!text) return "";
  return text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asStringList(value: unknown, limit = 220): string[] {
  return asArray(value)
    .map((item) =>
      typeof item === "string" || typeof item === "number" ? trimForPrompt(String(item), limit) : "",
    )
    .filter((item): item is string => Boolean(item));
}

/**
 * Maps one daily-deep-read `projectRecord` into signals. Pure — no DB access.
 * Returns `[]` for an empty/degenerate record.
 */
export function mapDeepReadRecordToSignals(record: Record<string, unknown>): IntelligenceSignal[] {
  const whatChanged = trimForPrompt(String(record.whatChanged ?? ""), 500);
  const healthStatus = compactWhitespace(String(record.healthStatus ?? "")) || null;
  const needsAttention = asStringList(record.needsAttention);
  const openDecisions = asStringList(record.openDecisions);
  const activeRisks = asStringList(record.activeRisks);

  const signals: IntelligenceSignal[] = [];

  if (whatChanged) {
    const reads: IntelligenceSignal["evidence"] = (
      [
        ["Field read", record.fieldRead],
        ["Schedule read", record.scheduleRead],
        ["Financial read", record.financialRead],
      ] as const
    )
      .map(([label, value]) => {
        const summary = trimForPrompt(String(value ?? ""), 320);
        return summary
          ? { sourceType: "daily_deep_read", sourceTitle: label, excerpt: null, summary }
          : null;
      })
      .filter((entry): entry is IntelligenceSignal["evidence"][number] => entry !== null);

    signals.push({
      title: "What changed this week",
      summary: whatChanged,
      whyItMatters: healthStatus ? `Project health: ${healthStatus}` : null,
      nextAction: needsAttention[0] ?? openDecisions[0] ?? null,
      evidence: reads,
    });
  }

  for (const item of needsAttention.slice(0, 4)) {
    signals.push({ title: item, summary: item, whyItMatters: "Needs attention", nextAction: null, evidence: [] });
  }

  for (const item of activeRisks.slice(0, 4)) {
    signals.push({ title: item, summary: item, whyItMatters: "Active risk", nextAction: null, evidence: [] });
  }

  if (openDecisions.length) {
    signals.push({
      title: "Open decisions",
      summary: openDecisions.join("; "),
      whyItMatters: "Awaiting decision",
      nextAction: openDecisions[0] ?? null,
      evidence: [],
    });
  }

  return signals.slice(0, 8);
}
