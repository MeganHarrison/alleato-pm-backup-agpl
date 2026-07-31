import { z } from "zod";

/**
 * Common Zod Schema Helpers for Form Validation
 *
 * These helpers handle edge cases when using Zod with React Hook Form,
 * particularly the NaN issue with numeric inputs.
 *
 * PROBLEM: HTML number inputs return NaN (not undefined) when empty.
 * React Hook Form's `valueAsNumber: true` preserves this NaN value.
 * Zod's z.number().optional() expects number | undefined, but NaN is
 * technically typeof 'number', so it passes the type check but fails
 * range validations silently.
 *
 * SOLUTION: Use these helpers instead of raw z.number() for form fields.
 */

/**
 * Optional number field that handles NaN from empty form inputs.
 * Transforms NaN to undefined before validation.
 *
 * @example
 * // In your schema:
 * quantity: optionalNumber,
 *
 * // In your form:
 * <Input type="number" {...register('quantity', { valueAsNumber: true })} />
 */
export const optionalNumber = z
  .union([z.number(), z.nan()])
  .optional()
  .transform((val): number | undefined =>
    val === undefined || Number.isNaN(val) ? undefined : val,
  );

/**
 * Optional percentage field (0-100) that handles NaN.
 *
 * @example
 * retainagePercent: optionalPercent,
 */
export const optionalPercent = z
  .union([z.number().min(0).max(100), z.nan()])
  .optional()
  .transform((val): number | undefined =>
    val === undefined || Number.isNaN(val) ? undefined : val,
  );

/**
 * Optional positive number that handles NaN.
 *
 * @example
 * amount: optionalPositiveNumber,
 */
export const optionalPositiveNumber = z
  .union([z.number().min(0), z.nan()])
  .optional()
  .transform((val): number | undefined =>
    val === undefined || Number.isNaN(val) ? undefined : val,
  );

/**
 * Required number field that handles NaN from empty form inputs.
 * Will fail validation if the input is empty/NaN.
 *
 * @example
 * quantity: requiredNumber,
 */
export const requiredNumber = z
  .union([z.number(), z.nan()])
  .refine((val) => !Number.isNaN(val), {
    message: "This field is required",
  })
  .transform((val) => val as number);

/**
 * Required positive number that handles NaN.
 *
 * @example
 * amount: requiredPositiveNumber,
 */
export const requiredPositiveNumber = z
  .union([z.number().min(0), z.nan()])
  .refine((val) => !Number.isNaN(val), {
    message: "This field is required",
  })
  .transform((val) => val as number);

/**
 * Creates an optional number with custom min/max range.
 *
 * @example
 * rating: optionalNumberInRange(1, 5),
 */
export const optionalNumberInRange = (min: number, max: number) =>
  z
    .union([z.number().min(min).max(max), z.nan()])
    .optional()
    .transform((val): number | undefined =>
      val === undefined || Number.isNaN(val) ? undefined : val,
    );

/**
 * Creates a required number with custom min/max range.
 *
 * @example
 * rating: requiredNumberInRange(1, 5),
 */
export const requiredNumberInRange = (min: number, max: number) =>
  z
    .union([z.number().min(min).max(max), z.nan()])
    .refine((val) => !Number.isNaN(val), {
      message: "This field is required",
    })
    .transform((val) => val as number);
