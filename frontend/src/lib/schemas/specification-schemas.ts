/**
 * Specifications Feature - Zod Validation Schemas
 *
 * All form validation schemas for specifications feature using Zod.
 * These schemas are used with react-hook-form via zodResolver.
 *
 * CRITICAL: File validation must use .refine() for size/type checks, NOT .max()
 */

import { z } from 'zod';

// =============================================================================
// FILE VALIDATION HELPER
// =============================================================================

/**
 * File validation schema
 * Max size: 50MB
 *
 * CRITICAL: Uses .refine() not .max() for file size validation
 */
const uploadFileSchema = z
  .instanceof(File)
  .refine((file) => file.size <= 50 * 1024 * 1024, {
    message: 'File must be under 50MB',
  });

// =============================================================================
// SPECIFICATION UPLOAD & EDIT SCHEMAS
// =============================================================================

/**
 * Schema for uploading a new specification document
 * Used in SpecificationUploadDialog component
 */
export const uploadSpecificationSchema = z.object({
  specification_set_name: z
    .string()
    .min(1, 'Specification set is required')
    .max(255, 'Specification set must be 255 characters or less'),

  specification_set_instructions: z
    .string()
    .max(1000, 'Specification set instructions must be 1000 characters or less')
    .optional(),

  format: z.enum(
    ['masterformat_csi', 'ncs_natspec', 'no_or_other_format'],
    { message: 'Format is required' },
  ),

  default_issue_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Default issue date must be in YYYY-MM-DD format')
    .optional()
    .or(z.literal('')),

  default_receive_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Default receive date must be in YYYY-MM-DD format')
    .optional()
    .or(z.literal('')),

  default_revision_instruction: z
    .string()
    .max(255, 'Default revision instructions must be 255 characters or less')
    .optional(),

  number_to_ignore: z
    .string()
    .max(50, 'Number to ignore must be 50 characters or less')
    .optional(),

  specifications_language: z.enum(
    ['english', 'spanish', 'french', 'portuguese'],
    { message: 'Specifications language is required' },
  ),

  file: uploadFileSchema,

  area_ids: z.array(z.number().int().positive()).optional(),

  subscriber_ids: z.array(z.string().uuid()).optional(),
}).superRefine((data, ctx) => {
  if (data.format !== 'masterformat_csi' && data.specifications_language !== 'english') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['specifications_language'],
      message: 'Only CSI MasterFormat supports languages other than English.',
    });
  }
});

export type UploadSpecificationFormData = z.infer<typeof uploadSpecificationSchema>;

/**
 * Schema for editing specification metadata (without changing file)
 * Used in SpecificationEditModal component
 */
export const editSpecificationSchema = z.object({
  section_number: z
    .string()
    .min(1, 'Section number is required')
    .max(50, 'Section number must be 50 characters or less'),

  title: z
    .string()
    .min(1, 'Title is required')
    .max(255, 'Title must be 255 characters or less'),

  description: z.string().max(1000).optional(),

  status: z.enum(['active', 'archived', 'superseded'], {
    message: 'Status must be one of: active, archived, superseded',
  }),
});

export type EditSpecificationFormData = z.infer<typeof editSpecificationSchema>;

// =============================================================================
// REVISION SCHEMAS
// =============================================================================

/**
 * Schema for adding a new revision to existing specification
 * Used in AddRevisionDialog component
 */
export const addRevisionSchema = z.object({
  file: uploadFileSchema,

  notes: z.string().max(1000, 'Notes must be 1000 characters or less').optional(),

  notify_subscribers: z.boolean(),
});

export type AddRevisionFormData = z.infer<typeof addRevisionSchema>;

// =============================================================================
// AREA SCHEMAS
// =============================================================================

/**
 * Schema for creating/editing specification areas
 * Used in SpecificationAreaManager component
 */
