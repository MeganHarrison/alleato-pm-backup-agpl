/**
 * DrawingService — Facade over domain-specific sub-services.
 *
 * All public methods are preserved for backward compatibility.
 * New code should import sub-services directly from "@/services/drawings".
 *
 * Sub-services:
 *   DrawingRevisionService  — revision CRUD
 *   DrawingFileService      — upload, download, storage
 *   DrawingRelatedService   — cross-tool links, sketches
 */
import type { createClient } from "@supabase/supabase-js";
import type { Database } from "../types/database.types";

import { DrawingRevisionService } from "./drawings/DrawingRevisionService";
import { DrawingFileService } from "./drawings/DrawingFileService";
import { DrawingRelatedService } from "./drawings/DrawingRelatedService";

// Re-export types so existing `import { … } from "@/services/DrawingService"` keeps working
export type {
  DrawingFilters,
  DrawingCreateInput,
  DrawingUpdateInput,
  RevisionCreateInput,
  SketchCreateInput,
  DrawingListResponse,
  DrawingWithRevision,
  FileUploadResult,
  DrawingError,
  Result,
} from "./drawings/types";

import type {
  DrawingFilters,
  DrawingCreateInput,
  DrawingUpdateInput,
  RevisionCreateInput,
  SketchCreateInput,
  DrawingListResponse,
  DrawingWithRevision,
  FileUploadResult,
  DrawingError,
  Result,
} from "./drawings/types";

type Tables = Database["public"]["Tables"];
type Views = Database["public"]["Views"];
type Drawing = Tables["drawings"]["Row"];
type DrawingRevision = Tables["drawing_revisions"]["Row"];
type DrawingLogEntry = Views["drawing_log"]["Row"];
type DrawingSketch = Tables["drawing_sketches"]["Row"];
type DrawingDownload = Tables["drawing_downloads"]["Row"];
type DrawingRelatedItem = Tables["drawing_related_items"]["Row"];

type SupabaseClientType = ReturnType<typeof createClient<Database>>;

/**
 * Facade service for drawing document management.
 * Delegates revision, file, and related-item operations to sub-services.
 * CRITICAL: project_id is INTEGER (matches projects.id type)
 */
export class DrawingService {
  readonly revisions: DrawingRevisionService;
  readonly files: DrawingFileService;
  readonly related: DrawingRelatedService;

  constructor(private supabase: SupabaseClientType) {
    this.revisions = new DrawingRevisionService(supabase);
    this.files = new DrawingFileService(supabase);
    this.related = new DrawingRelatedService(supabase);
  }

  // ─── Drawing CRUD ───────────────────────────────────────────────────────────

  async list(
    projectId: string,
    filters: DrawingFilters = {},
  ): Promise<Result<DrawingListResponse, DrawingError>> {
    const {
      search,
      area_id,
      discipline,
      status,
      set_id,
      page = 1,
      page_size = 50,
      include_unpublished = false,
      include_obsolete = false,
    } = filters;

    const projectIdNum = Number.parseInt(projectId, 10);
    const offset = (page - 1) * page_size;
    const logView = include_unpublished ? "drawing_log_review" : "drawing_log";

    try {
      let query = this.supabase
        .from(logView)
        .select("*", { count: "exact" })
        .eq("project_id", projectIdNum);

      // Always exclude soft-deleted drawings from the main list
      query = query.is("deleted_at", null);

      if (!include_unpublished) {
        query = query.eq("is_published", true);
      }
      if (!include_obsolete) {
        query = query.eq("is_obsolete", false);
      }

      if (area_id) query = query.eq("area_id", area_id);
      if (discipline) query = query.eq("discipline", discipline);
      if (status) query = query.eq("status", status);
      if (set_id) query = query.eq("drawing_set_id", set_id);

      if (search) {
        query = query.or(
          `drawing_number.ilike.%${search}%,title.ilike.%${search}%`,
        );
      }

      query = query
        .order("drawing_number", { ascending: true })
        .range(offset, offset + page_size - 1);

      const { data, error, count } = await query;

      if (error) {
        return { data: null, error: { type: "UNKNOWN", message: error.message } };
      }

      return {
        data: {
          drawings: (data || []) as DrawingLogEntry[],
          total_count: count || 0,
          page,
          page_size,
          has_next_page: offset + page_size < (count || 0),
          has_previous_page: page > 1,
        },
        error: null,
      };
    } catch (err) {
      return {
        data: null,
        error: {
          type: "UNKNOWN",
          message: err instanceof Error ? err.message : "an unexpected error occurred",
        },
      };
    }
  }

