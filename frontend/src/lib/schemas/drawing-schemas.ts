/**
 * Drawings Feature - Zod Validation Schemas
 *
 * All form validation schemas for drawings feature using Zod.
 * These schemas are used with react-hook-form via zodResolver.
 *
 * CRITICAL: File validation must use .refine() for size/type checks, NOT .max()
 */

import { z } from 'zod';
import {
  DRAWING_MAX_UPLOAD_BYTES,
  DRAWING_MAX_UPLOAD_LABEL,
  isAllowedDrawingFileType,
} from "@/lib/drawings/upload-constraints";

// =============================================================================
// FILE VALIDATION HELPER
// =============================================================================

/**
 * Drawing file validation schema
 * Max size: 200MB
 * Types: PDF, PNG, JPEG, TIFF, DWG, DXF
 *
 * CRITICAL: Uses .refine() not .max() for file size validation
 */
const drawingFileSchema = z
  .instanceof(File)
  .refine((file) => file.size <= DRAWING_MAX_UPLOAD_BYTES, {
    message: `File must be under ${DRAWING_MAX_UPLOAD_LABEL}`,
  })
  .refine(isAllowedDrawingFileType, {
    message: 'Accepted formats: PDF, PNG, JPEG, TIFF, SVG, WEBP, DWG, DXF',
  });

// =============================================================================
// DRAWING UPLOAD & EDIT SCHEMAS
// =============================================================================

/**
 * Schema for uploading a new drawing document
 * Used in DrawingUploadDialog component
 */
// Form schema without file (for react-hook-form)
export const uploadDrawingFormSchema = z.object({
  drawing_set_id: z.string().min(1, 'Drawing Set is required'),

  drawing_set_name: z.string().optional(), // Used when creating a new set by name

  drawing_date: z.string().optional(),

  received_date: z.string().optional(),

  // Advanced options
  discipline: z.string().optional(),

  drawing_type: z.string().optional(),

  drawing_number: z.string().max(100).optional(),

  title: z.string().max(255).optional(),

  revision_number: z.string().max(10).optional(),

  description: z.string().max(1000).optional(),

  area_id: z.string().uuid().optional(),
});

// Full schema with file (for API validation)
export const uploadDrawingSchema = uploadDrawingFormSchema.extend({
  file: drawingFileSchema,
});

export type UploadDrawingFormData = z.infer<typeof uploadDrawingFormSchema>;
export type UploadDrawingWithFileData = z.infer<typeof uploadDrawingSchema>;

/**
 * Schema for editing drawing metadata (without changing file)
 * Used in DrawingEditModal component
 */
export const editDrawingSchema = z.object({
  drawing_number: z
    .string()
    .max(100, 'Drawing number must be 100 characters or less')
    .optional(),

  title: z
    .string()
    .max(255, 'Title must be 255 characters or less')
    .optional(),

  discipline: z.string().optional(),

  drawing_type: z.string().optional(),
});

export type EditDrawingFormData = z.infer<typeof editDrawingSchema>;

// =============================================================================
// AREA SCHEMAS
// =============================================================================

/**
 * Schema for creating/editing drawing areas
 * Used in DrawingAreaManager component
 */
export const drawingAreaFormSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(255, 'Name must be 255 characters or less'),

  description: z.string().max(500, 'Description must be 500 characters or less').optional(),

  parent_area_id: z.string().uuid().optional(),

  sort_order: z.number().int().min(0).default(0),
});

export type DrawingAreaFormData = z.infer<typeof drawingAreaFormSchema>;

// =============================================================================
// DRAWING SET SCHEMAS
// =============================================================================

/**
 * Schema for creating/editing drawing sets
 * Used in DrawingSetFormDialog component
 */
export const drawingSetFormSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(255, 'Name must be 255 characters or less'),

  issued_at: z.string().datetime('Invalid datetime format'),

  description: z.string().max(500, 'Description must be 500 characters or less').optional(),
});

export type DrawingSetFormData = z.infer<typeof drawingSetFormSchema>;

// =============================================================================
// REVISION SCHEMAS
// =============================================================================

/**
 * Schema for adding a new revision to existing drawing
 * Used in AddDrawingRevisionDialog component
 */
export const addRevisionSchema = z.object({
  file: drawingFileSchema,

  revision_number: z
    .string()
    .min(1, 'Revision number is required')
    .max(10, 'Revision number must be 10 characters or less'),

  drawing_date: z.string().optional(),

  received_date: z.string().default(() => new Date().toISOString()),

  status: z
    .enum(['draft', 'under_review', 'approved', 'superseded', 'void'], {
      message: 'Status must be one of: draft, under_review, approved, superseded, void',
    })
    .default('under_review'),

  description: z.string().max(1000, 'Description must be 1000 characters or less').optional(),

  drawing_set_id: z.string().uuid().optional(),
});

export type AddRevisionFormData = z.infer<typeof addRevisionSchema>;

// =============================================================================
// SEARCH & FILTER SCHEMAS
// =============================================================================

/**
 * Schema for drawing search/filter parameters
 * Used in DrawingFilters component and API route validation
 */
export const drawingFiltersSchema = z.object({
  search: z.string().max(255).optional(),

  discipline: z.string().optional(),

  drawing_type: z.string().optional(),

  status: z.enum(['draft', 'under_review', 'approved', 'superseded', 'void']).optional(),

  area_id: z.string().uuid().optional(),

  set_id: z.string().uuid().optional(),

  page: z.number().int().min(1).default(1),

  page_size: z.number().int().min(1).max(100).default(50),
});

export type DrawingFiltersFormData = z.infer<typeof drawingFiltersSchema>;

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Validates file size before upload starts (client-side optimization)
 * Prevents unnecessary upload attempts for oversized files
 */
export function validateFileSize(file: File, maxSizeMB: number = 200): boolean {
  return file.size <= maxSizeMB * 1024 * 1024;
}

/**
 * Validates drawing file type before upload starts
 */
export const validateDrawingFileType = isAllowedDrawingFileType;

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