export const specificationAreaSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(255, 'Name must be 255 characters or less'),

  description: z.string().max(500, 'Description must be 500 characters or less').optional(),

  sort_order: z.number().int().min(0).default(0),
});

export type SpecificationAreaFormData = z.infer<typeof specificationAreaSchema>;

// =============================================================================
// SEARCH & FILTER SCHEMAS
// =============================================================================

/**
 * Schema for specification search/filter parameters
 * Used in SpecificationFilters component and API route validation
 */
export const specificationFiltersSchema = z.object({
  search: z.string().max(255).optional(),

  area_id: z.number().int().positive().optional(),

  status: z.enum(['active', 'archived', 'superseded']).optional(),

  uploaded_after: z.string().datetime().optional(),

  uploaded_before: z.string().datetime().optional(),

  page: z.number().int().min(1).default(1),

  page_size: z.number().int().min(1).max(100).default(50),
});

export type SpecificationFiltersFormData = z.infer<typeof specificationFiltersSchema>;

// =============================================================================
// SUBSCRIBER SCHEMAS
// =============================================================================

/**
 * Schema for adding subscribers to a specification
 * Used in AddSubscribersModal component
 */
export const addSubscribersSchema = z.object({
  user_ids: z
    .array(z.string().uuid())
    .min(1, 'At least one subscriber is required')
    .max(50, 'Cannot add more than 50 subscribers at once'),
});

export type AddSubscribersFormData = z.infer<typeof addSubscribersSchema>;

// =============================================================================
// SETTINGS SCHEMAS
// =============================================================================

/**
 * Schema for project-level specification settings
 * Used in SpecificationSettingsModal component
 */
export const specificationSettingsSchema = z.object({
  allow_duplicate_section_numbers: z.boolean().default(false),

  require_format_review: z.boolean().default(true),

  auto_notify_subscribers: z.boolean().default(true),

  max_file_size_mb: z.number().int().min(1).max(100).default(50),

  allowed_file_types: z.array(z.string()).default(['*/*']),
});

export type SpecificationSettingsFormData = z.infer<typeof specificationSettingsSchema>;

// =============================================================================
// API REQUEST/RESPONSE VALIDATION
// =============================================================================

/**
 * Schema for validating specification section IDs from URL params
 */
export const sectionIdSchema = z.coerce.number().int().positive({
  message: 'Section ID must be a positive integer',
});

/**
 * Schema for validating revision IDs from URL params
 */
export const revisionIdSchema = z.coerce.number().int().positive({
  message: 'Revision ID must be a positive integer',
});

/**
 * Schema for validating area IDs from URL params
 */
export const areaIdSchema = z.coerce.number().int().positive({
  message: 'Area ID must be a positive integer',
});

/**
 * Schema for validating project IDs from URL params
 * CRITICAL: Must be INTEGER to match projects.id type
 */
export const projectIdSchema = z.coerce.number().int().positive({
  message: 'Project ID must be a positive integer',
});

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Validates file size before upload starts (client-side optimization)
 * Prevents unnecessary upload attempts for oversized files
 */
export function validateFileSize(file: File, maxSizeMB: number = 50): boolean {
  return file.size <= maxSizeMB * 1024 * 1024;
}

/**
 * Validates file type before upload starts
 */
export function validateFileType(file: File, allowedTypes: string[] = ['*/*']): boolean {
  const normalizedAllowedTypes = allowedTypes.map((type) => type.toLowerCase());
  if (normalizedAllowedTypes.includes('*/*')) {
    return true;
  }

  return normalizedAllowedTypes.includes((file.type || '').toLowerCase());
}

/**
 * Format file size for display (bytes to human-readable)
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Sanitize filename for storage (prevent path traversal attacks)
 * CRITICAL: Remove special characters that could be exploited
 */
export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9.-]/g, '_') // Replace special chars with underscore
    .replace(/_{2,}/g, '_') // Replace multiple underscores with single
    .slice(0, 255); // Limit length
}