  async listDeleted(
    projectId: string,
  ): Promise<Result<DrawingLogEntry[], DrawingError>> {
    const projectIdNum = Number.parseInt(projectId, 10);

    try {
      const { data, error } = await this.supabase
        .from("drawing_log")
        .select("*")
        .eq("project_id", projectIdNum)
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false });

      if (error) {
        return { data: null, error: { type: "DATABASE_ERROR", message: error.message } };
      }

      return { data: data ?? [], error: null };
    } catch (err) {
      return {
        data: null,
        error: {
          type: "UNKNOWN",
          message: err instanceof Error ? err.message : "an unexpected error occurred",
        },
      };
    }
  }

  async getById(
    projectId: string,
    drawingId: string,
  ): Promise<Result<DrawingWithRevision, DrawingError>> {
    const projectIdNum = Number.parseInt(projectId, 10);

    try {
      const { data, error } = await this.supabase
        .from("drawings")
        .select(`*, current_revision:drawing_revisions!fk_drawings_current_revision(*)`)
        .eq("project_id", projectIdNum)
        .eq("id", drawingId)
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          return {
            data: null,
            error: { type: "NOT_FOUND", message: `Drawing with ID ${drawingId} not found` },
          };
        }
        return { data: null, error: { type: "UNKNOWN", message: error.message } };
      }

      return {
        data: { ...data, current_revision: data.current_revision || null },
        error: null,
      };
    } catch (err) {
      return {
        data: null,
        error: {
          type: "UNKNOWN",
          message: err instanceof Error ? err.message : "an unexpected error occurred",
        },
      };
    }
  }

  async create(
    projectId: string,
    input: DrawingCreateInput,
    userId: string,
  ): Promise<Result<Drawing, DrawingError>> {
    const projectIdNum = Number.parseInt(projectId, 10);

    try {
      // Check for duplicate drawing number
      const { data: existing } = await this.supabase
        .from("drawings")
        .select("id")
        .eq("project_id", projectIdNum)
        .eq("drawing_number", input.drawing_number)
        .single();

      if (existing) {
        return {
          data: null,
          error: {
            type: "DUPLICATE_DRAWING_NUMBER",
            message: `Drawing number ${input.drawing_number} already exists for this project`,
          },
        };
      }

      const { data, error } = await this.supabase
        .from("drawings")
        .insert({
          project_id: projectIdNum,
          drawing_number: input.drawing_number,
          title: input.title,
          discipline: input.discipline || null,
          drawing_type: input.drawing_type || null,
          area_id: input.area_id || null,
          is_published: input.is_published ?? true,
          is_obsolete: input.is_obsolete ?? false,
          created_by: userId,
        })
        .select()
        .single();

      if (error) {
        return { data: null, error: { type: "UNKNOWN", message: error.message } };
      }

      return { data, error: null };
    } catch (err) {
      return {
        data: null,
        error: {
          type: "UNKNOWN",
          message: err instanceof Error ? err.message : "an unexpected error occurred",
        },
      };
    }
  }

  async update(
    projectId: string,
    drawingId: string,
    input: DrawingUpdateInput,
  ): Promise<Result<Drawing, DrawingError>> {
    const projectIdNum = Number.parseInt(projectId, 10);

    try {
      if (input.drawing_number) {
        const { data: existing } = await this.supabase
          .from("drawings")
          .select("id")
          .eq("project_id", projectIdNum)
          .eq("drawing_number", input.drawing_number)
          .neq("id", drawingId)
          .single();

        if (existing) {
          return {
            data: null,
            error: {
              type: "DUPLICATE_DRAWING_NUMBER",
              message: `Drawing number ${input.drawing_number} already exists for this project`,
            },
          };
        }
      }

      const { data, error } = await this.supabase
        .from("drawings")
        .update({ ...input, updated_at: new Date().toISOString() })
        .eq("id", drawingId)
        .eq("project_id", projectIdNum)
        .select()
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          return {
            data: null,
            error: { type: "NOT_FOUND", message: `Drawing with ID ${drawingId} not found` },
          };
        }
        return { data: null, error: { type: "UNKNOWN", message: error.message } };
      }

      return { data, error: null };
    } catch (err) {
      return {
        data: null,
        error: {
          type: "UNKNOWN",
          message: err instanceof Error ? err.message : "an unexpected error occurred",
        },
      };
    }
  }

  // ─── Soft-delete / Recycle Bin ──────────────────────────────────────────────

  async delete(
    projectId: string,
    drawingId: string,
    userId?: string,
  ): Promise<Result<void, DrawingError>> {
    const projectIdNum = Number.parseInt(projectId, 10);

    try {
      // Collect document_metadata IDs linked to this drawing's revisions before soft-deleting,
      // so we can remove them from the OCR/embed queue after the drawing is gone.
      const { data: revisions } = await this.supabase
        .from("drawing_revisions")
        .select("document_metadata_id")
        .eq("drawing_id", drawingId)
        .not("document_metadata_id", "is", null);

      const docMetaIds = (revisions ?? [])
        .map((r) => r.document_metadata_id as string)
        .filter(Boolean);

      const { error } = await this.supabase
        .from("drawings")
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: userId ?? null,
        } as Record<string, unknown>)
        .eq("id", drawingId)
        .eq("project_id", projectIdNum);

      if (error) {
        return { data: null, error: { type: "UNKNOWN", message: error.message } };
      }

      // Best-effort: remove document_metadata records that haven't been embedded yet.
      // Only delete no_text entries — already-embedded records are valuable for RAG search.
      if (docMetaIds.length > 0) {
        await this.supabase
          .from("document_metadata")
          .delete()
          .in("id", docMetaIds)
          .eq("status", "no_text");
      }

      return { data: undefined as unknown as void, error: null };
    } catch (err) {
      return {
        data: null,
        error: {
          type: "UNKNOWN",
          message: err instanceof Error ? err.message : "an unexpected error occurred",
        },
      };
    }
  }

  async restore(
    projectId: string,
    drawingId: string,
  ): Promise<Result<void, DrawingError>> {
    const projectIdNum = Number.parseInt(projectId, 10);

    try {
      const { error } = await this.supabase
        .from("drawings")
        .update({
          deleted_at: null,
          deleted_by: null,
        } as Record<string, unknown>)
        .eq("id", drawingId)
        .eq("project_id", projectIdNum);

      if (error) {
        return { data: null, error: { type: "UNKNOWN", message: error.message } };
      }

      return { data: undefined as unknown as void, error: null };
    } catch (err) {
      return {
        data: null,
        error: {
          type: "UNKNOWN",
          message: err instanceof Error ? err.message : "an unexpected error occurred",
        },
      };
    }
  }

  async permanentDelete(
    projectId: string,
    drawingId: string,
  ): Promise<Result<void, DrawingError>> {
    const projectIdNum = Number.parseInt(projectId, 10);

    try {
      const { data: revisions } = await this.supabase
        .from("drawing_revisions")
        .select("file_url")
        .eq("drawing_id", drawingId);

      const { error } = await this.supabase
        .from("drawings")
        .delete()
        .eq("id", drawingId)
        .eq("project_id", projectIdNum);

      if (error) {
        return { data: null, error: { type: "UNKNOWN", message: error.message } };
      }

      // Clean up storage files
      if (revisions && revisions.length > 0) {
        await this.files.removeFiles(revisions.map((r) => r.file_url));
      }

      return { data: undefined as unknown as void, error: null };
    } catch (err) {
      return {
        data: null,
        error: {
          type: "UNKNOWN",
          message: err instanceof Error ? err.message : "an unexpected error occurred",
        },
      };
    }
  }

  // ─── Publish / Obsolete ─────────────────────────────────────────────────────

  async publish(
    projectId: string,
    drawingId: string,
    userId?: string,
    revisionId?: string,
  ): Promise<Result<Drawing, DrawingError>> {
    const projectIdNum = Number.parseInt(projectId, 10);

    try {
      const { data: drawing, error: drawingError } = await this.supabase
        .from("drawings")
        .select("id, current_revision_id, review_revision_id")
        .eq("id", drawingId)
        .eq("project_id", projectIdNum)
        .single();

      if (drawingError) {
        if (drawingError.code === "PGRST116") {
          return {
            data: null,
            error: { type: "NOT_FOUND", message: `Drawing with ID ${drawingId} not found` },
          };
        }
        return { data: null, error: { type: "UNKNOWN", message: drawingError.message } };
      }

      const targetRevisionId =
        revisionId ?? drawing.review_revision_id ?? drawing.current_revision_id;
      if (!targetRevisionId) {
        return {
          data: null,
          error: {
            type: "NOT_FOUND",
            message: `Drawing with ID ${drawingId} does not have a revision to publish`,
          },
        };
      }

      const publishResult = await this.revisions.publish(drawingId, targetRevisionId, userId);
      if (publishResult.error) {
        return { data: null, error: publishResult.error };
      }

      return this.getById(projectId, drawingId);
    } catch (err) {
      return {
        data: null,
        error: {
          type: "UNKNOWN",
          message: err instanceof Error ? err.message : "an unexpected error occurred",
        },
      };
    }
  }

  async unpublish(projectId: string, drawingId: string): Promise<Result<Drawing, DrawingError>> {
    const projectIdNum = Number.parseInt(projectId, 10);

    try {
      const { data: drawing, error: drawingError } = await this.supabase
        .from("drawings")
        .select("id, current_revision_id")
        .eq("id", drawingId)
        .eq("project_id", projectIdNum)
        .single();

      if (drawingError) {
        if (drawingError.code === "PGRST116") {
          return {
            data: null,
            error: { type: "NOT_FOUND", message: `Drawing with ID ${drawingId} not found` },
          };
        }
        return { data: null, error: { type: "UNKNOWN", message: drawingError.message } };
      }

      if (!drawing.current_revision_id) {
        return this._setFlag(projectId, drawingId, "is_published", false);
      }

      const unpublishResult = await this.revisions.unpublishCurrent(
        drawingId,
        drawing.current_revision_id,
      );
      if (unpublishResult.error) {
        return { data: null, error: unpublishResult.error };
      }

      return this.getById(projectId, drawingId);
    } catch (err) {
      return {
        data: null,
        error: {
          type: "UNKNOWN",
          message: err instanceof Error ? err.message : "an unexpected error occurred",
        },
      };
    }
  }

  async markObsolete(projectId: string, drawingId: string): Promise<Result<Drawing, DrawingError>> {
    return this._setFlag(projectId, drawingId, "is_obsolete", true);
  }

  async restoreObsolete(projectId: string, drawingId: string): Promise<Result<Drawing, DrawingError>> {
    return this._setFlag(projectId, drawingId, "is_obsolete", false);
  }

  // ─── Delegated methods (backward-compatible wrappers) ───────────────────────

  async listRevisions(drawingId: string) {
    return this.revisions.list(drawingId);
  }

  async createRevision(drawingId: string, input: RevisionCreateInput, userId: string) {
    return this.revisions.create(drawingId, input, userId);
  }

  async updateRevisionNumber(drawingId: string, revisionId: string, revisionNumber: string) {
    return this.revisions.updateNumber(drawingId, revisionId, revisionNumber);
  }

  async uploadFile(projectId: string, drawingId: string, file: File) {
    return this.files.upload(projectId, drawingId, file);
  }

  async getDownloadUrl(filePath: string) {
    return this.files.getDownloadUrl(filePath);
  }

  async recordDownload(revisionId: string, userId: string) {
    return this.files.recordDownload(revisionId, userId);
  }

  async listDownloads(revisionId: string) {
    return this.files.listDownloads(revisionId);
  }

  async listSketches(revisionId: string) {
    return this.related.listSketches(revisionId);
  }

  async createSketch(revisionId: string, input: SketchCreateInput, userId: string) {
    return this.related.createSketch(revisionId, input, userId);
  }

  async linkRelatedItem(drawingId: string, relatedType: string, relatedId: string, userId: string) {
    return this.related.link(drawingId, relatedType, relatedId, userId);
  }

  async unlinkRelatedItem(drawingId: string, relatedType: string, relatedId: string) {
    return this.related.unlink(drawingId, relatedType, relatedId);
  }

  async listRelatedItems(drawingId: string) {
    return this.related.list(drawingId);
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private async _setFlag(
    projectId: string,
    drawingId: string,
    field: "is_published" | "is_obsolete",
    value: boolean,
  ): Promise<Result<Drawing, DrawingError>> {
    const projectIdNum = Number.parseInt(projectId, 10);
    try {
      const { data, error } = await this.supabase
        .from("drawings")
        .update({ [field]: value, updated_at: new Date().toISOString() })
        .eq("id", drawingId)
        .eq("project_id", projectIdNum)
        .select()
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          return {
            data: null,
            error: { type: "NOT_FOUND", message: `Drawing with ID ${drawingId} not found` },
          };
        }
        return { data: null, error: { type: "UNKNOWN", message: error.message } };
      }

      return { data, error: null };
    } catch (err) {
      return {
        data: null,
        error: {
          type: "UNKNOWN",
          message: err instanceof Error ? err.message : "an unexpected error occurred",
        },
      };
    }
  }
}
