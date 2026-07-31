import type {
  SupabaseClient,
  DrawingRevision,
  DrawingError,
  Result,
  RevisionCreateInput,
} from "./types";

/**
 * Service for drawing revision management
 */
export class DrawingRevisionService {
  constructor(private supabase: SupabaseClient) {}

  /**
   * List all revisions for a drawing ordered by created_at desc
   */
  async list(drawingId: string): Promise<Result<DrawingRevision[], DrawingError>> {
    try {
      const { data, error } = await this.supabase
        .from("drawing_revisions")
        .select("*")
        .eq("drawing_id", drawingId)
        .order("created_at", { ascending: false });

      if (error) {
        return { data: null, error: { type: "UNKNOWN", message: error.message } };
      }

      return { data: data || [], error: null };
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

  /**
   * Create a new revision for a drawing.
   * Keep the current-revision pointer explicit in application code because
   * older migrations do not install the trigger this service once assumed.
   */
  async create(
    drawingId: string,
    input: RevisionCreateInput,
    userId: string,
  ): Promise<Result<DrawingRevision, DrawingError>> {
    try {
      const shouldMakeCurrent = input.is_current_revision ?? true;
      const shouldPublishRevision = input.is_published ?? false;
      const shouldUpdateReviewRevision = input.update_review_revision ?? shouldMakeCurrent;
      const shouldUpdateCurrentRevision =
        input.update_current_revision ?? shouldPublishRevision;
      const now = new Date().toISOString();

      const { data, error } = await this.supabase
        .from("drawing_revisions")
        .insert({
          drawing_id: drawingId,
          revision_number: input.revision_number,
          drawing_set_id: input.drawing_set_id || null,
          drawing_date: input.drawing_date || null,
          received_date: input.received_date,
          status: input.status || "approved",
          file_url: input.file_url,
          file_name: input.file_name,
          file_size: input.file_size,
          file_type: input.file_type,
          description: input.description || null,
          rotation_degrees: input.rotation_degrees ?? 0,
          ocr_confidence_label: input.ocr_confidence_label ?? "unknown",
          ocr_confidence_score: input.ocr_confidence_score ?? null,
          ocr_confidence_source: input.ocr_confidence_source ?? "not_run",
          uploaded_by: userId,
          is_current_revision: shouldMakeCurrent,
          is_published: shouldPublishRevision,
          published_at: shouldPublishRevision ? now : null,
          published_by: shouldPublishRevision ? userId : null,
        })
        .select()
        .single();

      if (error) {
        return { data: null, error: { type: "UNKNOWN", message: error.message } };
      }

      if (shouldMakeCurrent) {
        const { error: unsetError } = await this.supabase
          .from("drawing_revisions")
          .update({ is_current_revision: false })
          .eq("drawing_id", drawingId)
          .neq("id", data.id);

        if (unsetError) {
          return { data: null, error: { type: "UNKNOWN", message: unsetError.message } };
        }
      }

      if (shouldUpdateReviewRevision || shouldUpdateCurrentRevision) {
        const drawingUpdate: {
          review_revision_id?: string;
          current_revision_id?: string;
          updated_at: string;
        } = {
          updated_at: now,
        };

        if (shouldUpdateReviewRevision) {
          drawingUpdate.review_revision_id = data.id;
        }
        if (shouldUpdateCurrentRevision) {
          drawingUpdate.current_revision_id = data.id;
        }

        const { error: drawingUpdateError } = await this.supabase
          .from("drawings")
          .update(drawingUpdate)
          .eq("id", drawingId);

        if (drawingUpdateError) {
          return { data: null, error: { type: "UNKNOWN", message: drawingUpdateError.message } };
        }
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

  async publish(
    drawingId: string,
    revisionId: string,
    userId?: string,
  ): Promise<Result<DrawingRevision, DrawingError>> {
    const now = new Date().toISOString();

    try {
        const { data: revision, error: revisionUpdateError } = await this.supabase
          .from("drawing_revisions")
          .update({
            is_published: true,
            published_at: now,
            published_by: userId ?? null,
            status: "approved",
          })
          .eq("id", revisionId)
          .eq("drawing_id", drawingId)
          .select()
          .single();

        if (revisionUpdateError) {
          return { data: null, error: { type: "UNKNOWN", message: revisionUpdateError.message } };
        }

      const { error: drawingUpdateError } = await this.supabase
        .from("drawings")
        .update({
          is_published: true,
          current_revision_id: revisionId,
          review_revision_id: revisionId,
          updated_at: now,
        })
        .eq("id", drawingId);

      if (drawingUpdateError) {
        return { data: null, error: { type: "UNKNOWN", message: drawingUpdateError.message } };
      }

      return {
        data: revision,
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

  async unpublishCurrent(
    drawingId: string,
    revisionId: string,
  ): Promise<Result<DrawingRevision | null, DrawingError>> {
    const now = new Date().toISOString();

    try {
      const { error: revisionError } = await this.supabase
        .from("drawing_revisions")
        .update({
          is_published: false,
          published_at: null,
          published_by: null,
          status: "under_review",
        })
        .eq("id", revisionId)
        .eq("drawing_id", drawingId);

      if (revisionError) {
        return { data: null, error: { type: "UNKNOWN", message: revisionError.message } };
      }

      const { data: fallbackRevision, error: fallbackError } = await this.supabase
        .from("drawing_revisions")
        .select("*")
        .eq("drawing_id", drawingId)
        .eq("is_published", true)
        .neq("id", revisionId)
        .order("published_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fallbackError) {
        return { data: null, error: { type: "UNKNOWN", message: fallbackError.message } };
      }

      const { error: drawingError } = await this.supabase
        .from("drawings")
        .update({
          is_published: Boolean(fallbackRevision),
          current_revision_id: fallbackRevision?.id ?? revisionId,
          updated_at: now,
        })
        .eq("id", drawingId);

      if (drawingError) {
        return { data: null, error: { type: "UNKNOWN", message: drawingError.message } };
      }

      return { data: fallbackRevision ?? null, error: null };
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

  /**
   * Update the revision_number on a drawing revision row
   */
  async updateNumber(
    drawingId: string,
    revisionId: string,
    revisionNumber: string,
  ): Promise<Result<DrawingRevision, DrawingError>> {
    try {
      const { data, error } = await this.supabase
        .from("drawing_revisions")
        .update({ revision_number: revisionNumber })
        .eq("id", revisionId)
        .eq("drawing_id", drawingId)
        .select()
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          return {
            data: null,
            error: { type: "NOT_FOUND", message: `Revision with ID ${revisionId} not found` },
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
