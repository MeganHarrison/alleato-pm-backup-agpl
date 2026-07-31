/**
 * Zod Validation Schemas
 *
 * This module provides runtime validation schemas for:
 * - URL parameters (projectId, meetingId, etc.)
 * - API request/response validation
 * - Form data validation
 *
 * Using Zod ensures type safety at runtime, catching issues that
 * TypeScript alone cannot detect (e.g., malformed URL params).
 */

import { z } from "zod";

// =============================================================================
// URL Parameter Schemas
// =============================================================================

/**
 * Validates and coerces a projectId URL parameter to a positive integer.
 * Use this for all [projectId] route segments.
 *
 * @example
 * ```tsx
 * const projectId = ProjectIdSchema.parse(params.projectId)
 * // projectId is now a validated number
 * ```
 */
export const ProjectIdSchema = z.coerce
  .number()
  .int("Project ID must be an integer")
  .positive("Project ID must be positive");

/**
 * Validates a UUID string (used for meeting IDs, document IDs, etc.)
 */
export const UuidSchema = z.string().uuid("Invalid UUID format");

/**
 * Validates a generic string ID (non-empty)
 */
export const StringIdSchema = z.string().min(1, "ID cannot be empty");

// =============================================================================
// Common Field Schemas
// =============================================================================

export const EmailSchema = z.string().email("Invalid email format");

export const PhoneSchema = z
  .string()
  .regex(/^[\d\s\-+()]+$/, "Invalid phone number format")
  .optional();

export const DateStringSchema = z
  .string()
  .refine((val) => !isNaN(Date.parse(val)), "Invalid date format");

export const MoneySchema = z.coerce
  .number()
  .nonnegative("Amount cannot be negative");

export const PercentageSchema = z.coerce
  .number()
  .min(0, "Percentage must be at least 0")
  .max(100, "Percentage cannot exceed 100");

// =============================================================================
// Status Enums
// =============================================================================

export const TaskStatusSchema = z.enum([
  "pending",
  "in_progress",
  "completed",
  "blocked",
]);

export const TaskPrioritySchema = z.enum(["low", "medium", "high"]);

export const RfiStatusSchema = z.enum([
  "draft",
  "open",
  "pending",
  "closed",
  "void",
]);

export const ChangeOrderStatusSchema = z.enum([
  "draft",
  "pending",
  "approved",
  "rejected",
  "void",
]);

// =============================================================================
// Entity Schemas
// =============================================================================

export const ProjectSchema = z.object({
  id: z.number(),
  name: z.string(),
  client: z.string().nullable(),
  project_number: z.string().nullable(),
  address: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  zip: z.string().nullable(),
  start_date: z.string().nullable(),
  end_date: z.string().nullable(),
  status: z.string().nullable(),
  contract_amount: z.number().nullable(),
  created_at: z.string().nullable(),
  updated_at: z.string().nullable(),
});

export const TaskSchema = z.object({
  id: z.number(),
  project_id: z.number(),
  task_description: z.string().nullable(),
  assigned_to: z.string().nullable(),
  status: TaskStatusSchema.nullable(),
  priority: TaskPrioritySchema.nullable(),
  due_date: z.string().nullable(),
  created_at: z.string().nullable(),
  updated_at: z.string().nullable(),
});

// =============================================================================
// API Response Schemas
// =============================================================================

/**
 * Wraps a schema to validate Supabase query responses
 */
export function createQueryResponseSchema<T extends z.ZodTypeAny>(
  dataSchema: T,
) {
  return z.object({
    data: dataSchema.nullable(),
    error: z
      .object({
        message: z.string(),
        code: z.string().optional(),
        details: z.string().optional(),
      })
      .nullable(),
  });
}

/**
 * Wraps a schema for array responses
 */
export function createArrayResponseSchema<T extends z.ZodTypeAny>(
  itemSchema: T,
) {
  return createQueryResponseSchema(z.array(itemSchema));
}

// =============================================================================
// Validation Helpers
// =============================================================================

/**
 * Result type for safe parsing operations
 */
export type SafeParseResult<T> =
  | { success: true; data: T }
  | { success: false; error: z.ZodError };

/**
 * Safely parses a value with a schema, returning a result object instead of throwing.
 *
 * @example
 * ```tsx
 * const result = safeParse(ProjectIdSchema, params.projectId)
 * if (!result.success) {
 *   return notFound()
 * }
 * const projectId = result.data
 * ```
 */
export function safeParse<T extends z.ZodTypeAny>(
  schema: T,
  value: unknown,
): SafeParseResult<z.infer<T>> {
  const result = schema.safeParse(value);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

/**
 * Validates a projectId from URL params.
 * Use in server components where you want to call notFound() on failure.
 *
 * @example
 * ```tsx
 * import { validateProjectId } from '@/lib/validation/schemas'
 * import { notFound } from 'next/navigation'
 *
 * const result = validateProjectId(params.projectId)
 * if (!result.success) notFound()
 * const projectId = result.data
 * ```
 */
export function validateProjectId(projectId: string): SafeParseResult<number> {
  return safeParse(ProjectIdSchema, projectId);
}

/**
 * Validates a UUID from URL params.
 */
export function validateUuid(id: string): SafeParseResult<string> {
  return safeParse(UuidSchema, id);
}

// =============================================================================
// Type Exports
// =============================================================================

export type ProjectId = z.infer<typeof ProjectIdSchema>;
export type TaskStatus = z.infer<typeof TaskStatusSchema>;
export type TaskPriority = z.infer<typeof TaskPrioritySchema>;
export type RfiStatus = z.infer<typeof RfiStatusSchema>;
export type ChangeOrderStatus = z.infer<typeof ChangeOrderStatusSchema>;
export type Project = z.infer<typeof ProjectSchema>;
export type Task = z.infer<typeof TaskSchema>;
