/**
 * Drawing management system types and schemas
 * 
 * This file contains TypeScript interfaces and Zod schemas for the drawings system,
 * including hierarchical areas, drawings, revisions, sets, sketches, and related items.
 */

import { z } from 'zod';
import type { Database } from './database.types';

// Types derived from generated Supabase types (migration applied)
type Tables = Database['public']['Tables'];
type Views = Database['public']['Views'];

type DrawingAreaRow = Tables['drawing_areas']['Row'];
type DrawingRow = Tables['drawings']['Row'];
type DrawingRevisionRow = Tables['drawing_revisions']['Row'];
type DrawingSetRow = Tables['drawing_sets']['Row'];
type DrawingSketchRow = Tables['drawing_sketches']['Row'];
type DrawingDownloadRow = Tables['drawing_downloads']['Row'];
type DrawingRelatedItemRow = Tables['drawing_related_items']['Row'];

// View row types
export type DrawingLogViewRow = Views['drawing_log']['Row'];
export type DrawingAreaWithCountViewRow = Views['drawing_areas_with_counts']['Row'];

// Insert/Update types for services
export type DrawingAreaInsert = Tables['drawing_areas']['Insert'];
export type DrawingAreaUpdate = Tables['drawing_areas']['Update'];
export type DrawingInsert = Tables['drawings']['Insert'];
export type DrawingUpdate = Tables['drawings']['Update'];
export type DrawingRevisionInsert = Tables['drawing_revisions']['Insert'];
export type DrawingSetInsert = Tables['drawing_sets']['Insert'];
export type DrawingSetUpdate = Tables['drawing_sets']['Update'];

// Status enums for better type safety
export type DrawingStatus = 'draft' | 'under_review' | 'approved' | 'superseded' | 'void';
export type DrawingSetStatus = 'active' | 'archived';

// Drawing disciplines and types for consistent data
export const DRAWING_DISCIPLINES = [
  'Architectural',
  'Structural', 
  'Mechanical',
  'Electrical',
  'Plumbing',
  'Fire Protection',
  'Civil',
  'Landscape',
  'Other'
] as const;

export const DRAWING_TYPES = [
  'Plan',
  'Section', 
  'Detail',
  'Elevation',
  'Schedule',
  'Specification',
  'Other'
] as const;

export type DrawingDiscipline = typeof DRAWING_DISCIPLINES[number];
export type DrawingType = typeof DRAWING_TYPES[number];

// Enhanced interfaces with relations and computed properties
// Note: DB uses snake_case (parent_area_id, sort_order), keep that for consistency
export interface DrawingArea extends DrawingAreaRow {
  drawing_count?: number;
  children?: DrawingArea[];
  depth?: number;
  path?: string[];
}

export interface Drawing extends DrawingRow {
  area?: DrawingArea;
  currentRevision?: DrawingRevision;
  revisions?: DrawingRevision[];
  relatedItems?: DrawingRelatedItem[];
  revisionCount?: number;
  latestRevisionDate?: string;
}

export interface DrawingRevision extends DrawingRevisionRow {
  drawing?: Drawing;
  drawingSet?: DrawingSet;
  sketches?: DrawingSketch[];
  downloads?: DrawingDownload[];
  downloadCount?: number;
  uploaderEmail?: string;
}

export interface DrawingSet extends DrawingSetRow {
  revisions?: DrawingRevision[];
  revisionCount?: number;
}

export interface DrawingSketch extends DrawingSketchRow {
  drawingRevision?: DrawingRevision;
  creatorEmail?: string;
}

export interface DrawingDownload extends DrawingDownloadRow {
  drawingRevision?: DrawingRevision;
  downloaderEmail?: string;
}

export interface DrawingRelatedItem extends DrawingRelatedItemRow {
  drawing?: Drawing;
  creatorEmail?: string;
}

// Related item type constants
export const DRAWING_RELATED_TYPES = [
  'rfi',
  'submittal', 
  'change_order',
  'change_event',
  'commitment',
  'invoice',
  'daily_log',
  'inspection',
  'meeting'
] as const;

export type DrawingRelatedType = typeof DRAWING_RELATED_TYPES[number];

// Zod schemas for form validation

export const drawingAreaSchema = z.object({
  name: z.string()
    .min(1, 'Area name is required')
    .max(255, 'Area name must be 255 characters or less'),
  description: z.string()
    .max(1000, 'Description must be 1000 characters or less')
    .optional(),
  parentAreaId: z.string().uuid('Invalid parent area ID').optional(),
  sortOrder: z.number()
    .int('Sort order must be an integer')
    .min(0, 'Sort order must be non-negative')
    .optional(),
});

export const drawingUploadSchema = z.object({
  drawingNumber: z.string()
    .min(1, 'Drawing number is required')
    .max(100, 'Drawing number must be 100 characters or less'),
  title: z.string()
    .min(1, 'Drawing title is required')
    .max(255, 'Drawing title must be 255 characters or less'),
  discipline: z.enum(DRAWING_DISCIPLINES).optional(),
  drawingType: z.enum(DRAWING_TYPES).optional(),
  revisionNumber: z.string()
    .min(1, 'Revision number is required')
    .max(10, 'Revision number must be 10 characters or less')
    .default('A'),
  drawingDate: z.string()
    .datetime('Invalid drawing date')
    .optional(),
  receivedDate: z.string()
    .datetime('Invalid received date')
    .default(() => new Date().toISOString()),
  drawingSetId: z.string().uuid('Invalid drawing set ID').optional(),
  description: z.string()
    .max(1000, 'Description must be 1000 characters or less')
    .optional(),
});

