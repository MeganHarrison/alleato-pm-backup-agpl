import { serviceDb } from "@/lib/supabase/service-db";

/**
 * On-demand cheap assembly of a project's weekly progress-report sections from
 * the latest daily deep read — the same reshape the nightly consumer does
 * (`project-intelligence/projections/daily-deep-read-consumers.mjs`), but for a single
 * project so a PM can pull the newest content without waiting for the cron and
 * without paying for a gpt-5.5 re-synthesis.
 *
 * Keep the field→section mapping here in sync with that script's
 * `assembleProgressSections`.
 */

const DAILY_DEEP_READ_TARGET_SLUG = "daily-executive-brief";

export interface AssembledProgressSections {
  past_week_highlights: string;
  upcoming_week_activities: string;
  open_items: string;
  internal_notes: string | null;
}

function stripCitations(value: unknown): string {
  return String(value ?? "")
    .replace(/`S\d+`/g, "")
    .replace(/\[S\d+\]/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+([.,;:])/g, "$1")
    .trim();
}

function titles(value: unknown): string[] {
  return (Array.isArray(value) ? value : [])
    .map((item) => stripCitations(item))
    .filter(Boolean);
}

function bulletize(lines: string[]): string {
  return lines.map((line) => line.trim()).filter(Boolean).map((line) => `- ${line}`).join("\n");
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

/** Pure mapping — mirrors the consumer's assembleProgressSections. */
export function assembleSectionsFromRecord(record: Record<string, unknown>): AssembledProgressSections | null {
  const whatChanged = titles(
    record.whatChanged ? (Array.isArray(record.whatChanged) ? record.whatChanged : [record.whatChanged]) : [],
  );
  const fieldRead = stripCitations(record.fieldRead);
  const scheduleRead = stripCitations(record.scheduleRead);
  const financialRead = stripCitations(record.financialRead);
  const highlights = [
    ...whatChanged,
    fieldRead ? `**Field:** ${fieldRead}` : "",
    scheduleRead ? `**Schedule:** ${scheduleRead}` : "",
    financialRead ? `**Financial:** ${financialRead}` : "",
  ].filter(Boolean);
  const upcoming = titles(record.needsAttention);
  const open = titles(record.openDecisions);
  const internal = titles(record.activeRisks);

  if (!highlights.length && !upcoming.length && !open.length && !internal.length) return null;
  return {
    past_week_highlights: bulletize(highlights),
    upcoming_week_activities: bulletize(upcoming),
    open_items: open.length ? bulletize(open) : "- No open items requiring client action this week.",
    internal_notes: internal.length ? bulletize(internal) : null,
  };
}

/**
 * Loads the current daily-deep-read packet and assembles this project's sections.
 * Returns null when the project has no record in the latest packet.
 */
export async function assembleProgressReportFromDeepRead(
  projectId: number,
): Promise<AssembledProgressSections | null> {
  const { data: target } = await serviceDb
    .from("intelligence_targets")
    .select("id")
    .eq("slug", DAILY_DEEP_READ_TARGET_SLUG)
    .maybeSingle();
  if (!target?.id) return null;

  const { data: packet } = await serviceDb
    .from("intelligence_packets")
    .select("packet_json")
    .eq("target_id", target.id)
    .eq("packet_type", "current")
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const records = asRecord((packet as { packet_json?: unknown } | null)?.packet_json).projectRecords;
  const record = (Array.isArray(records) ? records : [])
    .map(asRecord)
    .find((row) => Number(row.projectId) === projectId);
  if (!record) return null;

  return assembleSectionsFromRecord(record);
}
