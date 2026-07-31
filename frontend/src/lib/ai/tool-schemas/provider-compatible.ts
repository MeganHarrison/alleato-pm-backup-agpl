import { z } from "zod";

const PROVIDER_SAFE_EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const PROVIDER_SAFE_ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const PROVIDER_SAFE_OPTIONAL_ISO_DATE_PATTERN =
  /^$|^\d{4}-\d{2}-\d{2}$/;

function isIsoCalendarDate(value: string): boolean {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

/**
 * Email schema for AI tool inputs.
 *
 * Zod's built-in email validator serializes to a JSON Schema regex containing
 * lookarounds. The OpenAI tool-schema dialect rejects lookarounds before any
 * tool can run, so assistant tools must use this provider-compatible pattern.
 */
export const providerCompatibleEmailSchema = z
  .string()
  .trim()
  .min(3)
  .max(320)
  .regex(PROVIDER_SAFE_EMAIL_PATTERN, "Invalid email address");

export const providerCompatibleIsoDateSchema = z
  .string()
  .regex(
    PROVIDER_SAFE_ISO_DATE_PATTERN,
    "Expected an ISO date in YYYY-MM-DD format",
  )
  .refine(isIsoCalendarDate, "Invalid calendar date");

export const providerCompatibleOptionalIsoDateSchema = z
  .string()
  .regex(
    PROVIDER_SAFE_OPTIONAL_ISO_DATE_PATTERN,
    "Expected a blank value or an ISO date in YYYY-MM-DD format",
  )
  .refine(
    (value) => value === "" || isIsoCalendarDate(value),
    "Invalid calendar date",
  );