export const drawingFilterSchema = z.object({
  search: z.string().optional(),
  discipline: z.enum(DRAWING_DISCIPLINES).optional(),
  drawingType: z.enum(DRAWING_TYPES).optional(),
  status: z.enum(['draft', 'under_review', 'approved', 'superseded', 'void'] as const).optional(),
  drawingSetId: z.string().uuid('Invalid drawing set ID').optional(),
  uploadedBy: z.string().uuid('Invalid user ID').optional(),
  dateFrom: z.string().datetime('Invalid date').optional(),
  dateTo: z.string().datetime('Invalid date').optional(),
  revisionFrom: z.string().optional(),
  revisionTo: z.string().optional(),
  hasSketch: z.boolean().optional(),
});

export const drawingRevisionSchema = z.object({
  revisionNumber: z.string()
    .min(1, 'Revision number is required')
    .max(10, 'Revision number must be 10 characters or less'),
  drawingDate: z.string()
    .datetime('Invalid drawing date')
    .optional(),
  receivedDate: z.string()
    .datetime('Invalid received date')
    .default(() => new Date().toISOString()),
  status: z.enum(['draft', 'under_review', 'approved', 'superseded', 'void'] as const)
    .default('under_review'),
  description: z.string()
    .max(1000, 'Description must be 1000 characters or less')
    .optional(),
  drawingSetId: z.string().uuid('Invalid drawing set ID').optional(),
});

// Form data types (inferred from schemas)
export type DrawingAreaFormData = z.infer<typeof drawingAreaSchema>;
export type DrawingUploadFormData = z.infer<typeof drawingUploadSchema>;
export type DrawingFilterFormData = z.infer<typeof drawingFilterSchema>;
export type DrawingRevisionFormData = z.infer<typeof drawingRevisionSchema>;

// Mapper: convert snake_case DB view row to camelCase UI type
export function mapDrawingLogRow(row: DrawingLogViewRow): DrawingLogTableRow {
  return {
    id: row.id ?? '',
    projectId: row.project_id ?? 0,
    drawingNumber: row.drawing_number ?? '',
    title: row.title ?? '',
    discipline: row.discipline ?? null,
    drawingType: row.drawing_type ?? null,
    drawingCreatedAt: row.drawing_created_at ?? '',
    drawingUpdatedAt: row.drawing_updated_at ?? '',
    areaId: row.area_id ?? null,
    areaName: row.area_name ?? null,
    revisionId: row.revision_id ?? null,
    revisionNumber: row.revision_number ?? null,
    drawingDate: row.drawing_date ?? null,
    receivedDate: row.received_date ?? null,
    status: (row.status as DrawingStatus) ?? null,
    fileUrl: row.file_url ?? null,
    fileName: row.file_name ?? null,
    fileSize: row.file_size ?? null,
    fileType: row.file_type ?? null,
    revisionDescription: row.revision_description ?? null,
    uploadedBy: row.uploaded_by ?? null,
    revisionCreatedAt: row.revision_created_at ?? null,
    setName: row.set_name ?? null,
    uploadedByEmail: row.uploaded_by_email ?? null,
    isPublished: row.revision_is_published ?? row.is_published ?? true,
    isObsolete: row.is_obsolete ?? false,
  };
}

// Additional interfaces for special data structures
// This interface uses snake_case properties as returned by the drawing_areas_with_counts view
export interface DrawingAreaWithCount extends DrawingArea {
  drawing_count: number;
  depth: number;
  path: string[];
  children?: DrawingAreaWithCount[];
}

export interface DrawingLogTableRow {
  id: string;
  projectId: number;
  drawingNumber: string;
  title: string;
  discipline: string | null;
  drawingType: string | null;
  drawingCreatedAt: string;
  drawingUpdatedAt: string;
  areaId: string | null;
  areaName: string | null;
  revisionId: string | null;
  revisionNumber: string | null;
  drawingDate: string | null;
  receivedDate: string | null;
  status: DrawingStatus | null;
  fileUrl: string | null;
  fileName: string | null;
  fileSize: number | null;
  fileType: string | null;
  revisionDescription: string | null;
  uploadedBy: string | null;
  revisionCreatedAt: string | null;
  setName: string | null;
  uploadedByEmail: string | null;
  isPublished: boolean;
  isObsolete: boolean;
}

// Upload progress and error types
export interface DrawingUploadProgress {
  fileName: string;
  progress: number;
  status: 'pending' | 'uploading' | 'processing' | 'completed' | 'error';
  error?: string;
  drawingId?: string;
  revisionId?: string;
}

export interface DrawingUploadError {
  fileName: string;
  error: string;
  code?: 'FILE_TOO_LARGE' | 'INVALID_TYPE' | 'NETWORK_ERROR' | 'SERVER_ERROR';
}

// Hook return types for consistency
export interface UseDrawingAreasReturn {
  areas: DrawingAreaWithCount[];
  isLoading: boolean;
  error: Error | null;
  createArea: (data: DrawingAreaFormData) => Promise<DrawingArea>;
  updateArea: (id: string, data: Partial<DrawingAreaFormData>) => Promise<DrawingArea>;
  deleteArea: (id: string) => Promise<void>;
  reorderAreas: (sourceId: string, targetId: string, position: 'before' | 'after' | 'inside') => Promise<void>;
}

export interface UseDrawingUploadReturn {
  uploadDrawing: (file: File, metadata: DrawingUploadFormData) => Promise<DrawingRevision>;
  uploadMultipleDrawings: (files: FileList, metadata: Partial<DrawingUploadFormData>) => Promise<DrawingRevision[]>;
  progress: DrawingUploadProgress[];
  isUploading: boolean;
  errors: DrawingUploadError[];
  clearErrors: () => void;
  clearUploadState: () => void;
}
