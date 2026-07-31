import { GuardrailError } from "@/lib/guardrails/errors";

/**
 * Parses and validates a route's `projectId` path param into a positive
 * integer. Throws a 400-shaped GuardrailError (INVALID_PAYLOAD) when the
 * value isn't a finite positive number.
 */
export function parseProjectId(projectId: string, where: string): number {
  const numericProjectId = Number.parseInt(projectId, 10);
  if (!Number.isFinite(numericProjectId) || numericProjectId <= 0) {
    throw new GuardrailError({
      code: "INVALID_PAYLOAD",
      where,
      message: "Invalid project ID.",
    });
  }
  return numericProjectId;
}
