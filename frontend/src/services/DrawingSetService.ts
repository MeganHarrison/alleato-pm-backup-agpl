import type { createClient } from "@supabase/supabase-js";
import type { Database } from "../types/database.types";

type DrawingSetError = { type: string; message: string };
type Result<T, E = DrawingSetError> = { data: T; error: null } | { data: null; error: E };

type DrawingSet = Database["public"]["Tables"]["drawing_sets"]["Row"];
type DrawingSetInsert = Database["public"]["Tables"]["drawing_sets"]["Insert"];
type DrawingSetUpdate = Database["public"]["Tables"]["drawing_sets"]["Update"];

export type DrawingSetWithCounts = DrawingSet & {
  publishedCount: number;
  unpublishedCount: number;
};

export class DrawingSetService {
  constructor(private supabase: ReturnType<typeof createClient<Database>>) {}

  async list(projectId: string): Promise<Result<DrawingSetWithCounts[]>> {
    const projectIdNum = Number.parseInt(projectId, 10);
    const { data, error } = await this.supabase
      .from("drawing_sets")
      .select("*, drawing_revisions(id, drawing_id)")
      .eq("project_id", projectIdNum)
      .order("issued_at", { ascending: false });

    if (error) {
      return {
        data: null,
        error: {
          type: "DATABASE_ERROR",
          message: error.message,
        },
      };
    }

    // Now we need to figure out published vs unpublished counts.
    // A revision is "published" if its parent drawing has is_published = true.
    // Fetch all drawings for this project to build a lookup.
    const { data: drawings } = await this.supabase
      .from("drawings")
      .select("id, is_published")
      .eq("project_id", projectIdNum);

    const publishedMap = new Map<string, boolean>();
    (drawings ?? []).forEach((d) => {
      publishedMap.set(d.id, d.is_published ?? true);
    });

    const enriched: DrawingSetWithCounts[] = (data ?? []).map((set) => {
      const revisions = (set as Record<string, unknown>).drawing_revisions as
        | { id: string; drawing_id: string }[]
        | null;

      let publishedCount = 0;
      let unpublishedCount = 0;

      // Count unique drawings (not revisions) per set
      const seenDrawings = new Set<string>();
      (revisions ?? []).forEach((rev) => {
        if (seenDrawings.has(rev.drawing_id)) return;
        seenDrawings.add(rev.drawing_id);
        const isPublished = publishedMap.get(rev.drawing_id) ?? true;
        if (isPublished) {
          publishedCount++;
        } else {
          unpublishedCount++;
        }
      });

      // Strip the nested revisions from the response
      const { drawing_revisions: _, ...rest } = set as Record<string, unknown>;
      return {
        ...(rest as unknown as DrawingSet),
        publishedCount,
        unpublishedCount,
      };
    });

    return { data: enriched, error: null };
  }

  async create(
    projectId: string,
    input: { name: string; issued_at: string; description?: string },
    userId: string
  ): Promise<Result<DrawingSet>> {
    const insertData: DrawingSetInsert = {
      project_id: parseInt(projectId, 10),
      name: input.name,
      issued_at: input.issued_at,
      description: input.description ?? null,
      created_by: userId,
      status: "active",
    };

    const { data, error } = await this.supabase
      .from("drawing_sets")
      .insert(insertData)
      .select()
      .single();

    if (error) {
      return {
        data: null,
        error: {
          type: "DATABASE_ERROR",
          message: error.message,
        },
      };
    }

    return { data, error: null };
  }

  async update(
    setId: string,
    input: Partial<{ name: string; issued_at: string; description: string; status: string }>
  ): Promise<Result<DrawingSet>> {
    const updateData: DrawingSetUpdate = {};

    if (input.name !== undefined) updateData.name = input.name;
    if (input.issued_at !== undefined) updateData.issued_at = input.issued_at;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.status !== undefined) updateData.status = input.status;

    const { data, error } = await this.supabase
      .from("drawing_sets")
      .update(updateData)
      .eq("id", setId)
      .select()
      .single();

    if (error) {
      return {
        data: null,
        error: {
          type: "DATABASE_ERROR",
          message: error.message,
        },
      };
    }

    return { data, error: null };
  }

  async archive(setId: string): Promise<Result<DrawingSet>> {
    const { data, error } = await this.supabase
      .from("drawing_sets")
      .update({ status: "archived" })
      .eq("id", setId)
      .select()
      .single();

    if (error) {
      return {
        data: null,
        error: {
          type: "DATABASE_ERROR",
          message: error.message,
        },
      };
    }

    return { data, error: null };
  }
}
