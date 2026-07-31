/**
 * Specifications Feature - Domain Types
 *
 * These types extend the generated Supabase types with domain-specific interfaces
 * for specifications, revisions, areas, and related entities.
 *
 * IMPORTANT: Run `npm run db:types` after applying migration to generate base types
 */

import { Database } from '@/types/database.types';

// =============================================================================
// GENERATED SUPABASE TYPES (will be available after migration applied)
// =============================================================================

// Base types from Supabase (these will exist after migration + type generation)
export type SpecificationSection = Database['public']['Tables']['specification_sections']['Row'];
export type SpecificationSectionInsert = Database['public']['Tables']['specification_sections']['Insert'];
export type SpecificationSectionUpdate = Database['public']['Tables']['specification_sections']['Update'];

export type SpecificationRevision = Database['public']['Tables']['specification_section_revisions']['Row'];
export type SpecificationRevisionInsert = Database['public']['Tables']['specification_section_revisions']['Insert'];

export type SpecificationArea = Database['public']['Tables']['specification_areas']['Row'];
export type SpecificationAreaInsert = Database['public']['Tables']['specification_areas']['Insert'];
export type SpecificationAreaUpdate = Database['public']['Tables']['specification_areas']['Update'];

export type SpecificationAreaSection = Database['public']['Tables']['specification_area_sections']['Row'];
export type SpecificationSubscriber = Database['public']['Tables']['specification_subscribers']['Row'];

// =============================================================================
// DOMAIN-SPECIFIC TYPES (with joins and computed fields)
// =============================================================================

/**
 * Specification section with its current revision details
 * Used for list views where we need revision info
 */
export interface SpecificationWithRevision extends SpecificationSection {
  current_revision: SpecificationRevision | null;
  area_count: number;
  subscriber_count: number;
}

/**
 * Specification section with all assigned areas
 * Used for detail views and editing
 */
export interface SpecificationWithAreas extends SpecificationSection {
  areas: SpecificationArea[];
  current_revision: SpecificationRevision | null;
}

/**
 * Revision with uploader details
 * Used for revision history displays
 */
export interface RevisionWithUploader extends SpecificationRevision {
  uploader: {
    id: string;
    email: string;
    full_name: string;
  };
}

/**
 * Area with section count
 * Used for areas management UI
 */
export interface AreaWithSectionCount extends SpecificationArea {
  section_count: number;
}

// =============================================================================
// UPLOAD & FORM DATA TYPES
// =============================================================================

/**
 * Data required to upload a new specification
 * Matches the uploadSpecificationSchema Zod schema
 */
export interface UploadSpecificationData {
  section_number: string;
  title: string;
  description?: string;
  file: File;
  notes?: string;
  area_ids?: number[];
  subscriber_ids?: string[];
}

/**
 * Data required to add a new revision to existing specification
 * Matches the addRevisionSchema Zod schema
 */
export interface UploadRevisionData {
  file: File;
  notes?: string;
  notify_subscribers?: boolean;
}

/**
 * Data for updating specification metadata (not file)
 * Matches the editSpecificationSchema Zod schema
 */
export interface UpdateSpecificationData {
  section_number: string;
  title: string;
  description?: string;
  status: 'active' | 'archived' | 'superseded';
}

/**
 * Data for creating/updating specification area
 * Matches the specificationAreaSchema Zod schema
 */
export interface SpecificationAreaData {
  name: string;
  description?: string;
  sort_order?: number;
}

// =============================================================================
// FILTER & SEARCH TYPES
// =============================================================================

/**
 * Filters for specification search/list queries
 */
export interface SpecificationFilters {
  search?: string; // Search in section_number, title, description
  area_id?: number; // Filter by specific area
  status?: 'active' | 'archived' | 'superseded'; // Filter by status
  uploaded_after?: string; // ISO date string
  uploaded_before?: string; // ISO date string
  page?: number; // Pagination page number
  page_size?: number; // Results per page
}

/**
 * Paginated list response from API
 */
export interface SpecificationListResponse {
  specifications: SpecificationWithRevision[];
  total_count: number;
  page: number;
  page_size: number;
  has_next_page: boolean;
  has_previous_page: boolean;
}

/**
 * Revision list response from API
 */
export interface RevisionListResponse {
  revisions: RevisionWithUploader[];
  total_count: number;
  section: SpecificationSection;
}

// =============================================================================
// SETTINGS TYPES
// =============================================================================

/**
 * Project-level settings for specifications feature
 * (Future: stored in project_settings table or similar)
 */
export interface SpecificationSettings {
  project_id: number;
  allow_duplicate_section_numbers: boolean;
  require_format_review: boolean;
  auto_notify_subscribers: boolean;
  max_file_size_mb: number;
  allowed_file_types: string[];
}

// =============================================================================
// UPLOAD STATE TYPES (for hooks)
// =============================================================================

/**
 * State for file upload progress tracking
 * Used by useSpecificationUpload hook
 */
export interface UploadState {
  progress: number; // 0-100
  isUploading: boolean;
  error: string | null;
  uploadedFileUrl: string | null;
}

/**
 * Uploaded file metadata returned from Supabase Storage
 */
export interface UploadedFile {
  path: string; // Storage path
  fullPath: string; // Full URL
  id: string;
}

// =============================================================================
// ERROR TYPES
// =============================================================================

/**
 * Specification-specific error types
 */
export type SpecificationError =
  | { type: 'NOT_FOUND'; message: string }
  | { type: 'DUPLICATE_SECTION_NUMBER'; message: string }
  | { type: 'FILE_TOO_LARGE'; message: string; max_size_mb: number }
  | { type: 'INVALID_FILE_TYPE'; message: string; allowed_types: string[] }
  | { type: 'UNAUTHORIZED'; message: string }
  | { type: 'REVISION_CONFLICT'; message: string }
  | { type: 'STORAGE_ERROR'; message: string }
  | { type: 'UNKNOWN'; message: string };

// =============================================================================
// UTILITY TYPES
// =============================================================================

/**
 * Result wrapper for service layer operations
 * Follows Result<T, E> pattern from service layer
 */
export type Result<T, E = Error> = {
  data: T | null;
  error: E | null;
};

/**
 * Status type for specifications
 */
export type SpecificationStatus = 'active' | 'archived' | 'superseded';

/**
 * Sort field options for specifications list
 */
export type SpecificationSortField =
  | 'section_number'
  | 'title'
  | 'created_at'
  | 'updated_at';

/**
 * Sort direction
 */
export type SortDirection = 'asc' | 'desc';
