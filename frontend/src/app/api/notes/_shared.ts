import { GuardrailError } from "@/lib/guardrails/errors";
import { requirePermission } from "@/lib/permissions-guard";
import type { PermissionLevel } from "@/lib/permissions-shared";

export const NOTES_SELECT =
  "id, project_id, title, body, archived, created_at, created_by, updated_at";

export function parsePositiveId(
  value: unknown,
  field: "project" | "page",
  where: string,
): number {
  const raw = typeof value === "number" ? String(value) : value;
  if (typeof raw !== "string" || !/^[1-9]\d*$/.test(raw)) {
    throw new GuardrailError({
      code: "VALIDATION_ERROR",
      where,
      message: `A valid ${field} id is required.`,
      status: 400,
      details: { field, value },
    });
  }

  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed)) {
    throw new GuardrailError({
      code: "VALIDATION_ERROR",
      where,
      message: `A valid ${field} id is required.`,
      status: 400,
      details: { field, value },
    });
  }

  return parsed;
}

export async function requirePagesPermission(
  projectId: number,
  level: Extract<PermissionLevel, "read" | "write">,
) {
  return requirePermission(projectId, "documents", level);
}

export function throwNotesDatabaseError(
  action: string,
  where: string,
  error: {
    code?: string;
    message: string;
    details?: string | null;
    hint?: string | null;
  },
): never {
  const notFound = error.code === "PGRST116";
  throw new GuardrailError({
    code: notFound ? "NOT_FOUND" : "INTERNAL_ERROR",
    where,
    message: notFound
      ? "The requested project page was not found."
      : `Failed to ${action} the project page.`,
    status: notFound ? 404 : 500,
    details: {
      databaseCode: error.code,
      reason: error.message,
      databaseDetails: error.details,
      hint: error.hint,
    },
    cause: error,
  });
}
