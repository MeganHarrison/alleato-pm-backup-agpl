/**
 * PII redaction for data sent to Langfuse (us.cloud — a third-party processor).
 *
 * Traces carry real email content, contact details, and answers. We redact
 * personal identifiers (emails, SSNs, card/phone numbers) before egress.
 *
 * Deliberately does NOT mask dollar amounts, budgets, or project/financial data:
 * that business data is the whole point of the observability, and masking it
 * would make traces useless for debugging. PII ≠ business data.
 *
 * Wired in two places (the two egress paths):
 *  - `instrumentation.ts` → `new LangfuseSpanProcessor({ mask })` (OTel main path)
 *  - `langfuse-trace.ts`   → `new Langfuse({ mask })` (v3 deep-agent path + scores)
 */
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const SSN = /\b\d{3}-\d{2}-\d{4}\b/g;
// 16-digit card, optionally grouped 4-4-4-4. Redact before PHONE.
const CARD = /\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/g;
// US phone with explicit separators (requires separators to avoid eating IDs).
const PHONE = /\b\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}\b/g;

export function redactPII(text: string): string {
  return text
    .replace(EMAIL, "***EMAIL***")
    .replace(SSN, "***SSN***")
    .replace(CARD, "***CARD***")
    .replace(PHONE, "***PHONE***");
}

/**
 * Langfuse mask callback. Receives `{ data }` — a string (OTel passes the
 * stringified JSON of the attribute; v3 passes string input/output values).
 * Non-string values pass through unchanged.
 */
export function maskLangfuse({ data }: { data: unknown }): unknown {
  return typeof data === "string" ? redactPII(data) : data;
}
