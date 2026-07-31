/**
 * Guardrails for URL path parameters.
 *
 * UUID path params can arrive as the nil UUID (all-zeros) when a caller fires
 * before the parent resource has finished loading. These guards catch that at
 * the API boundary — before any DB query — and return a clear 400 that is easy
 * to filter in telemetry, rather than a misleading 404 ("record not found").
 *
 * Usage:
 *   import { assertNonNilUuid } from "@/lib/guardrails/path-params";
 *   assertNonNilUuid(params.changeEventId, "changeEventId", "change-events/[changeEventId]/line-items#GET");
 */

import { GuardrailError } from "@/lib/guardrails/errors";

export const NIL_UUID = "00000000-0000-0000-0000-000000000000";

/**
 * Throws a GuardrailError (400 INVALID_PAYLOAD) if `value` is falsy or equals
 * the nil UUID. Call once per UUID path param at the top of every handler.
 *
 * Only use for UUID-typed params. Integer params (projectId, etc.) do not need
 * this guard — NaN from parseInt is already caught by the DB query returning 0
 * rows.
 */
export function assertNonNilUuid(
  value: string | undefined | null,
  paramName: string,
  where: string,
): asserts value is string {
  if (!value || value === NIL_UUID) {
    throw new GuardrailError({
      code: "INVALID_PAYLOAD",
      where,
      message: `${paramName} is missing or is the nil UUID. The caller likely fired before the parent resource finished loading.`,
      status: 400,
      severity: "low",
    });
  }
}
