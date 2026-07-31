export const ANNOTATION_TYPES = [
  "pen",
  "highlighter",
  "rectangle",
  "cloud",
  "arrow",
  "text",
  "note",
] as const;

export type AnnotationType = (typeof ANNOTATION_TYPES)[number];

export function isAnnotationType(value: unknown): value is AnnotationType {
  return (
    typeof value === "string" &&
    (ANNOTATION_TYPES as readonly string[]).includes(value)
  );
}

export function isPdfPageMarkupData(
  value: unknown,
): value is Record<string, unknown> & { page_percent: true } {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    (value as { page_percent?: unknown }).page_percent === true
  );
}
