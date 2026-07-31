import type {
  SupabaseClient,
  DrawingSketch,
  DrawingRelatedItem,
  DrawingError,
  Result,
  SketchCreateInput,
} from "./types";

/**
 * Service for drawing-related items (cross-tool links) and sketches
 */
export class DrawingRelatedService {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Link a related item to a drawing
   */
  async link(
    drawingId: string,
    relatedType: string,
    relatedId: string,
    userId: string,
  ): Promise<Result<DrawingRelatedItem, DrawingError>> {
    try {
      const { data, error } = await this.supabase
        .from("drawing_related_items")
        .insert({
          drawing_id: drawingId,
          related_type: relatedType,
          related_id: relatedId,
          created_by: userId,
        })
        .select()
        .single();

      if (error) {
        // Handle unique constraint violation — return existing record
        if (error.code === "23505") {
          const { data: existingData } = await this.supabase
            .from("drawing_related_items")
            .select("*")
            .eq("drawing_id", drawingId)
            .eq("related_type", relatedType)
            .eq("related_id", relatedId)
            .single();

          if (existingData) {
            return { data: existingData, error: null };
          }
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

  /**
   * Unlink a related item from a drawing
   */
  async unlink(
    drawingId: string,
    relatedType: string,
    relatedId: string,
  ): Promise<Result<void, DrawingError>> {
    try {
      const { error } = await this.supabase
        .from("drawing_related_items")
        .delete()
        .eq("drawing_id", drawingId)
        .eq("related_type", relatedType)
        .eq("related_id", relatedId);

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

  /**
   * List all related items for a drawing
   */
  async list(drawingId: string): Promise<Result<DrawingRelatedItem[], DrawingError>> {
    try {
      const { data, error } = await this.supabase
        .from("drawing_related_items")
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
   * List all sketches for a revision
   */
  async listSketches(revisionId: string): Promise<Result<DrawingSketch[], DrawingError>> {
    try {
      const { data, error } = await this.supabase
        .from("drawing_sketches")
        .select("*")
        .eq("drawing_revision_id", revisionId)
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
   * Create a sketch for a revision
   */
  async createSketch(
    revisionId: string,
    input: SketchCreateInput,
    userId: string,
  ): Promise<Result<DrawingSketch, DrawingError>> {
    try {
      const { data, error } = await this.supabase
        .from("drawing_sketches")
        .insert({
          drawing_revision_id: revisionId,
          file_url: input.file_url,
          name: input.name,
          sketch_number: input.sketch_number,
          description: input.description || null,
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

  // ─── API-layer convenience methods ─────────────────────────────────────────

  /** Alias for list() — used by the related-items API route */
  async listRelatedItems(drawingId: string): Promise<Result<DrawingRelatedItem[], DrawingError>> {
    return this.list(drawingId);
  }

  /** Add a related item (reordered args vs link() — relatedId first, relatedType second) */
  async addRelatedItem(
    drawingId: string,
    relatedId: string,
    relatedType: string,
    userId: string,
  ): Promise<Result<DrawingRelatedItem, DrawingError>> {
    return this.link(drawingId, relatedType, relatedId, userId);
  }

  /** Remove a related item by its row UUID, verifying it belongs to the drawing */
  async removeRelatedItem(
    itemId: string,
    drawingId: string,
  ): Promise<Result<null, DrawingError>> {
    try {
      const { error } = await this.supabase
        .from("drawing_related_items")
        .delete()
        .eq("id", itemId)
        .eq("drawing_id", drawingId);

      if (error) {
        if (error.code === "PGRST116") {
          return {
            data: null,
            error: { type: "NOT_FOUND", message: `Related item ${itemId} not found on drawing ${drawingId}` },
          };
        }
        return { data: null, error: { type: "UNKNOWN", message: error.message } };
      }

      return { data: null, error: null };
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
   * Add a sketch to a revision.
   * Auto-assigns sketch_number if input.sketch_number is empty.
   */
  async addSketch(
    revisionId: string,
    input: SketchCreateInput,
    userId: string,
  ): Promise<Result<DrawingSketch, DrawingError>> {
    try {
      let sketchNumber = input.sketch_number;

      if (!sketchNumber) {
        const { count, error: countError } = await this.supabase
          .from("drawing_sketches")
          .select("id", { count: "exact", head: true })
          .eq("drawing_revision_id", revisionId);

        if (countError) {
          return { data: null, error: { type: "UNKNOWN", message: countError.message } };
        }
        sketchNumber = String((count ?? 0) + 1);
      }

      const { data, error } = await this.supabase
        .from("drawing_sketches")
        .insert({
          drawing_revision_id: revisionId,
          file_url: input.file_url,
          name: input.name,
          sketch_number: sketchNumber,
          description: input.description || null,
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

  /** Remove a sketch by its row UUID, verifying it belongs to the revision */
  async removeSketch(
    sketchId: string,
    revisionId: string,
  ): Promise<Result<null, DrawingError>> {
    try {
      const { error } = await this.supabase
        .from("drawing_sketches")
        .delete()
        .eq("id", sketchId)
        .eq("drawing_revision_id", revisionId);

      if (error) {
        if (error.code === "PGRST116") {
          return {
            data: null,
            error: { type: "NOT_FOUND", message: `Sketch ${sketchId} not found on revision ${revisionId}` },
          };
        }
        return { data: null, error: { type: "UNKNOWN", message: error.message } };
      }

      return { data: null, error: null };
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
