import { z } from "zod";

const PUNCH_ITEM_STATUSES = ["draft", "work_required", "initiated", "closed"] as const;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// Sensitive data-write guardrail: collapse blank optional inputs to null before they reach Postgres.
function normalizeBlankToNull(value: unknown): unknown {
  return typeof value === "string" && value.trim() === "" ? null : value;
}

// This helper validates optional text fields while allowing the UI to submit blank strings safely.
function nullableTextField() {
  return z.preprocess(normalizeBlankToNull, z.string().optional().nullable());
}

// This helper validates optional UUID fields while allowing cleared selections to serialize as null.
function nullableUuidField() {
  return z.preprocess(normalizeBlankToNull, z.string().uuid().optional().nullable());
}

// This helper validates optional numeric fields, coercing blank/typed input to a number or null.
function nullableNumberField() {
  return z.preprocess((value) => {
    if (value === null || value === undefined) return null;
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed === "") return null;
      const parsed = Number(trimmed);
      return Number.isNaN(parsed) ? trimmed : parsed;
    }
    return value;
  }, z.number().optional().nullable());
}

// This helper validates optional date fields and rejects non-ISO values before the DB insert/update.
function nullableDateField() {
  return z.preprocess(
    (value) => {
      if (typeof value !== "string") {
        return normalizeBlankToNull(value);
      }
      const trimmed = value.trim();
      return trimmed === "" ? null : trimmed;
    },
    z
      .string()
      .regex(ISO_DATE_PATTERN, "Invalid date value. Provide a valid date or leave it empty.")
      .optional()
      .nullable(),
  );
}

const punchItemCommonFields = {
  description: nullableTextField(),
  priority: z.preprocess(
    normalizeBlankToNull,
    z.enum(["low", "medium", "high"]).optional().nullable(),
  ),
  punch_item_manager_id: nullableUuidField(),
  final_approver_id: nullableUuidField(),
  assignee_id: nullableUuidField(),
  assignee_company: nullableTextField(),
  ball_in_court: nullableTextField(),
  due_date: nullableDateField(),
  location: nullableTextField(),
  trade: nullableTextField(),
  type: nullableTextField(),
  reference: nullableTextField(),
  drawing_reference: nullableTextField(),
  cost_code: nullableTextField(),
  cost_impact: nullableNumberField(),
  is_private: z.preprocess(
    (value) => (value === "" || value === undefined ? undefined : value),
    z.boolean().optional(),
  ),
} as const;

export const createPunchItemSchema = z.object({
  title: z.string().min(1, "Title is required"),
  status: z.enum(PUNCH_ITEM_STATUSES).default("draft"),
  ...punchItemCommonFields,
});

export const updatePunchItemSchema = z.object({
  title: z.string().min(1, "Title is required").optional(),
  status: z.enum(PUNCH_ITEM_STATUSES).optional(),
  ...punchItemCommonFields,
});
