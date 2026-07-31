import type { Json } from "@/types/database.types";

/**
 * Safely cast an unknown value to a record. Returns `{}` for nullish,
 * primitives, and arrays — the three shapes that are never records.
 */
export function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/**
 * Safely cast an unknown value to an array. Returns `[]` for non-arrays.
 */
export function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/**
 * Variant of `asRecord` for Supabase `Json` columns which include `null`
 * in their union. Semantically identical — the cast is the only difference.
 */
export function toRecord(value: Json | null): Record<string, unknown> {
  return asRecord(value);
}

/**
 * Strip HTML entities, markdown formatting, message/date tags, and
 * collapse whitespace from a string.
 */
export function cleanText(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\[message:[^\]]+\]/gi, "")
    .replace(/\[\d{4}-\d{2}-\d{2}[^\]]+\]/g, "")
    .replace(/(?:^|\s)#{1,6}\s+/gm, " ")
    .replace(/\*{1,3}([^*]*)\*{1,3}/g, "$1")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Light HTML-entity cleanup for source preview text. Returns `null` for
 * empty/whitespace-only input (unlike `cleanText` which returns `""`).
 */
export function cleanSourcePreview(value: string | null | undefined): string | null {
  if (!value) return null;
  const cleaned = value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
  return cleaned || null;
}

/**
 * Lowercase + strip non-alphanumeric characters from a preview string.
 * Used for heuristic content classification (e.g. metadata-only detection).
 */
export function normalizePreview(value: string | null | undefined): string {
  return cleanSourcePreview(value)
    ?.toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim() ?? "";
}

/**
 * Returns `true` when a source preview contains only email/meeting
 * metadata headers (subject, from, to, date, duration) rather than
 * substantive content.
 */
export function isMetadataOnlyPreview(value: string | null | undefined): boolean {
  const text = normalizePreview(value);
  return (
    text.startsWith("subject ") ||
    (text.includes(" subject ") && text.includes(" from ")) ||
    (text.includes(" date ") && text.includes(" from ") && text.includes(" to ")) ||
    (
      text.includes("duration") &&
      text.includes("organizer email") &&
      (text.includes("fireflies link") || text.includes("participants"))
    )
  );
}

const LOW_SIGNAL_PLACEHOLDERS = [
  "this source contains project-relevant language that should be reviewed before it is trusted in a current intelligence packet.",
  "review the source attribution and extracted signal, then promote or reject it.",
] as const;

/**
 * Returns `true` when text is too short, matches a known placeholder,
 * or consists mainly of metadata (emails, dates, spaced letters) rather
 * than substantive content.
 */
export function isLowSignalText(value: string | null | undefined): boolean {
  const text = cleanText(value).toLowerCase();
  if (!text) return true;
  const emailCount = text.match(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/g)?.length ?? 0;
  const dateCount = text.match(/\b(?:mon|tue|wed|thu|fri|sat|sun)\b|\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g)?.length ?? 0;
  const spacedLetters = text.match(/\b(?:[a-z]\s){4,}[a-z]\b/g)?.length ?? 0;

  return (
    text.length < 24 ||
    (LOW_SIGNAL_PLACEHOLDERS as readonly string[]).includes(text) ||
    (text.includes(" duration:") && text.includes(" participants:")) ||
    (text.includes(" date:") && text.includes(" participants:") && emailCount >= 2) ||
    text.startsWith("subject:") ||
    (text.includes("active intelligence card") && text.includes("top signal")) ||
    text.includes("no clean synthesis has been compiled") ||
    emailCount >= 5 ||
    dateCount >= 8 ||
    spacedLetters > 0
  );
}

/**
 * Return the first value (after cleaning) that passes the low-signal filter.
 */
export function firstStrategicText(...values: Array<string | null | undefined>): string {
  for (const value of values) {
    const text = cleanText(value);
    if (text && !isLowSignalText(text)) return text;
  }
  return "";
}

/**
 * Truncate cleaned text at a sentence boundary when it exceeds `maxLength`.
 */
export function summarizeText(value: string, maxLength = 360): string {
  const text = cleanText(value);
  if (text.length <= maxLength) return text;
  const truncated = text.slice(0, maxLength);
  const lastSentence = Math.max(
    truncated.lastIndexOf("."),
    truncated.lastIndexOf("?"),
    truncated.lastIndexOf("!"),
  );
  if (lastSentence > 180) return truncated.slice(0, lastSentence + 1);
  return `${truncated.trim()}...`;
}

/**
 * Classify a raw source-description string into a canonical category.
 * Both `sourceCoverageCategory` (packet-service) and `communicationSource`
 * (project-tools) reduce to this logic — call sites build `raw` from
 * whichever fields their domain object exposes.
 */
export function sourceCoverageCategory(raw: string): string {
  const lower = raw.toLowerCase();
  if (lower.includes("meeting") || lower.includes("fireflies") || lower.includes("transcript")) return "meeting";
  if (lower.includes("email") || lower.includes("outlook")) return "email";
  if (lower.includes("teams") || lower.includes("chat") || lower.includes("message")) return "teams";
  if (lower.includes("rfi")) return "rfi";
  if (lower.includes("submittal")) return "submittal";
  if (lower.includes("drawing")) return "drawing";
  if (lower.includes("spec")) return "specification";
  if (lower.includes("daily")) return "daily_report";
  if (lower.includes("task")) return "task";
  if (lower.includes("risk")) return "risk";
  return "document";
}

/**
 * The compiler version string that the fast-path gate checks against.
 * Centralised so a version bump cannot silently disable the fast path.
 */
export const CURRENT_COMPILER_VERSION = "project_intelligence_synthesis_v1" as const;
