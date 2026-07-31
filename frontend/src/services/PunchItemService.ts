import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

type Tables = Database["public"]["Tables"];
type PunchItemRow = Tables["punch_items"]["Row"];
type PunchItemInsert = Tables["punch_items"]["Insert"];
type PunchItemUpdate = Tables["punch_items"]["Update"];

export interface PunchItemFilters {
  search?: string;
  status?: string;
  priority?: string;
  assignee_id?: string;
  is_deleted?: boolean;
  page?: number;
  page_size?: number;
}

export interface PunchItemListResponse {
  items: PunchItemRow[];
  total_count: number;
  page: number;
  page_size: number;
  has_next_page: boolean;
  has_previous_page: boolean;
}

export interface PunchItemError {
  type: "NOT_FOUND" | "UNKNOWN" | "VALIDATION";
  message: string;
}

export interface Result<T, E> {
  data: T | null;
  error: E | null;
}

/**
 * Service class for punch item management
 * Handles CRUD operations with pagination, filtering, and soft delete
 * CRITICAL: project_id is INTEGER (matches projects.id type)
 */
export class PunchItemService {
  constructor(private supabase: SupabaseClient<Database>) {}

  /**
   * Get paginated list of punch items for a project with optional filters
   */
  async list(
    projectId: number,
    filters: PunchItemFilters = {},
  ): Promise<Result<PunchItemListResponse, PunchItemError>> {
    const {
      search,
      status,
      priority,
      assignee_id,
      is_deleted = false,
      page = 1,
      page_size = 50,
    } = filters;

    const offset = (page - 1) * page_size;

    try {
      let query = this.supabase
        .from("punch_items")
        .select("*", { count: "exact" })
        .eq("project_id", projectId)
        .eq("is_deleted", is_deleted);

      if (status) {
        query = query.eq("status", status);
      }

      if (priority) {
        query = query.eq("priority", priority);
      }

      if (assignee_id) {
        query = query.eq("assignee_id", assignee_id);
      }

      if (search) {
        query = query.or(
          `title.ilike.%${search}%,description.ilike.%${search}%,location.ilike.%${search}%`,
        );
      }

      query = query
        .order("number", { ascending: false })
        .range(offset, offset + page_size - 1);

      const { data, error, count } = await query;

      if (error) {
        return {
          data: null,
          error: { type: "UNKNOWN", message: error.message },
        };
      }

      return {
        data: {
          items: data || [],
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

  /**
   * Get a single punch item by ID
   */
  async getById(
    projectId: number,
    punchItemId: string,
  ): Promise<Result<PunchItemRow, PunchItemError>> {
    try {
      const { data, error } = await this.supabase
        .from("punch_items")
        .select("*")
        .eq("project_id", projectId)
        .eq("id", punchItemId)
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          return {
            data: null,
            error: {
              type: "NOT_FOUND",
              message: `Punch item with ID ${punchItemId} not found`,
            },
          };
        }
        return {
          data: null,
          error: { type: "UNKNOWN", message: error.message },
        };
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
   * Create a new punch item with auto-incrementing number per project
   */
  async create(
    projectId: number,
    data: Omit<PunchItemInsert, "project_id" | "number">,
    userId: string,
  ): Promise<Result<PunchItemRow, PunchItemError>> {
    try {
      // Get next number for project
      const { data: maxRow } = await this.supabase
        .from("punch_items")
        .select("number")
        .eq("project_id", projectId)
        .order("number", { ascending: false })
        .limit(1)
        .single();

      const nextNumber = (maxRow?.number || 0) + 1;

      const insertData: PunchItemInsert = {
        ...data,
        project_id: projectId,
        number: nextNumber,
        created_by: userId,
        updated_by: userId,
      };

      const { data: created, error } = await this.supabase
        .from("punch_items")
        .insert(insertData)
        .select()
        .single();

      if (error) {
        return {
          data: null,
          error: { type: "UNKNOWN", message: error.message },
        };
      }

      return { data: created, error: null };
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
   * Update a punch item
   */
  async update(
    projectId: number,
    punchItemId: string,
    data: PunchItemUpdate,
    userId: string,
  ): Promise<Result<PunchItemRow, PunchItemError>> {
    try {
      const updateData: PunchItemUpdate = {
        ...data,
        updated_by: userId,
      };

      const { data: updated, error } = await this.supabase
        .from("punch_items")
        .update(updateData)
        .eq("id", punchItemId)
        .eq("project_id", projectId)
        .select()
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          return {
            data: null,
            error: {
              type: "NOT_FOUND",
              message: `Punch item with ID ${punchItemId} not found`,
            },
          };
        }
        return {
          data: null,
          error: { type: "UNKNOWN", message: error.message },
        };
      }

      return { data: updated, error: null };
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
   * Soft delete a punch item (set is_deleted = true)
   */
  async softDelete(
    projectId: number,
    punchItemId: string,
    userId: string,
  ): Promise<Result<PunchItemRow, PunchItemError>> {
    return this.update(projectId, punchItemId, { is_deleted: true }, userId);
  }

  /**
   * Restore a soft-deleted punch item (set is_deleted = false)
   */
  async restore(
    projectId: number,
    punchItemId: string,
    userId: string,
  ): Promise<Result<PunchItemRow, PunchItemError>> {
    return this.update(projectId, punchItemId, { is_deleted: false }, userId);
  }
}
