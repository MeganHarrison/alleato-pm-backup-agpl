import type { createClient } from "@supabase/supabase-js";
import type { Database } from "../../types/database.types";

export type Tables = Database["public"]["Tables"];
export type Views = Database["public"]["Views"];
export type Drawing = Tables["drawings"]["Row"];
export type DrawingRevision = Tables["drawing_revisions"]["Row"];
export type DrawingLogEntry = Views["drawing_log"]["Row"];
export type DrawingSketch = Tables["drawing_sketches"]["Row"];
export type DrawingDownload = Tables["drawing_downloads"]["Row"];
export type DrawingRelatedItem = Tables["drawing_related_items"]["Row"];

export type SupabaseClient = ReturnType<typeof createClient<Database>>;

export type DrawingError = { type: string; message: string };
export type Result<T, E = DrawingError> =
  | { data: T; error: null }
  | { data: null; error: E };

export interface DrawingFilters {
  search?: string;
  area_id?: string;
  discipline?: string;
  status?: string;
  set_id?: string;
  page?: number;
  page_size?: number;
  include_unpublished?: boolean;
  include_obsolete?: boolean;
}

export interface DrawingCreateInput {
  drawing_number: string;
  title: string;
  discipline?: string;
  drawing_type?: string;
  area_id?: string;
  is_published?: boolean;
  is_obsolete?: boolean;
}

export interface DrawingUpdateInput {
  drawing_number?: string;
  title?: string;
  discipline?: string;
  drawing_type?: string;
  area_id?: string;
}

export interface RevisionCreateInput {
  revision_number: string;
  drawing_set_id?: string;
  drawing_date?: string;
  received_date: string;
  status?: string;
  is_current_revision?: boolean;
  is_published?: boolean;
  update_current_revision?: boolean;
  update_review_revision?: boolean;
  file_url: string;
  file_name: string;
  file_size: number;
  file_type: string;
  description?: string;
  rotation_degrees?: number;
  ocr_confidence_label?: "high" | "medium" | "low" | "unknown";
  ocr_confidence_score?: number | null;
  ocr_confidence_source?: "ocr" | "filename" | "manual" | "not_run";
}

export interface SketchCreateInput {
  file_url: string;
  name: string;
  sketch_number: string;
  description?: string;
}

export interface DrawingListResponse {
  drawings: DrawingLogEntry[];
  total_count: number;
  page: number;
  page_size: number;
  has_next_page: boolean;
  has_previous_page: boolean;
}

export interface DrawingWithRevision extends Drawing {
  current_revision: DrawingRevision | null;
}

export interface FileUploadResult {
  url: string;
  path: string;
}
